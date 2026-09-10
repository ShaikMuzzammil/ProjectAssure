"use client";

// v23 — Host Control Settings panel.
// Lets the host admin:
//   - Change the host admin password (for the env-configured account).
//     Requires the current password to be entered; new password must meet
//     the policy. On Vercel the change is per-lambda-instance (the env var
//     is the source of truth — documented below).
//   - Toggle the login/budget email automations.
//   - Set the budget breach threshold %.
//   - Inspect the persistence mode (JSON file vs in-memory) and where to
//     change the env vars.
// All changes are persisted via /api/admin/settings + /api/admin/auth/*.

import { useState, useEffect } from "react";
import { KeyRound, Loader2, Lock, Mail, Save, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHead, FieldLabel, Input, PageIntro, Toggle } from "./ui";
import type { ViewProps } from "./view-props";

interface SettingsResponse {
  ok: boolean;
  settings: { mainUrlOverride: string | null; loginAlerts: boolean; budgetAlerts: boolean; budgetThresholdPct: number };
  mainUrl: string;
  persistence?: { mode: string; warning: string };
}

export function SettingsView({ state, refresh, onLogout }: ViewProps & { onLogout: () => void }) {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [saving, setSaving] = useState<null | "alerts" | "threshold" | "password">(null);

  // password change form state
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      if (res.ok) setData((await res.json()) as SettingsResponse);
    } catch { /* keep last */ }
  }

  // load once on mount — proper useEffect, no side effect in render
  useEffect(() => {
    void load();
  }, []);

  const s = data?.settings ?? state.settings;
  const persistence = data?.persistence;

  async function patchAlerts(field: "loginAlerts" | "budgetAlerts", next: boolean) {
    setSaving("alerts");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: next }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; changed?: boolean; note?: string };
      if (res.ok && d.ok) {
        toast.success(`${field === "loginAlerts" ? "Login alert emails" : "Budget breach emails"} ${next ? "ON" : "OFF"}`, {
          description: d.changed === false ? "No change — value matched." : "Saved.",
        });
        await load();
      } else {
        toast.error("Could not update", { description: d.note ?? `HTTP ${res.status}` });
      }
    } finally {
      setSaving(null);
    }
  }

  async function patchThreshold(value: number) {
    setSaving("threshold");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetThresholdPct: value }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; changed?: boolean; note?: string };
      if (res.ok && d.ok) {
        toast.success("Threshold updated", {
          description: d.changed === false ? "No change — value matched." : `Budget breach threshold now ${value}%.`,
        });
        await load();
        await refresh(true);
      } else {
        toast.error("Could not update threshold", { description: d.note ?? `HTTP ${res.status}` });
      }
    } finally {
      setSaving(null);
    }
  }

  async function changePassword(e?: React.FormEvent) {
    e?.preventDefault();
    if (saving === "password") return;
    setPwError(null);
    setPwDone(null);
    if (!curPw || !newPw || !confirmPw) {
      setPwError("All three fields are required.");
      return;
    }
    if (newPw.length < 8 || !/[A-Za-z]/.test(newPw) || !/[0-9]/.test(newPw)) {
      setPwError("New password needs 8+ characters with at least one letter and one number.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("New password and confirmation do not match.");
      return;
    }
    if (curPw === newPw) {
      setPwError("New password must be different from the current one.");
      return;
    }
    setSaving("password");
    try {
      const res = await fetch("/api/admin/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string; persistence?: string };
      if (res.ok && d.ok) {
        setPwDone(d.message ?? "Password changed.");
        setCurPw(""); setNewPw(""); setConfirmPw("");
        toast.success("Host admin password changed", {
          description: d.persistence ?? "Active for this server instance — sign out and back in to confirm.",
        });
        // gentle nudge to sign in again so the new password takes effect
        setTimeout(() => {
          toast.info("Sign out", { description: "Use the new password next time you sign in." });
        }, 1200);
      } else {
        setPwError(d.error ?? d.message ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setPwError((err as Error).message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageIntro
        title="Host Settings"
        description="Tune the host-control behaviour: automated email alerts, budget breach threshold, and the host admin password. Each change is persisted honestly — the persistence mode is shown so you know whether the change survives a server restart."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Alerts + threshold */}
        <Card>
          <CardHead title="Email automation" subtitle="login + budget breach alerts" icon={<Mail className="h-4 w-4" />} />
          <div className="space-y-3 px-5 py-4">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
              <div>
                <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Login alert emails</p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Send the user an email every time their account logs in. Audit-logged regardless.</p>
              </div>
              <Toggle checked={s.loginAlerts} onChange={(v) => void patchAlerts("loginAlerts", v)} label={s.loginAlerts ? "ON" : "OFF"} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
              <div>
                <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Budget breach emails</p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Email the project owner when a project's spend exceeds the threshold below.</p>
              </div>
              <Toggle checked={s.budgetAlerts} onChange={(v) => void patchAlerts("budgetAlerts", v)} label={s.budgetAlerts ? "ON" : "OFF"} />
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-800/60">
              <FieldLabel htmlFor="threshold">Budget breach threshold (%)</FieldLabel>
              <div className="flex items-center gap-3">
                <input
                  id="threshold"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={s.budgetThresholdPct}
                  onChange={(e) => void patchThreshold(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 dark:bg-slate-700"
                  disabled={saving === "threshold"}
                />
                <span className="w-12 text-right text-[12px] font-bold tabular text-[#072b49] dark:text-sky-300">{s.budgetThresholdPct}%</span>
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-400">
                A project is flagged when its spend exceeds the sanctioned budget by this percentage. Default: 20%. Setting to 0 disables the budget-escalation approval path.
              </p>
            </div>
          </div>
        </Card>

        {/* Password change */}
        <Card>
          <CardHead title="Host admin password" subtitle="change the env-configured admin password" icon={<KeyRound className="h-4 w-4" />} />
          <div className="px-5 py-4">
            <form onSubmit={changePassword} className="space-y-3">
              <div>
                <FieldLabel htmlFor="cur-pw">Current password</FieldLabel>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input id="cur-pw" type="password" autoComplete="current-password" value={curPw} onChange={(e) => setCurPw(e.target.value)} className="pl-9" placeholder="enter current password" />
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="new-pw">New password</FieldLabel>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input id="new-pw" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="pl-9" placeholder="8+ chars, 1 letter, 1 number" />
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="confirm-pw">Confirm new password</FieldLabel>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input id="confirm-pw" type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="pl-9" placeholder="re-enter the new password" />
                </div>
              </div>
              {pwError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{pwError}</div>
              ) : null}
              {pwDone ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">{pwDone}</div>
              ) : null}
              <Button type="submit" variant="navy" loading={saving === "password"} disabled={!curPw || !newPw || !confirmPw}>
                <Save className="h-3.5 w-3.5" /> Change password
              </Button>
              <p className="text-[10px] leading-relaxed text-slate-400">
                On Vercel the change is per-lambda-instance. To make it permanent across cold starts, update the <code className="font-mono">HOST_ADMIN_PASSWORD</code> env var in the Vercel project settings. Changing the password invalidates every live session (the session secret is derived from the admin password).
              </p>
            </form>
          </div>
        </Card>
      </div>

      {/* Persistence / system info */}
      <Card>
        <CardHead title="Persistence & system" subtitle="where settings live between restarts" icon={<SettingsIcon className="h-4 w-4" />} />
        <div className="px-5 py-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Persistence mode</p>
              <p className="mt-1 text-[12px] font-semibold text-slate-700 dark:text-slate-200">{persistence?.mode ?? "—"}</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500 dark:text-slate-400">{persistence?.warning ?? ""}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Main app URL</p>
              <p className="mt-1 font-mono text-[11px] font-semibold text-[#072b49] dark:text-sky-300">{data?.mainUrl ?? state.sync.mainUrl}</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                Override → env → default (http://localhost:3000). Edit on the Integrations tab.
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-[10.5px] leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>Tip:</strong> for any change that needs to survive a Vercel cold start (admin password, main URL, alert toggles), set the corresponding environment variable in the Vercel project settings and redeploy. The in-app controls are best for short-lived experimentation and dev work.
              </span>
            </p>
          </div>
        </div>
      </Card>

      {/* Session info */}
      <Card>
        <CardHead title="Session" subtitle="your current host session" icon={<ShieldCheck className="h-4 w-4" />} />
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Signed in as</p>
            <p className="mt-0.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200">{state.session.email}</p>
            <p className="mt-0.5 text-[10.5px] text-slate-500 dark:text-slate-400">HMAC-signed httpOnly cookie · 8-hour TTL · changing the password invalidates this session.</p>
          </div>
          <Button variant="outline" onClick={onLogout}>
            <Loader2 className="hidden h-3.5 w-3.5" /> Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}
