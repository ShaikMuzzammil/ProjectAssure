"use client";
/**
 * ProjectAssure Sync client (browser side)
 * -----------------------------------------
 * Pushes a redacted portfolio snapshot to the main app's Sync Hub
 * (POST /api/sync/push, same origin) so the Host Control platform can
 * see users, projects, alerts and logins live — and polls
 * GET /api/sync/commands for Host broadcasts that become notifications.
 *
 * All traffic is best-effort: the app is fully usable offline.
 */

import type { SyncSnapshot, SyncCommand, SyncApprovalRequest } from "./types";
import type { Project, User, Notification, EmailMessage, AuditLogEntry, LiveEvent } from "@/lib/projectassure/types";

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

export function buildSyncSnapshot(args: {
  projects: Project[];
  users: User[];
  notifications: Notification[];
  emails: EmailMessage[];
  audit: AuditLogEntry[];
  liveEvents: LiveEvent[];
  approvalRequests?: SyncApprovalRequest[];
}): SyncSnapshot {
  const { projects, users, notifications, emails, audit, liveEvents, approvalRequests } = args;
  const active = projects.filter((p) => p.status === "ACTIVE" || p.status === "ON_HOLD");
  const critical = projects.filter((p) => p.healthStatus === "CRITICAL");
  const loginFeed = audit
    .filter((a) => a.action === "LOGIN" || a.action === "REGISTER")
    .slice(0, 40)
    .map((a) => ({
      id: a.id,
      userId: a.entityId ?? a.userName,
      userName: a.userName,
      at: a.timestamp,
    }));

  return {
    pushedAt: new Date().toISOString(),
    stats: {
      users: users.length,
      registeredUsers: users.filter((u) => u.source === "registered").length,
      demoUsers: users.filter((u) => u.source === "demo").length,
      projects: projects.length,
      activeProjects: active.length,
      criticalProjects: critical.length,
      openAlerts: projects.reduce((n, p) => n + p.alerts.filter((a) => !a.isRead).length, 0),
      budgetTotalCr: Math.round(projects.reduce((n, p) => n + p.totalBudget, 0) / 100),
      budgetSpentCr: Math.round(projects.reduce((n, p) => n + p.spentBudget, 0) / 100),
      avgHealth: projects.length
        ? Math.round(projects.reduce((n, p) => n + p.healthScore, 0) / projects.length)
        : 0,
    },
    users: users.slice(0, 60).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      source: u.source ?? "demo",
      designation: u.designation,
      department: u.departmentId,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      projectCount: projects.filter((p) => p.ownerId === u.id).length,
      notificationCount: notifications.filter((n) => n.userId === u.id).length,
      unreadAlerts: projects
        .filter((p) => p.ownerId === u.id)
        .reduce((n, p) => n + p.alerts.filter((a) => !a.isRead).length, 0),
    })),
    projects: projects.slice(0, 120).map((p) => ({
      id: p.id,
      psId: p.psId,
      name: p.name,
      department: p.departmentId,
      state: p.state,
      district: p.district,
      sector: p.sector,
      status: p.status,
      progress: Math.round(p.progress),
      health: Math.round(p.healthScore),
      budgetTotalCr: Math.round(p.totalBudget / 100), // lakh → crore (2dp-safe)
      budgetSpentCr: Math.round(p.spentBudget / 100),
      delayRisk: p.prediction ? Math.round(p.prediction.probability * 100) : 0,
      ownerId: p.ownerId ?? "u-sec",
      ownerName: p.projectManager,
      milestonesTotal: p.milestones?.length ?? 0,
      milestonesCompleted: p.milestones?.filter((m) => m.status === "COMPLETED").length ?? 0,
      milestonesDelayed: p.milestones?.filter((m) => m.status === "DELAYED").length ?? 0,
      lastActivityAt: p.healthComputedAt,
      approvalStatus: p.approvalStatus,
      documentsTotal: p.documents?.length ?? 0,
      evidenceTotal: p.evidence?.length ?? 0,
      documentIds: (p.documents ?? []).slice(0, 12).map((d) => d.id),
      evidenceIds: (p.evidence ?? []).slice(0, 12).map((e) => e.id),
    })),
    alerts: projects
      .flatMap((p) =>
        p.alerts.slice(0, 6).map((a) => ({
          id: a.id,
          severity: (a.severity === "CRITICAL" ? "critical" : a.severity === "HIGH" || a.severity === "MEDIUM" ? "warning" : "info") as "critical" | "warning" | "info",
          title: a.title,
          projectName: p.name,
          projectPsId: p.psId,
          pathway: (p.ownerId ?? "").startsWith("u-reg") ? "fresh" : "demo",
          createdAt: a.createdAt,
          status: a.isRead ? "read" : "open",
        }))
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 60),
    events: liveEvents.slice(0, 40).map((e) => ({
      id: e.id,
      kind: e.kind,
      title: e.title,
      at: e.at,
      projectId: e.projectId,
    })),
    emails: emails.slice(0, 40).map((e) => ({
      id: e.id,
      to: e.to,
      subject: e.subject,
      status: e.status,
      at: e.createdAt,
    })),
    loginFeed,
    approvalRequests: (approvalRequests ?? []).slice(0, 40),
  };
}

/** Debounced push (3s) so bursts of mutations result in one request. */
export function scheduleSync(getState: () => { buildArgs: () => ReturnType<typeof buildSyncSnapshot> }) {
  if (typeof window === "undefined") return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      const snapshot = getState().buildArgs();
      await fetch("/api/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
    } catch {
      /* offline — fine */
    }
  }, 3000);
}

export async function pushSyncNow(snapshot: SyncSnapshot) {
  try {
    await fetch("/api/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
    return true;
  } catch {
    return false;
  }
}

/** Poll Host Control commands for this user; returns commands to apply. */
export async function pollCommands(clientId: string, sinceIso?: string): Promise<SyncCommand[]> {
  try {
    const url = `/api/sync/commands?client=${encodeURIComponent(clientId)}${sinceIso ? `&since=${encodeURIComponent(sinceIso)}` : ""}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.commands) ? (data.commands as SyncCommand[]) : [];
  } catch {
    return [];
  }
}

/** v23: 8-second poll — host decisions reach the browser in near-real-time. */
export function startCommandPolling(clientIdFn: () => string | null, onCommands: (cmds: SyncCommand[]) => void, intervalMs = 8000) {
  if (typeof window === "undefined" || pollTimer) return;
  pollTimer = setInterval(async () => {
    const clientId = clientIdFn();
    if (!clientId) return;
    const cmds = await pollCommands(clientId);
    if (cmds.length) onCommands(cmds);
  }, intervalMs);
}

export function stopCommandPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
