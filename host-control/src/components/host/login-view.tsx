"use client";

// Host login gate — the first screen. Real credentials (env-configured),
// real lockout (6 fails → 10 min per IP), every attempt audited server-side.

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Clock, Lock, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, FieldLabel } from "./ui";

export function LoginView({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "warn"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; remainingAttempts?: number; retryAfterSec?: number };
      if (res.ok && data.ok) {
        toast.success("Host session established", { description: "Central Programme Office control tower unlocked." });
        onSuccess();
        return;
      }
      if (res.status === 429) {
        const mins = Math.max(1, Math.ceil((data.retryAfterSec ?? 600) / 60));
        setMessage({ tone: "warn", text: `IP locked — try again in ${mins} minute(s). ${data.message ?? ""}` });
      } else if (data.remainingAttempts !== undefined) {
        setMessage({ tone: "error", text: `${data.message ?? "Invalid credentials."} ${data.remainingAttempts} attempt(s) left before a 10-minute IP lock.` });
      } else {
        setMessage({ tone: "error", text: data.message ?? "Invalid email or password." });
      }
    } catch {
      setMessage({ tone: "error", text: "Could not reach the host API. Is the server running?" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#04192c] px-4 py-10">
      {/* subtle control-tower grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(12,147,231,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(12,147,231,0.08) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[46rem] -translate-x-1/2 rounded-full bg-[#0c93e7]/10 blur-3xl" aria-hidden />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0c93e7] shadow-lg shadow-sky-500/30">
            <ShieldCheck className="h-7 w-7 text-white" aria-hidden />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">ProjectAssure · Host Control</h1>
          <p className="text-xs text-sky-200/80">Central Programme Office · National Project Monitoring Authority</p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-md"
          aria-label="Host administrator sign in"
        >
          <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-sky-200/70">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Restricted access · audited
          </div>

          <div className="space-y-4">
            <div>
              <FieldLabel htmlFor="host-email">Official email</FieldLabel>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <Input
                  id="host-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cpo@mospi.gov.in"
                  className="bg-white/95 pl-9 dark:bg-slate-900"
                />
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="host-password">Password</FieldLabel>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <Input
                  id="host-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="bg-white/95 pl-9 dark:bg-slate-900"
                />
              </div>
            </div>
          </div>

          {message ? (
            <div
              role="alert"
              className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed ${
                message.tone === "warn" ? "bg-amber-500/15 text-amber-200" : "bg-rose-500/15 text-rose-200"
              }`}
            >
              {message.tone === "warn" ? <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />}
              <span>{message.text}</span>
            </div>
          ) : null}

          <Button type="submit" loading={busy} className="mt-5 w-full" variant="primary">
            {busy ? "Verifying…" : "Unlock control tower"}
          </Button>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-sky-200/60">
            Credentials are set with HOST_ADMIN_EMAIL / HOST_ADMIN_PASSWORD env vars.
            <br />
            6 failed attempts lock this IP for 10 minutes. Every attempt is audited.
          </p>
        </form>

        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.18em] text-sky-200/40">
          SIH 2026 · SIH26103 · Team NEXGEN
        </p>
      </motion.div>
    </main>
  );
}
