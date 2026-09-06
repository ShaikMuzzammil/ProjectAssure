"use client";

// User detail drawer — separate sections (Profile / Security / Projects /
// Alerts / Activity) + REAL host actions: access toggle, role change, direct
// alert (main-app webhook), direct email (host mailer).

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Briefcase,
  Clock,
  Fingerprint,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserCog,
  Users2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  Dialog,
  FieldLabel,
  Input,
  Progress,
  Select,
  Textarea,
  severityTone,
} from "./ui";
import { fmtDateTime, healthBand, initials, relTime } from "@/lib/host/format";
import type { HostStateResponse, HostUserView, Severity } from "@/lib/host/types";

const TABS = [
  { id: "profile", label: "Profile", icon: Fingerprint },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "projects", label: "Projects", icon: Briefcase },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "activity", label: "Activity", icon: Clock },
] as const;

type TabId = (typeof TABS)[number]["id"];

const ROLE_OPTIONS = ["ADMIN", "PM", "STAKEHOLDER", "VIEWER"];

export function UserDrawer({
  user,
  onClose,
  state,
  refresh,
}: {
  user: HostUserView | null;
  onClose: () => void;
  state: HostStateResponse;
  refresh: (force?: boolean) => Promise<void>;
}) {
  const [tab, setTab] = useState<TabId>("profile");
  const [busy, setBusy] = useState<string | null>(null);
  const [roleDraft, setRoleDraft] = useState("");
  const [alertOpen, setAlertOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [alertForm, setAlertForm] = useState({ title: "", message: "", severity: "info" as Severity });
  const [emailForm, setEmailForm] = useState({ subject: "", body: "" });

  // keep role draft in sync when a new user opens
  const liveUser = useMemo(() => (user ? state.users.find((u) => u.id === user.id) ?? user : null), [user, state.users]);

  const projects = useMemo(
    () => (liveUser ? state.mirror.projects.filter((p) => p.ownerId === liveUser.id) : []),
    [state.mirror.projects, liveUser],
  );
  const projectPsIds = useMemo(() => new Set(projects.map((p) => p.psId)), [projects]);
  const alerts = useMemo(
    () => (liveUser ? state.mirror.alerts.filter((a) => projectPsIds.has(a.projectPsId ?? "")).slice(0, 40) : []),
    [state.mirror.alerts, liveUser, projectPsIds],
  );
  const logins = useMemo(
    () => (liveUser ? state.mirror.loginFeed.filter((l) => l.userId === liveUser.id).slice(0, 40) : []),
    [state.mirror.loginFeed, liveUser],
  );
  const userAudit = useMemo(
    () => (liveUser ? state.audit.filter((a) => (a.detail ?? "").toLowerCase().includes(liveUser.email.toLowerCase())).slice(0, 12) : []),
    [state.audit, liveUser],
  );
  const accessRecord = useMemo(
    () => (liveUser ? state.access.find((a) => a.userId === liveUser.id) : null),
    [state.access, liveUser],
  );

  async function act(action: string, extra: Record<string, unknown> = {}, successText: string) {
    if (!liveUser) return;
    setBusy(action);
    try {
      const res = await fetch("/api/host/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: liveUser.id, action, ...extra }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        note?: string;
        notified?: boolean;
        error?: string;
        entry?: { status?: string; provider?: string; reason?: string };
      };
      if (res.ok && data.ok !== false) {
        toast.success(successText, { description: data.note ?? (data.entry ? `${data.entry.status} via ${data.entry.provider}` : undefined) });
        await refresh(true);
      } else {
        toast.error("Action failed", { description: data.error ?? data.note ?? `HTTP ${res.status}` });
      }
    } catch (e) {
      toast.error("Action failed", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (!liveUser) return null;

  return (
    <>
      {/* Drawer */}
      <DrawerShell open={Boolean(liveUser)} onClose={onClose}>
        {/* header */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#072b49] text-sm font-bold text-white" aria-hidden>
            {initials(liveUser.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-slate-900 dark:text-slate-100">{liveUser.name}</h2>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{liveUser.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={liveUser.effectiveRole === "ADMIN" ? "navy" : "sky"}>{liveUser.effectiveRole}</Badge>
            <Badge tone={liveUser.source === "registered" ? "green" : "slate"}>{liveUser.source}</Badge>
            {liveUser.effectiveActive ? <Badge tone="green">active</Badge> : <Badge tone="red">restricted</Badge>}
          </div>
        </div>

        {/* action bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/60">
          <Button
            size="sm"
            variant={liveUser.effectiveActive ? "danger" : "success"}
            loading={busy === "deactivate" || busy === "activate"}
            onClick={() =>
              void act(
                liveUser.effectiveActive ? "deactivate" : "activate",
                {},
                liveUser.effectiveActive ? "Access restricted + user notified" : "Access restored + user notified",
              )
            }
          >
            <UserCog className="h-3.5 w-3.5" />
            {liveUser.effectiveActive ? "Restrict access" : "Restore access"}
          </Button>
          <div className="flex items-center gap-1.5">
            <Select
              aria-label="Change role"
              value={roleDraft || liveUser.effectiveRole}
              onChange={(e) => setRoleDraft(e.target.value)}
              className="h-8 text-xs"
            >
              {Array.from(new Set([...ROLE_OPTIONS, liveUser.effectiveRole])).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
            <Button
              size="sm"
              variant="outline"
              loading={busy === "role"}
              disabled={!roleDraft || roleDraft === liveUser.effectiveRole}
              onClick={() => void act("role", { value: roleDraft }, `Role set to ${roleDraft} + user notified`)}
            >
              Apply role
            </Button>
          </div>
          <Button size="sm" variant="navy" onClick={() => setAlertOpen(true)}>
            <Bell className="h-3.5 w-3.5" /> Direct alert
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>
            <Mail className="h-3.5 w-3.5" /> Send email
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void refresh(true)} title="Force sync then re-read">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
          {TABS.map((t) => {
            const Icon = t.icon;
            const count =
              t.id === "projects" ? projects.length : t.id === "alerts" ? alerts.length : t.id === "activity" ? logins.length : undefined;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
                  tab === t.id ? "bg-[#072b49] text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
                )}
                aria-current={tab === t.id ? "true" : undefined}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {t.label}
                {count !== undefined && count > 0 ? (
                  <span className={cn("rounded-full px-1.5 text-[10px] font-bold", tab === t.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300")}>
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* sections */}
        <div className="host-scroll min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50 p-5 dark:bg-slate-950">
          {tab === "profile" ? (
            <Card>
              <SectionTitle icon={<Fingerprint className="h-4 w-4" />} title="Profile" />
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-2">
                <Field term="Full name" def={liveUser.name} />
                <Field term="Email" def={liveUser.email} />
                <Field term="Role" def={liveUser.effectiveRole + (liveUser.hostManaged ? " (host-set)" : "")} />
                <Field term="Designation" def={liveUser.designation ?? "—"} />
                <Field term="Department" def={liveUser.department ?? "—"} />
                <Field term="Source" def={liveUser.source} />
                <Field term="Created" def={liveUser.createdAt ? fmtDateTime(liveUser.createdAt) : "not in snapshot"} />
                <Field term="Account ID" def={liveUser.id} mono />
                <Field term="Notifications" def={`${liveUser.notificationCount} in main app`} />
                <Field term="Unread alerts" def={String(liveUser.unreadAlerts)} />
              </dl>
            </Card>
          ) : null}

          {tab === "security" ? (
            <div className="space-y-4">
              <Card>
                <SectionTitle icon={<ShieldCheck className="h-4 w-4" />} title="Security" />
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-2">
                  <Field term="App status" def={liveUser.isActive ? "active in main app" : "inactive in main app"} />
                  <Field
                    term="Host access flag"
                    def={accessRecord ? (accessRecord.active ? "granted by host" : "restricted by host") : "not managed by host yet"}
                  />
                  <Field term="Effective status" def={liveUser.effectiveActive ? "ACTIVE" : "RESTRICTED"} tone={liveUser.effectiveActive ? "ok" : "bad"} />
                  <Field term="Logins (snapshot feed)" def={String(liveUser.loginCount)} />
                  <Field term="Last login" def={liveUser.lastLoginAt ? `${fmtDateTime(liveUser.lastLoginAt)} (${relTime(liveUser.lastLoginAt)})` : "never"} />
                  <Field
                    term="Host role override"
                    def={accessRecord?.roleOverride ? `${accessRecord.roleOverride} since ${relTime(accessRecord.changedAt)}` : "none"}
                  />
                </dl>
              </Card>
              <Card>
                <SectionTitle icon={<Users2 className="h-4 w-4" />} title="Recent host actions on this account" />
                <div className="host-scroll max-h-56 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                  {userAudit.length === 0 ? (
                    <p className="px-5 py-4 text-xs text-slate-400">No host actions on this account yet.</p>
                  ) : (
                    userAudit.map((a) => (
                      <div key={a.id} className="flex items-start gap-2 px-5 py-2.5 text-xs">
                        <Badge tone={severityTone(a.severity)}>{a.action}</Badge>
                        <p className="min-w-0 flex-1 text-slate-600 dark:text-slate-300">{a.detail}</p>
                        <span className="shrink-0 text-[10px] text-slate-400">{relTime(a.at)}</span>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          ) : null}

          {tab === "projects" ? (
            <Card>
              <SectionTitle icon={<Briefcase className="h-4 w-4" />} title={`Projects owned (${projects.length})`} />
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {projects.length === 0 ? (
                  <p className="px-5 py-4 text-xs text-slate-400">This user owns no projects in the current snapshot.</p>
                ) : (
                  projects.map((p) => {
                    const band = healthBand(p.health);
                    const overrun = p.budgetTotalCr > 0 ? ((p.budgetSpentCr - p.budgetTotalCr) / p.budgetTotalCr) * 100 : 0;
                    return (
                      <div key={p.id} className="px-5 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                            {p.psId} · {p.name}
                          </p>
                          <Badge tone={band.tone}>{band.label} {p.health}</Badge>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-3 text-[11px] text-slate-500 dark:text-slate-400 sm:grid-cols-4">
                          <span>progress {p.progress}%</span>
                          <span>₹{p.budgetSpentCr} / ₹{p.budgetTotalCr} Cr</span>
                          <span className={overrun > 0 ? "font-semibold text-rose-600" : ""}>
                            {overrun > 0 ? `overrun ${overrun.toFixed(0)}%` : "within budget"}
                          </span>
                          <span>
                            milestones {p.milestonesCompleted}/{p.milestonesTotal} · {p.milestonesDelayed} delayed
                          </span>
                        </div>
                        <div className="mt-1.5">
                          <Progress value={p.progress} tone={band.tone === "green" ? "green" : band.tone === "amber" ? "amber" : "red"} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          ) : null}

          {tab === "alerts" ? (
            <Card>
              <SectionTitle icon={<Bell className="h-4 w-4" />} title={`Alerts on their projects (${alerts.length})`} />
              <div className="host-scroll max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                {alerts.length === 0 ? (
                  <p className="px-5 py-4 text-xs text-slate-400">No alerts on this user&apos;s projects in the current snapshot.</p>
                ) : (
                  alerts.map((a) => (
                    <div key={a.id} className="flex items-start gap-2 px-5 py-2.5 text-xs">
                      <Badge tone={severityTone(a.severity)}>{a.severity}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-700 dark:text-slate-200">{a.title}</p>
                        <p className="text-[10px] text-slate-400">
                          {a.projectName ?? a.projectPsId ?? "portfolio"} · {a.pathway} · {a.status}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] text-slate-400">{relTime(a.createdAt)}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          ) : null}

          {tab === "activity" ? (
            <Card>
              <SectionTitle icon={<Clock className="h-4 w-4" />} title={`Login history (${logins.length} in feed)`} />
              <div className="host-scroll max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                {logins.length === 0 ? (
                  <p className="px-5 py-4 text-xs text-slate-400">No logins recorded for this user in the snapshot login feed yet.</p>
                ) : (
                  logins.map((l) => (
                    <div key={l.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                        <span className="text-slate-600 dark:text-slate-300">login{l.ip ? ` · IP ${l.ip}` : ""}</span>
                      </div>
                      <span className="shrink-0 text-[10px] text-slate-400">{fmtDateTime(l.at)} · {relTime(l.at)}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          ) : null}
        </div>
      </DrawerShell>

      {/* direct alert dialog → main-app webhook */}
      <Dialog
        open={alertOpen}
        onClose={() => setAlertOpen(false)}
        title={`Direct alert → ${liveUser.name}`}
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] leading-relaxed text-slate-400">
              Queued on the main sync hub — the user sees it as a real notification + toast within ~20s.
            </p>
            <Button
              variant="navy"
              size="sm"
              loading={busy === "alert"}
              disabled={!alertForm.title.trim() || !alertForm.message.trim()}
              onClick={async () => {
                await act("alert", { ...alertForm }, `Alert queued for ${liveUser.name}`);
                setAlertOpen(false);
                setAlertForm({ title: "", message: "", severity: "info" });
              }}
            >
              <Bell className="h-3.5 w-3.5" /> Send alert
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <FieldLabel htmlFor="ua-title">Title</FieldLabel>
            <Input id="ua-title" value={alertForm.title} onChange={(e) => setAlertForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Action required: variance note" />
          </div>
          <div>
            <FieldLabel htmlFor="ua-msg">Message</FieldLabel>
            <Textarea id="ua-msg" rows={4} value={alertForm.message} onChange={(e) => setAlertForm((f) => ({ ...f, message: e.target.value }))} placeholder="Delivered to their main-app notifications…" />
          </div>
          <div>
            <FieldLabel htmlFor="ua-sev">Severity</FieldLabel>
            <Select id="ua-sev" value={alertForm.severity} onChange={(e) => setAlertForm((f) => ({ ...f, severity: e.target.value as Severity }))}>
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="critical">critical</option>
            </Select>
          </div>
        </div>
      </Dialog>

      {/* direct email dialog → host mailer */}
      <Dialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        title={`Email → ${liveUser.email}`}
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] leading-relaxed text-slate-400">
              Sent via the host provider chain (SMTP / Brevo / Resend). With no provider configured it is recorded honestly as SIMULATED.
            </p>
            <Button
              variant="primary"
              size="sm"
              loading={busy === "email"}
              disabled={!emailForm.subject.trim()}
              onClick={async () => {
                await act("email", { title: emailForm.subject, message: emailForm.body }, "Email processed");
                setEmailOpen(false);
                setEmailForm({ subject: "", body: "" });
              }}
            >
              <Mail className="h-3.5 w-3.5" /> Send email
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <FieldLabel htmlFor="ue-subj">Subject</FieldLabel>
            <Input id="ue-subj" value={emailForm.subject} onChange={(e) => setEmailForm((f) => ({ ...f, subject: e.target.value }))} placeholder="e.g. Account review complete" />
          </div>
          <div>
            <FieldLabel htmlFor="ue-body">Body</FieldLabel>
            <Textarea id="ue-body" rows={6} value={emailForm.body} onChange={(e) => setEmailForm((f) => ({ ...f, body: e.target.value }))} placeholder="Plain text; **bold** and *italic* supported…" />
          </div>
        </div>
      </Dialog>
    </>
  );
}

// Lightweight drawer wrapper (so this file stays self-contained).
function DrawerShell({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            className="ml-auto flex h-full w-full max-w-2xl flex-col bg-slate-50 shadow-2xl dark:bg-slate-950"
            onClick={(e) => e.stopPropagation()}
            role="complementary"
            aria-label="User details"
          >
            <button
              onClick={onClose}
              aria-label="Close panel"
              className="absolute right-3 top-3 z-10 rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
            {children}
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#072b49]/5 text-[#072b49] dark:bg-sky-400/10 dark:text-sky-300">{icon}</span>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
    </div>
  );
}

function Field({ term, def, mono, tone }: { term: string; def: string; mono?: boolean; tone?: "ok" | "bad" }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{term}</dt>
      <dd
        className={cn(
          "mt-0.5 break-words text-xs text-slate-800 dark:text-slate-200",
          mono && "font-mono text-[10px]",
          tone === "ok" && "font-bold text-emerald-600 dark:text-emerald-400",
          tone === "bad" && "font-bold text-rose-600 dark:text-rose-400",
        )}
      >
        {def}
      </dd>
    </div>
  );
}
