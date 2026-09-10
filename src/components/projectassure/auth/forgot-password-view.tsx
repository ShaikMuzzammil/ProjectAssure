"use client";

// v23 — Forgot password (step 1).
// User enters their email; we POST to /api/auth/request-reset which generates
// a single-use token and emails the reset link. The page is intentionally
// quiet about whether the email exists (anti-enumeration). After submit, the
// user sees "If that account exists, a reset link has been sent." plus a note
// about simulation mode when no DATABASE_URL is configured.

import React, { useState } from "react";
import { ArrowLeft, ArrowRight, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { useApp } from "@/store/app-store";
import { toast } from "sonner";
import GovHeader from "../shared/gov-header";

export default function ForgotPasswordView() {
  const requestPasswordReset = useApp(s => s.requestPasswordReset);
  const goPage = useApp(s => s.goPage);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ sent: boolean; simulated: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    const res = await requestPasswordReset(email);
    setBusy(false);
    if (res.ok) {
      setDone({ sent: res.sent, simulated: res.simulated, message: res.message ?? "Reset link sent." });
      toast.success("Reset link requested", { description: res.message });
    } else {
      setError(res.error ?? "Could not request a reset link.");
      toast.error("Could not request reset", { description: res.error });
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#04122a] via-[#06243d] to-[#04101e]" />
        <div className="absolute inset-0 opacity-60" style={{ background: "radial-gradient(720px 480px at 80% 20%, rgba(12,147,231,0.25), transparent 55%), radial-gradient(540px 360px at 20% 90%, rgba(245,158,11,0.10), transparent 55%)" }} />
      </div>
      <GovHeader surface="public" className="relative z-10" />
      <div className="relative flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-slate-200/80 bg-card p-7 shadow-2xl shadow-slate-300/50 dark:border-slate-800 dark:shadow-black/40">
            <button onClick={() => goPage("login")} className="mb-3 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </button>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#0c93e7]">Account recovery</div>
            <h2 className="text-[19px] font-bold tracking-tight">Forgot your password?</h2>
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
              Enter your official email — we&apos;ll send a one-time reset link valid for 60 minutes.
              The link works in any browser; the new password takes effect immediately.
            </p>

            {done ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-semibold">{done.message}</p>
                      <p className="mt-1 text-[11px] font-normal text-emerald-700/90 dark:text-emerald-300/80">
                        {done.simulated && !done.sent
                          ? "In demo mode the reset link is recorded in the audit log (no email provider is configured). The host administrator can read it from the Audit Trail and deliver it manually. In production with DATABASE_URL set, the link is emailed automatically."
                          : "Check your inbox (and spam folder) for an email from ProjectAssure. Click the link, enter a new password, and sign in."}
                      </p>
                    </div>
                  </div>
                </div>
                <button onClick={() => goPage("login")} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border text-[13px] font-semibold transition hover:bg-muted">
                  <ArrowLeft className="h-4 w-4" /> Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-5 space-y-3.5">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Official email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoFocus
                      placeholder="you@organisation.gov.in"
                      className="h-10.5 w-full rounded-lg border bg-background pl-9 text-[13px] outline-none transition focus:border-[#0c93e7] focus:ring-2 focus:ring-[#0c93e7]/20" />
                  </div>
                </div>
                {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}
                <button type="submit" disabled={busy || !email}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0284c7] text-[14px] font-semibold text-white shadow-md shadow-[#0284c7]/25 transition hover:bg-[#0369a1] disabled:opacity-70">
                  {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending reset link…</> : <><KeyRound className="h-4 w-4" /> Send reset link <ArrowRight className="h-4 w-4" /></>}
                </button>
                <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
                  We never reveal which emails are registered. If your account is active, the link arrives within a minute.
                </p>
              </form>
            )}
          </div>
          <div className="mt-3 text-center text-[10px] text-slate-500">
            SIH 2026 · SIH26103 · Team NEXGEN
          </div>
        </div>
      </div>
    </div>
  );
}
