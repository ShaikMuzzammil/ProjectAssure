"use client";

// v23 — Reset password (step 2).
// Reached from the email link `#/reset?token=<token>`. The user enters a new
// password (twice for confirmation); we POST to /api/auth/reset-password
// which verifies the token, hashes the new password with scrypt, marks the
// token as used, and audits the change. On success we route back to the
// sign-in page so the user signs in with the new password (we do NOT
// auto-login — that's a security best practice).

import React, { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useApp } from "@/store/app-store";
import { passwordStrength } from "@/lib/projectassure/auth-crypto";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import GovHeader from "../shared/gov-header";

export default function ResetPasswordView({ token }: { token: string }) {
  const resetPassword = useApp(s => s.resetPassword);
  const goPage = useApp(s => s.goPage);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ email?: string; message?: string } | null>(null);

  // If there's no token in the URL, the user landed here by mistake — show a
  // clear notice + a link back to the forgot-password page.
  useEffect(() => {
    if (!token) {
      setError("No reset token in the link. Click \"Request a new link\" below to start over.");
    }
  }, [token]);

  const strength = passwordStrength(password);
  const matched = password.length > 0 && password === confirm;
  const valid = token && password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password) && matched;

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy || !valid) return;
    setBusy(true); setError(null);
    const res = await resetPassword(token, password);
    setBusy(false);
    if (res.ok) {
      setDone({ email: res.email, message: res.message });
      toast.success("Password updated", { description: res.message });
    } else {
      setError(res.error ?? "Could not reset password.");
      toast.error("Could not reset", { description: res.error });
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#04122a] via-[#06243d] to-[#04101e]" />
        <div className="absolute inset-0 opacity-60" style={{ background: "radial-gradient(720px 480px at 80% 20%, rgba(12,147,231,0.25), transparent 55%), radial-gradient(540px 360px at 20% 90%, rgba(16,185,129,0.10), transparent 55%)" }} />
      </div>
      <GovHeader surface="public" className="relative z-10" />
      <div className="relative flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-slate-200/80 bg-card p-7 shadow-2xl shadow-slate-300/50 dark:border-slate-800 dark:shadow-black/40">
            <button onClick={() => goPage("login")} className="mb-3 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </button>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#0c93e7]">Account recovery</div>
            <h2 className="text-[19px] font-bold tracking-tight">Set a new password</h2>
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
              {done
                ? "Your password has been updated. Sign in with the new password to continue."
                : "Enter a new password for your ProjectAssure account. The reset link is single-use — once the new password is set, this link stops working."}
            </p>

            {done ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-semibold">{done.message ?? "Password updated."}</p>
                      {done.email ? <p className="mt-1 text-[11px] font-normal text-emerald-700/90 dark:text-emerald-300/80">Account: {done.email}</p> : null}
                    </div>
                  </div>
                </div>
                <button onClick={() => goPage("login")} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0284c7] text-[14px] font-semibold text-white shadow-md shadow-[#0284c7]/25 transition hover:bg-[#0369a1]">
                  Sign in with your new password <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-5 space-y-3.5">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">New password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required autoFocus autoComplete="new-password"
                      className="h-10.5 w-full rounded-lg border bg-background pl-9 text-[13px] outline-none transition focus:border-[#0c93e7] focus:ring-2 focus:ring-[#0c93e7]/20" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Confirm password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" required autoComplete="new-password"
                      className={cn("h-10.5 w-full rounded-lg border bg-background pl-9 text-[13px] outline-none transition focus:border-[#0c93e7] focus:ring-2 focus:ring-[#0c93e7]/20",
                        confirm.length > 0 && !matched && "border-rose-400 focus:border-rose-400")} />
                  </div>
                </div>
                {password.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex h-1.5 flex-1 gap-0.5 overflow-hidden rounded-full">
                      {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} className={cn("h-full flex-1 rounded-full transition-colors",
                          i < strength.score ? (strength.score <= 2 ? "bg-rose-400" : strength.score <= 3 ? "bg-amber-400" : "bg-emerald-500") : "bg-muted")} />
                      ))}
                    </div>
                    <span className="w-20 text-right text-[10.5px] font-semibold text-muted-foreground">{strength.label}</span>
                  </div>
                )}
                {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}
                <button type="submit" disabled={busy || !valid}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0284c7] text-[14px] font-semibold text-white shadow-md shadow-[#0284c7]/25 transition hover:bg-[#0369a1] disabled:opacity-60">
                  {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating password…</> : <><ShieldCheck className="h-4 w-4" /> Set new password</>}
                </button>
                <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
                  8+ characters · stored as one-way encryption (scrypt) · the reset link is single-use.
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
