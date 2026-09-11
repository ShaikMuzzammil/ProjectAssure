// ═══════════════════════════════════════════════════════════════════════════
// Host Control sync engine — the real bridge to the main ProjectAssure app.
//
// POLLING (default): every GET /api/admin/sync does a SERVER-SIDE fetch of
//   {MAIN}/api/sync/state (never from the browser — CORS does not apply
//   server-to-server), merges the snapshot into the host store, derives real
//   approval items and fires the automated email jobs, then returns the full
//   host state. The UI polls this every 5 seconds.
// WEBHOOK (optional): POST /api/admin/sync accepts a direct push (token via
//   SYNC_TOKEN) for deployments that prefer main → host pushes.
//
// Failure handling: if the main app is unreachable, the last mirror is served
// and marked STALE — routes never crash.
// ═══════════════════════════════════════════════════════════════════════════

import { getStore, MIRROR_CAP, audit, newId, nowIso, addApproval, scheduleSave } from "./store";
import { adminEmail } from "./auth";
import { emailProviderLabel, sendHostEmail } from "./mailer";
import type {
  AccessRecord,
  ApprovalItem,
  EnvCheckItem,
  HostStateResponse,
  HostUserView,
  MainSyncStateResponse,
  Severity,
  SyncProject,
  SyncSnapshot,
} from "./types";

const MAIN_TIMEOUT_MS = 4000;
const FRESH_AFTER_MS = 5 * 60 * 1000; // snapshot older than 5 min → "stale" data

function stripSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function effectiveMainUrl(): string {
  const override = getStore().data.settings.mainUrlOverride;
  if (override && /^https?:\/\//i.test(override)) return stripSlash(override.trim());
  const env = process.env.MAIN_PROJECT_URL;
  if (env && /^https?:\/\//i.test(env)) return stripSlash(env.trim());
  return "http://localhost:3000";
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ── Webhook → main (how host commands REACH main-app users) ────────────────

export interface WebhookOutcome {
  ok: boolean;
  status: number;
  note: string;
}

export async function postCommandToMain(
  payload: {
    // v23 — "host-message" is the structured action channel used by the
    // Approvals Centre's reject-with-action path (cancel project / disband
    // account / freeze budget). It is accepted by the main app's webhook
    // route (already in the allowed list there) and parsed by the client
    // store's applyHostCommands to apply the side effect on the user's
    // workspace.
    kind: "broadcast" | "user-alert" | "announce" | "request-sync" | "host-message";
    title: string;
    message: string;
    severity: Severity;
    linkView?: string;
    audience?: string;
    createdBy: string;
  },
): Promise<WebhookOutcome> {
  const mainUrl = effectiveMainUrl();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.SYNC_TOKEN) headers["x-sync-token"] = process.env.SYNC_TOKEN;
  const res = await fetchWithTimeout(`${mainUrl}/api/sync/webhook`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  }, MAIN_TIMEOUT_MS);
  if (!res) {
    return { ok: false, status: 0, note: `main app unreachable at ${mainUrl} — command NOT queued; retry when it is back` };
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, status: res.status, note: `main app rejected the command (${res.status}): ${detail.slice(0, 120)}` };
  }
  return { ok: true, status: 200, note: "queued on the main sync hub — logged-in main-app browsers receive it within ~20s via their poll" };
}

export async function testMainConnection(): Promise<{ reachable: boolean; status: number; body?: unknown; error?: string }> {
  const mainUrl = effectiveMainUrl();
  const res = await fetchWithTimeout(`${mainUrl}/api/health`, { method: "GET" }, MAIN_TIMEOUT_MS);
  if (!res) return { reachable: false, status: 0, error: `no response from ${mainUrl}/api/health within ${MAIN_TIMEOUT_MS / 1000}s` };
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body is fine */
  }
  return { reachable: res.ok, status: res.status, body };
}

// ── Budget overrun helper (shared by approvals + email automation) ─────────

export function budgetOverrunPct(p: SyncProject): number {
  if (!p.budgetTotalCr || p.budgetTotalCr <= 0) return 0;
  return ((p.budgetSpentCr - p.budgetTotalCr) / p.budgetTotalCr) * 100;
}

// ── The sync run ────────────────────────────────────────────────────────────

export interface SyncRunResult {
  ran: boolean;
  skippedReason?: string;
  reachable: boolean;
  merged: boolean;
  error?: string;
}

const gw = globalThis as unknown as { __hostSyncInFlight?: boolean };

export async function runSync(source: "poll" | "manual" | "webhook", force = false): Promise<SyncRunResult> {
  if (gw.__hostSyncInFlight && !force) {
    return { ran: false, skippedReason: "sync already in flight", reachable: getStore().data.sync.mainReachable, merged: false };
  }
  gw.__hostSyncInFlight = true;
  try {
    const ctl = getStore();
    const d = ctl.data;
    d.sync.pollCount += 1;

    const mainUrl = effectiveMainUrl();
    const res = await fetchWithTimeout(`${mainUrl}/api/sync/state`, { method: "GET" }, MAIN_TIMEOUT_MS);

    if (!res || !res.ok) {
      const error = res ? `HTTP ${res.status} from ${mainUrl}/api/sync/state` : `main app unreachable at ${mainUrl}`;
      const wasReachable = d.sync.mainReachable;
      d.sync.mainReachable = false;
      d.sync.lastError = error;
      d.sync.lastSyncAt = nowIso();
      if (wasReachable || source === "manual") {
        audit("sync.failed", "system", `${error}${source === "manual" ? " (manual sync)" : ""} — serving last mirror as STALE`, "warning");
      }
      scheduleSave();
      return { ran: true, reachable: false, merged: false, error };
    }

    let body: MainSyncStateResponse | null = null;
    try {
      body = (await res.json()) as MainSyncStateResponse;
    } catch {
      const error = "invalid JSON from main /api/sync/state";
      d.sync.mainReachable = false;
      d.sync.lastError = error;
      d.sync.lastSyncAt = nowIso();
      audit("sync.failed", "system", error, "warning");
      scheduleSave();
      return { ran: true, reachable: false, merged: false, error };
    }

    const wasReachable = d.sync.mainReachable;
    d.sync.mainReachable = true;
    d.sync.lastError = null;
    d.sync.lastSyncAt = nowIso();
    d.sync.lastOkSyncAt = nowIso();
    d.sync.revision = body?.hub?.revision ?? d.sync.revision;
    d.sync.lastPushAt = body?.hub?.lastPushAt ?? d.sync.lastPushAt;
    d.sync.lastWebhookAt = body?.hub?.lastWebhookAt ?? d.sync.lastWebhookAt;
    d.sync.commandCount = body?.hub?.commandCount ?? d.sync.commandCount;
    if (!wasReachable) {
      audit("sync.connected", "system", `main app reachable at ${mainUrl} (revision ${d.sync.revision})`, "success");
    }

    let merged = false;
    if (body?.snapshot && Array.isArray(body.snapshot.users)) {
      merged = await mergeSnapshot(body.snapshot, source);
    }
    scheduleSave();
    return { ran: true, reachable: true, merged };
  } finally {
    gw.__hostSyncInFlight = false;
  }
}

// ── Snapshot merge: baseline → delta → approvals → automated emails ────────

function sortDesc<T>(arr: T[], key: (t: T) => string): T[] {
  return [...arr].sort((a, b) => Date.parse(key(b) || "") - Date.parse(key(a) || ""));
}

export async function mergeSnapshot(snapshot: SyncSnapshot, source: "poll" | "manual" | "webhook"): Promise<boolean> {
  const ctl = getStore();
  const d = ctl.data;

  if (d.mirror.pushedAt === snapshot.pushedAt && d.baselineDone) {
    d.mirror.mirroredAt = nowIso(); // same snapshot — just refresh mirror time
    return false;
  }

  const firstMerge = !d.baselineDone;

  // 1) mirror the arrays (caps keep the payload bounded)
  d.mirror.pushedAt = snapshot.pushedAt;
  d.mirror.mirroredAt = nowIso();
  d.mirror.stats = snapshot.stats ?? null;
  d.mirror.users = (snapshot.users ?? []).slice(0, MIRROR_CAP.users);
  d.mirror.projects = (snapshot.projects ?? []).slice(0, MIRROR_CAP.projects);
  d.mirror.alerts = sortDesc((snapshot.alerts ?? []).slice(0, MIRROR_CAP.alerts), (a) => a.createdAt);
  d.mirror.events = sortDesc((snapshot.events ?? []).slice(0, MIRROR_CAP.events), (e) => e.at);
  d.mirror.loginFeed = sortDesc((snapshot.loginFeed ?? []).slice(0, MIRROR_CAP.loginFeed), (l) => l.at);
  d.mirror.emails = sortDesc((snapshot.emails ?? []).slice(0, MIRROR_CAP.emails), (e) => e.at);

  // 2) FIRST successful sync → baseline. Everything that already exists is
  //    recorded as "seen" WITHOUT creating approvals or emails, so only REAL
  //    creations after this moment surface as approval items. (Honest by
  //    design — nothing fake is seeded.)
  if (firstMerge) {
    d.baselineDone = true;
    d.seenProjectIds = d.mirror.projects.map((p) => p.id);
    d.seenUserIds = d.mirror.users.map((u) => u.id);
    for (const u of d.mirror.users) {
      if (u.source === "registered") d.emailDedupe.welcomed[u.id] = "baseline";
    }
    for (const l of d.mirror.loginFeed) d.emailDedupe.loginFeed[l.id] = "baseline";
    for (const p of d.mirror.projects) {
      if (budgetOverrunPct(p) > d.settings.budgetThresholdPct) d.budgetBreached[p.id] = true;
    }
    audit(
      "sync.baseline",
      "system",
      `first mirror established — ${d.mirror.users.length} users, ${d.mirror.projects.length} projects baselined. New users, projects and budget breaches from now on surface as approvals.`,
      "info",
    );
    scheduleSave();
    return true;
  }

  const emails: Promise<unknown>[] = [];

  // 3) NEW PROJECTS → "New project monitoring activation" approval items
  const seenProjects = new Set(d.seenProjectIds);
  for (const p of d.mirror.projects) {
    if (seenProjects.has(p.id)) continue;
    d.seenProjectIds.push(p.id);
    const sev: Severity = p.health < 40 ? "critical" : p.health < 60 ? "warning" : "info";
    const item: ApprovalItem = {
      id: newId(),
      kind: "project-activation",
      title: `New project monitoring activation — ${p.name}`,
      description: `Project ${p.psId} (${p.sector}, ${p.state}) pushed by the main app with ₹${p.budgetTotalCr} Cr sanctioned, ${p.milestonesTotal} milestones, health ${p.health}. Approving notifies the owner ${p.ownerName} in their main-app notifications.`,
      subjectId: p.id,
      subjectLabel: `${p.psId} · ${p.name}`,
      ownerId: p.ownerId,
      ownerName: p.ownerName,
      severity: sev,
      createdAt: nowIso(),
      status: "pending",
    };
    addApproval(item);
    audit("approval.created", "system", `new project ${p.psId} “${p.name}” (owner ${p.ownerName}) — activation approval pending`, sev);
  }

  // 4) NEW USERS → "Account access approval" approval items
  const seenUsers = new Set(d.seenUserIds);
  for (const u of d.mirror.users) {
    if (seenUsers.has(u.id)) continue;
    d.seenUserIds.push(u.id);
    const item: ApprovalItem = {
      id: newId(),
      kind: "account-access",
      title: `Account access approval — ${u.name}`,
      description: `${u.source === "registered" ? "Registered" : "Demo"} account ${u.email} (${u.role}${u.department ? `, ${u.department}` : ""}) appeared in the main app. Approving notifies the user their access is confirmed.`,
      subjectId: u.id,
      subjectLabel: `${u.name} · ${u.email}`,
      ownerId: u.id,
      ownerName: u.name,
      severity: "info",
      createdAt: nowIso(),
      status: "pending",
    };
    addApproval(item);
    audit("approval.created", "system", `new user ${u.email} (${u.source}, ${u.role}) — account access approval pending`, "info");

    // 5) automated (c): welcome + admin notification emails for REGISTERED users
    if (u.source === "registered" && !d.emailDedupe.welcomed[u.id]) {
      d.emailDedupe.welcomed[u.id] = nowIso();
      emails.push(
        sendHostEmail({
          to: u.email,
          subject: "Welcome to ProjectAssure — account under host review",
          body: `Hello ${u.name},\n\nYour ProjectAssure account (${u.email}, role ${u.role}) has been created and mirrored to the Central Programme Office (Host Control).\n\nAn access approval is pending with the host administrator. You will keep full platform access in the meantime.\n\n— ProjectAssure Host Control`,
          kind: "welcome",
        }),
      );
      emails.push(
        sendHostEmail({
          to: adminEmail(),
          subject: `New registered account: ${u.name} (${u.email})`,
          body: `A new registered account needs your attention in Host Control → Approvals Centre.\n\nUser: ${u.name} <${u.email}>\nRole: ${u.role}\nDepartment: ${u.department ?? "—"}\n\nApprove or reject from the Approvals Centre.`,
          kind: "admin",
        }),
      );
    }
  }

  // 6) BUDGET breaches → escalation approval + owner email (re-armable)
  for (const p of d.mirror.projects) {
    const overrun = budgetOverrunPct(p);
    const breached = overrun > d.settings.budgetThresholdPct;
    if (breached && !d.budgetBreached[p.id]) {
      d.budgetBreached[p.id] = true;
      const item: ApprovalItem = {
        id: newId(),
        kind: "budget-escalation",
        title: `Budget escalation — ${p.name} overdrawn ${overrun.toFixed(0)}%`,
        description: `Project ${p.psId} has spent ₹${p.budgetSpentCr} Cr against ₹${p.budgetTotalCr} Cr sanctioned (overrun ${overrun.toFixed(1)}%, threshold ${d.settings.budgetThresholdPct}%). Escalation approval and owner notification pending.`,
        subjectId: p.id,
        subjectLabel: `${p.psId} · ${p.name}`,
        ownerId: p.ownerId,
        ownerName: p.ownerName,
        severity: overrun > 50 ? "critical" : "warning",
        createdAt: nowIso(),
        status: "pending",
      };
      addApproval(item);
      audit("approval.created", "system", `budget breach on ${p.psId} “${p.name}” — overrun ${overrun.toFixed(1)}% > ${d.settings.budgetThresholdPct}%`, "critical");
    } else if (!breached && d.budgetBreached[p.id]) {
      delete d.budgetBreached[p.id]; // back under threshold → re-armed for next breach
    }
  }

  // 7) automated (a): NEW LOGIN events → "New login" email (deduped by feed id)
  if (d.settings.loginAlerts) {
    let mailed = 0;
    const userByEmail = new Map(d.mirror.users.map((u) => [u.id, u]));
    for (const entry of d.mirror.loginFeed) {
      if (d.emailDedupe.loginFeed[entry.id] || mailed >= 25) continue;
      const user = userByEmail.get(entry.userId);
      if (!user || !user.email) continue;
      d.emailDedupe.loginFeed[entry.id] = nowIso();
      mailed += 1;
      emails.push(
        sendHostEmail({
          to: user.email,
          subject: "New login to your ProjectAssure account",
          body: `Hello ${user.name},\n\nA new login to your ProjectAssure account (${user.email}) was recorded at ${new Date(entry.at).toLocaleString("en-IN")}${entry.ip ? ` from IP ${entry.ip}` : ""}.\n\nIf this was not you, contact the host administrator immediately.\n\n— ProjectAssure Host Control · automated login alert`,
          kind: "login",
        }),
      );
    }
  }

  // 8) automated (b): budget breach emails for owners (deduped per breach cycle)
  if (d.settings.budgetAlerts) {
    const userById = new Map(d.mirror.users.map((u) => [u.id, u]));
    for (const p of d.mirror.projects) {
      const overrun = budgetOverrunPct(p);
      if (overrun > d.settings.budgetThresholdPct && !d.emailDedupe.budget[p.id]) {
        const owner = userById.get(p.ownerId);
        if (owner?.email) {
          d.emailDedupe.budget[p.id] = nowIso();
          emails.push(
            sendHostEmail({
              to: owner.email,
              subject: `Budget threshold alert — ${p.name} (${p.psId})`,
              body: `Hello ${owner.name},\n\nYour project “${p.name}” (${p.psId}) has spent ₹${p.budgetSpentCr} Cr against a sanctioned ₹${p.budgetTotalCr} Cr — an overrun of ${overrun.toFixed(1)}% (alert threshold ${d.settings.budgetThresholdPct}%).\n\nThe host administrator has an escalation approval pending. Please review the budget dossier and respond with a variance note.\n\n— ProjectAssure Host Control · automated budget alert`,
              kind: "budget",
            }),
          );
        }
      } else if (overrun <= d.settings.budgetThresholdPct) {
        delete d.emailDedupe.budget[p.id]; // re-arm when back under threshold
      }
    }
  }

  // email jobs are all logged in the outbox; await so the current poll
  // response already includes them (sendHostEmail never throws)
  await Promise.allSettled(emails);

  audit(
    "sync.merged",
    "system",
    `snapshot merged (${source}) — ${d.mirror.users.length} users, ${d.mirror.projects.length} projects, pushedAt ${snapshot.pushedAt}`,
    "info",
  );
  scheduleSave();
  return true;
}

// ── Host state builder (the full GET /api/admin/sync payload) ──────────────

export function buildHostState(sessionEmail: string): HostStateResponse {
  const d = getStore().data;
  const mainUrl = effectiveMainUrl();

  const loginCounts: Record<string, number> = {};
  for (const l of d.mirror.loginFeed) {
    loginCounts[l.userId] = (loginCounts[l.userId] ?? 0) + 1;
  }

  const users: HostUserView[] = d.mirror.users.map((u) => {
    const rec: AccessRecord | undefined = d.access[u.id];
    return {
      ...u,
      loginCount: loginCounts[u.id] ?? 0,
      effectiveActive: u.isActive && rec?.active !== false,
      effectiveRole: rec?.roleOverride ?? u.role,
      hostManaged: Boolean(rec),
    };
  });

  let mirrorStatus: "empty" | "fresh" | "stale" = "empty";
  if (d.mirror.pushedAt) {
    const age = Date.now() - Date.parse(d.mirror.pushedAt);
    mirrorStatus = Number.isFinite(age) && age > FRESH_AFTER_MS ? "stale" : "fresh";
  }

  return {
    ok: true,
    serverTime: nowIso(),
    session: { email: sessionEmail },
    sync: {
      mainUrl,
      mode: "poll",
      mainReachable: d.sync.mainReachable,
      lastSyncAt: d.sync.lastSyncAt,
      lastOkSyncAt: d.sync.lastOkSyncAt,
      lastError: d.sync.lastError,
      revision: d.sync.revision,
      lastPushAt: d.sync.lastPushAt,
      lastWebhookAt: d.sync.lastWebhookAt,
      commandCount: d.sync.commandCount,
      pollCount: d.sync.pollCount,
      mirrorStatus,
    },
    mirror: {
      mirroredAt: d.mirror.mirroredAt,
      pushedAt: d.mirror.pushedAt,
      stats: d.mirror.stats,
      users: d.mirror.users,
      projects: d.mirror.projects,
      alerts: d.mirror.alerts.slice(0, 150),
      events: d.mirror.events.slice(0, 120),
      loginFeed: d.mirror.loginFeed.slice(0, 150),
      emails: d.mirror.emails.slice(0, 60),
    },
    users,
    approvals: d.approvals.slice(0, 120),
    broadcasts: d.broadcasts.slice(0, 40),
    outbox: d.outbox.slice(0, 150),
    audit: d.audit.slice(0, 300),
    access: Object.values(d.access),
    settings: d.settings,
    emailProvider: emailProviderLabel(),
  };
}

// ── AI context builder (grounding for the Intelligence Console) ────────────

export function buildAiContext(): string {
  const d = getStore().data;
  const s = d.mirror.stats;
  if (!s) return "No snapshot mirrored yet — host has no live data.";
  const worst = [...d.mirror.projects].sort((a, b) => a.health - b.health).slice(0, 6)
    .map((p) => `${p.psId} “${p.name}” health ${p.health}, progress ${p.progress}%, ₹${p.budgetSpentCr}/${p.budgetTotalCr} Cr, delayRisk ${p.delayRisk}`);
  const roles = d.mirror.users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});
  const openApprovals = d.approvals.filter((a) => a.status === "pending").length;
  return [
    `HOST SNAPSHOT (live mirror, pushedAt ${d.mirror.pushedAt ?? "—"})`,
    `Users: ${s.users} total (${s.registeredUsers} registered, ${s.demoUsers} demo). Roles: ${Object.entries(roles).map(([r, n]) => `${r}×${n}`).join(", ") || "—"} .`,
    `Projects: ${s.projects} total, ${s.activeProjects} active, ${s.criticalProjects} critical. Avg health ${s.avgHealth}.`,
    `Budget: ₹${s.budgetTotalCr} Cr sanctioned, ₹${s.budgetSpentCr} Cr spent.`,
    `Open alerts: ${s.openAlerts}. Pending host approvals: ${openApprovals}.`,
    `Lowest-health projects: ${worst.join(" ; ") || "—"}`,
    `Outbox: ${d.outbox.length} emails logged; provider ${emailProviderLabel()}.`,
  ].join("\n");
}

// ── Env checklist for the Integrations page ─────────────────────────────────

export function envChecklist(): EnvCheckItem[] {
  const items: [string, string, boolean, string][] = [
    ["MAIN_PROJECT_URL", "Main app URL", Boolean(process.env.MAIN_PROJECT_URL), "Where host polls /api/sync/state + posts /api/sync/webhook (default http://localhost:3000)"],
    ["SYNC_TOKEN", "Shared sync secret", Boolean(process.env.SYNC_TOKEN), "Optional HMAC-free shared token on host→main webhook + main→host push"],
    ["HOST_ADMIN_EMAIL", "Host admin email", Boolean(process.env.HOST_ADMIN_EMAIL), "Login identity (default cpo@mospi.gov.in)"],
    ["HOST_ADMIN_PASSWORD", "Host admin password", Boolean(process.env.HOST_ADMIN_PASSWORD), "Login secret (default hostoverseer — CHANGE IT)"],
    ["HOST_SESSION_SECRET", "Session signing secret", Boolean(process.env.HOST_SESSION_SECRET), "Optional; else derived from the admin password"],
    ["GEMINI_API_KEY", "Gemini REST key", Boolean(process.env.GEMINI_API_KEY), "Intelligence Console provider 1"],
    ["GROQ_API_KEY", "Groq key", Boolean(process.env.GROQ_API_KEY), "Intelligence Console provider 2"],
    ["EMAIL_USER", "SMTP user", Boolean(process.env.EMAIL_USER), "Automated email provider 1 (with EMAIL_PASS)"],
    ["EMAIL_PASS", "SMTP password", Boolean(process.env.EMAIL_PASS), "App password for EMAIL_USER"],
    ["SMTP_HOST", "SMTP host", Boolean(process.env.SMTP_HOST), "Optional (default smtp.gmail.com)"],
    ["SMTP_PORT", "SMTP port", Boolean(process.env.SMTP_PORT), "Optional (465 implicit TLS / 587 STARTTLS)"],
    ["BREVO_API_KEY", "Brevo API key", Boolean(process.env.BREVO_API_KEY), "Automated email provider 2 (300/day free)"],
    ["RESEND_API_KEY", "Resend API key", Boolean(process.env.RESEND_API_KEY), "Automated email provider 3"],
    ["ALERT_EMAIL_FROM", "Verified sender", Boolean(process.env.ALERT_EMAIL_FROM), "Optional From address for Brevo/Resend"],
  ];
  return items.map(([key, label, set, purpose]) => ({ key, label, set, purpose }));
}
