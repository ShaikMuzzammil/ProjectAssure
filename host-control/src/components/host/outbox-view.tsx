"use client";

// Email Outbox — the automated alert engine control panel:
//   · toggles + threshold (persisted in the host store)
//   · provider status (SMTP / Brevo / Resend, honest when unconfigured)
//   · the outbox log: every email with status SENT / SIMULATED / FAILED
//   · manual composer (goes through the same provider chain)

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Mail, MailWarning, Send, Settings2, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, CardHead, FieldLabel, Input, PageIntro, Textarea, Toggle } from "./ui";
import { relTime } from "@/lib/host/format";
import type { EmailLogEntry } from "@/lib/host/types";
import type { ViewProps } from "./view-props";

interface EmailStatus {
  provider: string;
  smtp: { configured: boolean; host: string; port: number; from: string | null; verify: { ok: boolean; detail: string } | null };
  brevo: { configured: boolean };
  resend: { configured: boolean };
  sender: string | null;
  checkedAt: string;
}

export function OutboxView({ state, refresh }: ViewProps) {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  // local draft override: the mirrored settings win until the admin edits
  const [draft, setDraft] = useState<{ login: boolean; budget: boolean; threshold: string } | null>(null);
  const loginAlerts = draft?.login ?? state.settings.loginAlerts;
  const budgetAlerts = draft?.budget ?? state.settings.budgetAlerts;
  const threshold = draft?.threshold ?? String(state.settings.budgetThresholdPct);
  const [composeOpen, setComposeOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [compose, setCompose] = useState({ to: "", subject: "", body: "" });
  const [statusFilter, setStatusFilter] = useState("all");

  const loadStatus = useCallback(async (verify = false) => {
    if (verify) setStatusBusy(true);
    try {
      const res = await fetch(`/api/email/status${verify ? "?verify=1" : ""}`, { cache: "no-store" });
      if (res.ok) setStatus((await res.json()) as EmailStatus);
    } catch {
      /* keep last status */
    } finally {
      if (verify) setStatusBusy(false);
    }
  }, []);

  useEffect(() => {
    // kick the first status load off the synchronous effect path (0ms timer)
    const kickoff = setTimeout(() => void loadStatus(), 0);
    return () => clearTimeout(kickoff);
  }, [loadStatus]);

  async function saveSettings() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginAlerts,
          budgetAlerts,
          budgetThresholdPct: Number(threshold) || 0,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; changed?: boolean; error?: string };
      if (res.ok && data.ok) {
        toast.success(data.changed ? "Alert settings saved" : "No changes to save", {
          description: `login emails ${loginAlerts ? "ON" : "OFF"} · budget emails ${budgetAlerts ? "ON" : "OFF"} · threshold ${threshold}%`,
        });
        setDraft(null); // mirror-driven values take over again
        await refresh(true);
      } else {
        toast.error("Could not save settings", { description: data.error ?? `HTTP ${res.status}` });
      }
    } catch (e) {
      toast.error("Could not save settings", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function sendManual() {
    setSending(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(compose),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; entry?: EmailLogEntry; error?: string };
      if (res.ok && data.ok && data.entry) {
        if (data.entry.status === "SENT") {
          toast.success(`Email SENT via ${data.entry.provider}`, { description: `to ${data.entry.to}` });
        } else if (data.entry.status === "SIMULATED") {
          toast.info("Email recorded as SIMULATED", { description: data.entry.reason });
        } else {
          toast.warning("Email FAILED", { description: data.entry.reason });
        }
        setCompose({ to: "", subject: "", body: "" });
        setComposeOpen(false);
        await refresh(true);
      } else {
        toast.error("Send failed", { description: (data.entry?.reason as string) ?? data.error ?? `HTTP ${res.status}` });
      }
    } catch (e) {
      toast.error("Send failed", { description: (e as Error).message });
    } finally {
      setSending(false);
    }
  }

  const outbox = statusFilter === "all" ? state.outbox : state.outbox.filter((e) => e.status === statusFilter);
  const counts = {
    SENT: state.outbox.filter((e) => e.status === "SENT").length,
    SIMULATED: state.outbox.filter((e) => e.status === "SIMULATED").length,
    FAILED: state.outbox.filter((e) => e.status === "FAILED").length,
  };

  return (
    <div className="space-y-4">
      <PageIntro
        title="Automated Email Alerts"
        description="On every successful sync the host detects new logins, budget breaches and new registered accounts, and emails the users through its provider chain (SMTP → Brevo → Resend). Without any provider configured every send is recorded honestly as SIMULATED."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        {/* automation settings */}
        <Card>
          <CardHead title="Automation settings" subtitle="persisted in the host store, applied on every merge" icon={<Settings2 className="h-4 w-4" />} />
          <div className="space-y-4 px-5 py-4">
            <Toggle
              checked={loginAlerts}
              onChange={(next) => setDraft({ login: next, budget: budgetAlerts, threshold })}
              label="Login alert emails"
              id="t-login"
            />
            <p className="-mt-2 text-[10px] leading-relaxed text-slate-400">
              New login events in the snapshot feed (not yet emailed) → “New login to your ProjectAssure account”.
            </p>
            <Toggle
              checked={budgetAlerts}
              onChange={(next) => setDraft({ login: loginAlerts, budget: next, threshold })}
              label="Budget breach emails"
              id="t-budget"
            />
            <div>
              <FieldLabel htmlFor="t-threshold">Budget overrun threshold (%)</FieldLabel>
              <Input
                id="t-threshold"
                type="number"
                min={0}
                max={200}
                value={threshold}
                onChange={(e) => setDraft({ login: loginAlerts, budget: budgetAlerts, threshold: e.target.value })}
                className="w-28"
              />
              <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                A project spending more than {Number(threshold) || 0}% over its sanctioned budget triggers an escalation approval + owner email (re-arms when back under).
              </p>
            </div>
            <Button size="sm" variant="navy" loading={saving} onClick={() => void saveSettings()} className="w-full">
              Save settings
            </Button>
          </div>
        </Card>

        {/* provider status */}
        <Card>
          <CardHead
            title="Email provider"
            subtitle="provider chain: SMTP → Brevo → Resend → SIMULATED"
            icon={<Mail className="h-4 w-4" />}
            right={
              <Button size="sm" variant="outline" loading={statusBusy} onClick={() => void loadStatus(true)}>
                Verify SMTP
              </Button>
            }
          />
          <div className="space-y-2.5 px-5 py-4 text-xs">
            <p>
              Active provider: <span className="font-bold text-[#072b49] dark:text-sky-300">{status?.provider ?? state.emailProvider}</span>
            </p>
            <Row ok={status?.smtp.configured} label={`SMTP ${status?.smtp.host ?? "smtp.gmail.com"}:${status?.smtp.port ?? 465}`} note={status?.smtp.from ?? "EMAIL_USER unset"} />
            <Row ok={status?.brevo.configured} label="Brevo HTTP API" note="BREVO_API_KEY · 300/day free" />
            <Row ok={status?.resend.configured} label="Resend HTTP API" note="RESEND_API_KEY" />
            {status?.smtp.verify ? (
              <p className={`flex items-start gap-1.5 text-[11px] leading-relaxed ${status.smtp.verify.ok ? "text-emerald-600" : "text-rose-600"}`}>
                {status.smtp.verify.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                {status.smtp.verify.detail}
              </p>
            ) : null}
            {counts.SIMULATED > 0 && !status?.smtp.configured && !status?.brevo.configured && !status?.resend.configured ? (
              <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <ShieldQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                No provider configured — {counts.SIMULATED} email(s) recorded as SIMULATED. Add EMAIL_USER+EMAIL_PASS (Gmail App Password), BREVO_API_KEY or RESEND_API_KEY, then redeploy.
              </p>
            ) : null}
            <Button size="sm" variant="outline" className="mt-1 w-full" onClick={() => setComposeOpen(true)}>
              <Send className="h-3.5 w-3.5" /> Compose manual email
            </Button>
          </div>
        </Card>

        {/* quick stats */}
        <Card>
          <CardHead title="Outbox stats" subtitle="this host instance" icon={<MailWarning className="h-4 w-4" />} />
          <div className="grid grid-cols-3 gap-2 px-5 py-4 text-center">
            <div className="rounded-xl bg-emerald-50 py-3 dark:bg-emerald-500/10">
              <p className="text-xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">{counts.SENT}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700/70 dark:text-emerald-300/70">sent</p>
            </div>
            <div className="rounded-xl bg-slate-100 py-3 dark:bg-slate-800">
              <p className="text-xl font-extrabold tabular-nums text-slate-600 dark:text-slate-300">{counts.SIMULATED}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">simulated</p>
            </div>
            <div className="rounded-xl bg-rose-50 py-3 dark:bg-rose-500/10">
              <p className="text-xl font-extrabold tabular-nums text-rose-600 dark:text-rose-400">{counts.FAILED}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700/70 dark:text-rose-300/70">failed</p>
            </div>
          </div>
          <p className="px-5 pb-4 text-[10px] leading-relaxed text-slate-400">
            Every automated and manual email is logged here — statuses are never faked. SENT = delivered by a real provider, SIMULATED = no provider configured, FAILED = provider error (reason kept).
          </p>
        </Card>
      </div>

      {/* outbox log */}
      <Card className="overflow-hidden">
        <CardHead
          title="Outbox log"
          subtitle={`${state.outbox.length} emails logged (login / budget / welcome / admin / manual)`}
          icon={<Clock className="h-4 w-4" />}
          right={
            <div className="flex gap-1">
              {["all", "SENT", "SIMULATED", "FAILED"].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    statusFilter === f ? "bg-[#072b49] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          }
        />
        <div className="host-scroll max-h-[32rem] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
          {outbox.length === 0 ? (
            <p className="px-5 py-8 text-center text-xs text-slate-400">
              No emails yet. Automated jobs fire on the next snapshot merge when logins, budget breaches or new accounts are detected.
            </p>
          ) : (
            outbox.map((e) => (
              <div key={e.id} className="flex items-start gap-3 px-5 py-3">
                <EmailStatusIcon status={e.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{e.subject}</p>
                    <Badge tone={e.kind === "manual" ? "sky" : e.kind === "login" ? "green" : e.kind === "budget" ? "orange" : "violet"}>{e.kind}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">to {e.to}</p>
                  {e.reason ? <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-slate-400">{e.reason}</p> : null}
                </div>
                <div className="shrink-0 text-right">
                  <Badge tone={e.status === "SENT" ? "green" : e.status === "SIMULATED" ? "slate" : "red"}>{e.status}</Badge>
                  <p className="mt-1 text-[10px] text-slate-400">{relTime(e.at)}</p>
                  <p className="text-[9px] text-slate-300">{e.provider}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* manual composer */}
      {composeOpen ? (
        <Card>
          <CardHead title="Compose email" subtitle="goes through the host provider chain and is logged in the outbox" icon={<Send className="h-4 w-4" />} />
          <div className="space-y-3 px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="m-to">To</FieldLabel>
                <Input id="m-to" type="email" value={compose.to} onChange={(e) => setCompose((c) => ({ ...c, to: e.target.value }))} placeholder="user@example.gov.in" />
              </div>
              <div>
                <FieldLabel htmlFor="m-subj">Subject</FieldLabel>
                <Input id="m-subj" value={compose.subject} onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))} />
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="m-body">Body</FieldLabel>
              <Textarea id="m-body" rows={5} value={compose.body} onChange={(e) => setCompose((c) => ({ ...c, body: e.target.value }))} placeholder="**bold** supported" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" loading={sending} disabled={!compose.to || !compose.subject} onClick={() => void sendManual()}>
                <Send className="h-3.5 w-3.5" /> Send
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setComposeOpen(false)}>Close</Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function EmailStatusIcon({ status }: { status: EmailLogEntry["status"] }) {
  if (status === "SENT") return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="sent" />;
  if (status === "SIMULATED") return <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-label="simulated" />;
  return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-label="failed" />;
}

function Row({ ok, label, note }: { ok?: boolean; label: string; note: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
      <span className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} aria-hidden />
        <span className={ok ? "font-semibold text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}>{label}</span>
      </span>
      <span className="truncate text-[10px] text-slate-400" title={note}>{note}</span>
    </div>
  );
}
