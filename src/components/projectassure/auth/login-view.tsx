"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp, type SignUpForm } from "@/store/app-store";
import { USERS, DEPARTMENTS } from "@/lib/projectassure/seed";
import { passwordStrength } from "@/lib/projectassure/auth-crypto";
import {
  ShieldAlert, ArrowLeft, ArrowRight, Loader2, KeyRound, Check, UserPlus, LogIn, Lock, Mail,
  User as UserIcon, Building2, ShieldCheck, Landmark, ClipboardList, LineChart, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import GovHeader from "../shared/gov-header";

const ROLE_ICON: Record<string, React.ElementType> = {
  ADMIN: Landmark, PROJECT_MANAGER: ClipboardList, STAKEHOLDER: LineChart, VIEWER: Eye,
};

const SIGNUP_ROLES: { value: SignUpForm["role"]; title: string; blurb: string }[] = [
  { value: "PROJECT_MANAGER", title: "Project Manager", blurb: "Create & run your own projects" },
  { value: "STAKEHOLDER", title: "Stakeholder", blurb: "Monitor, alerts & reports — read-only" },
  { value: "VIEWER", title: "Observer", blurb: "Read-only briefing view" },
];

export default function LoginView() {
  const login = useApp(s => s.login);
  const signUp = useApp(s => s.signUp);
  const goPage = useApp(s => s.goPage);
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [persona, setPersona] = useState(USERS[0]);
  const [email, setEmail] = useState(USERS[0].email);
  const [password, setPassword] = useState(USERS[0].password);

  const pick = (u: typeof USERS[0]) => {
    setPersona(u); setEmail(u.email); setPassword(u.password); setTab("signin");
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#0c93e7] dark:bg-[#0a5f97]">
      {/* v8: universal official portal band on the login surface too */}
      <GovHeader surface="public" className="relative z-10" />
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-8">
      {/* blueprint grid over solid ministry blue */}
      <div className="absolute inset-0 opacity-60"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      <div className="absolute inset-0"
        style={{ background: "radial-gradient(900px 500px at 15% 0%, rgba(255,255,255,0.10), transparent 55%), radial-gradient(700px 500px at 100% 100%, rgba(7,43,73,0.45), transparent 60%)" }} />

      <div className="relative mx-auto grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
        {/* ─── LEFT — brand, one-line pitch, demo personas (one per role) ─── */}
        <div className="hidden flex-col text-white lg:flex">
          <button onClick={() => goPage("landing")} className="mb-6 flex items-center gap-1.5 text-[12px] font-medium text-white/60 transition hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to landing
          </button>

          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <ShieldAlert className="h-6.5 w-6.5" />
            </div>
            <div>
              <div className="text-[24px] font-extrabold leading-tight tracking-tight">ProjectAssure</div>
              <div className="text-[11.5px] font-medium text-white/60">Secure portal access · Smart India Hackathon 2026</div>
            </div>
          </div>

          <h1 className="mt-7 max-w-lg text-[27px] font-bold leading-snug">One dashboard for India&apos;s projects.</h1>
          <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-white/75">
            Predicts delays <strong className="font-semibold text-white">30–60 days early</strong>, reads field reports itself, and
            recommends the next best action — on free-tier infrastructure at <strong className="font-semibold text-white">₹0 running cost</strong>.
          </p>

          {/* personas — exactly one demo per role type */}
          <div className="mt-7">
            <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">Choose a demo persona — 4 roles</div>
            <div className="grid grid-cols-2 gap-2.5">
              {USERS.map(u => {
                const Icon = ROLE_ICON[u.role] ?? ClipboardList;
                const active = persona.id === u.id;
                return (
                  <button key={u.id} type="button" onClick={() => pick(u)}
                    className={cn("rounded-xl border p-3 text-left backdrop-blur transition",
                      active ? "border-white/40 bg-white/20 shadow-lg" : "border-white/15 bg-white/8 hover:bg-white/15")}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-white/85" />
                      {active && <Check className="ml-auto h-3.5 w-3.5 text-white" />}
                    </div>
                    <div className="mt-1.5 truncate text-[12px] font-bold leading-tight">{u.persona}</div>
                    <div className="truncate text-[10px] text-white/60">{u.designation}</div>
                    <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-white/45">{u.role.replace("_", " ")}</div>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-[10.5px] text-white/55">
              Pick a role to prefill the sign-in card — every persona sees a different, correctly-scoped workspace.
            </div>
          </div>

          <div className="mt-auto pt-8 text-[10px] text-white/45">
            Smart India Hackathon 2026 · SIH26103 · Team NEXGEN · Amrita Vishwa Vidyapeetham Chennai
          </div>
        </div>

        {/* ─── RIGHT — the white sign-in / create-account card ─── */}
        <div className="w-full">
          {/* mobile persona chips (lg:hidden) */}
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {USERS.map(u => (
              <button key={u.id} type="button" onClick={() => pick(u)}
                className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold backdrop-blur",
                  persona.id === u.id ? "border-white/50 bg-white/25 text-white" : "border-white/20 bg-white/10 text-white/80")}>
                {u.persona}
              </button>
            ))}
          </div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl bg-card p-7 shadow-2xl shadow-[#072b49]/40">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#0c93e7]">Smart India Hackathon 2026 · SIH26103</div>
            <h2 className="text-[19px] font-bold tracking-tight">{tab === "signin" ? "Sign in to ProjectAssure" : "Create your account"}</h2>
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
              {tab === "signin"
                ? "Secure access. Pick a persona on the left, or sign in with your registered email."
                : "Your own workspace — projects, documents, predictions and exports, stored per user."}
            </p>

            <AnimatePresence mode="wait">
              {tab === "signin"
                ? <motion.div key="signin" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.16 }}>
                  <SignInPanel login={login} email={email} password={password} setEmail={setEmail} setPassword={setPassword}
                    persona={persona} switchToSignUp={() => setTab("signup")} goPage={goPage} />
                </motion.div>
                : <motion.div key="signup" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.16 }}>
                  <SignUpPanel signUp={signUp} switchToSignIn={() => setTab("signin")} />
                </motion.div>}
            </AnimatePresence>
          </motion.div>

          <div className="mt-3 text-center text-[10px] text-white/55 lg:hidden">
            SIH 2026 · SIH26103 · Team NEXGEN
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

// ─── Sign in (persona prefill + registered accounts) ───────────────────────
function SignInPanel({ login, email, password, setEmail, setPassword, persona, switchToSignUp, goPage }: {
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string; user?: { name: string; role: string } }>;
  email: string; password: string; setEmail: (v: string) => void; setPassword: (v: string) => void;
  persona: typeof USERS[0]; switchToSignUp: () => void; goPage: (p: "landing") => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    const res = await login(email, password);
    if (!res.ok) { setError(res.error ?? "Sign-in failed"); setBusy(false); return; }
    toast.success(`Welcome back, ${res.user?.name.split(" ")[0]}`, { description: `${res.user?.role} session · your workspace is ready` });
  };

  return (
    <div>
      {persona && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-[#e0effe]/70 px-3 py-2 dark:bg-[#0c93e7]/10">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-[10px] font-bold text-white">{persona.avatarInitials}</div>
          <div className="min-w-0 text-[11px] leading-tight">
            <div className="font-semibold">Demo: {persona.persona}</div>
            <div className="truncate text-muted-foreground">password &quot;{persona.password}&quot; prefilled · any persona works</div>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3.5">
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Official email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="you@mospi.gov.in"
              className="h-10.5 w-full rounded-lg border bg-background pl-9 text-[13px] outline-none transition focus:border-[#0c93e7] focus:ring-2 focus:ring-[#0c93e7]/20" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Password</label>
          <div className="relative">
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" required autoComplete="current-password"
              className="h-10.5 w-full rounded-lg border bg-background pl-9 pr-9 font-mono text-[13px] outline-none transition focus:border-[#0c93e7] focus:ring-2 focus:ring-[#0c93e7]/20" />
            <KeyRound className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}
        <button type="submit" disabled={busy}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0284c7] text-[14px] font-semibold text-white shadow-md shadow-[#0284c7]/25 transition hover:bg-[#0369a1] disabled:opacity-70">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Verifying…</> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
        </button>
        <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
          <div className="h-px flex-1 bg-border" /><span>or</span><div className="h-px flex-1 bg-border" />
        </div>
        <button type="button" onClick={switchToSignUp}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border text-[13px] font-semibold transition hover:bg-muted">
          <UserPlus className="h-4 w-4 text-[#0c93e7]" /> Create a new account (free)
        </button>
        <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-emerald-600" />Securely encrypted passwords</span>
          <button type="button" onClick={() => goPage("landing")} className="font-medium hover:text-foreground">← Back</button>
        </div>
      </form>
    </div>
  );
}

// ─── Sign up (real account creation, compact) ─────────────────────────────
function SignUpPanel({ signUp, switchToSignIn }: {
  signUp: (form: SignUpForm) => Promise<{ ok: boolean; error?: string; user?: { name: string; role: string }; mirrored?: boolean }>;
  switchToSignIn: () => void;
}) {
  const [form, setForm] = useState<SignUpForm>({
    name: "", email: "", password: "", role: "PROJECT_MANAGER", departmentId: DEPARTMENTS[0].id, designation: "", phone: "",
  });
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<SignUpForm>) => setForm(f => ({ ...f, ...patch }));
  const strength = passwordStrength(form.password);
  const matched = form.password.length > 0 && form.password === confirm;
  const valid = form.name.trim().length >= 3 && /\S+@\S+\.\S+/.test(form.email) && form.password.length >= 8 && matched;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    const res = await signUp(form);
    if (!res.ok) { setError(res.error ?? "Registration failed"); setBusy(false); return; }
    toast.success(`Account created — welcome, ${res.user?.name.split(" ")[0]}!`, {
      description: res.mirrored
        ? "Password hashed (scrypt) & stored in secure cloud database · your workspace is ready"
        : "Password securely encrypted · your workspace is ready",
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div>
        <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Full name</label>
        <div className="relative">
          <UserIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={form.name} onChange={e => set({ name: e.target.value })} required placeholder="e.g. Ananya Krishnan"
            className="h-10.5 w-full rounded-lg border bg-background pl-9 text-[13px] outline-none transition focus:border-[#0c93e7] focus:ring-2 focus:ring-[#0c93e7]/20" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={form.email} onChange={e => set({ email: e.target.value })} type="email" required placeholder="you@organisation.gov.in"
            className="h-10.5 w-full rounded-lg border bg-background pl-9 text-[13px] outline-none transition focus:border-[#0c93e7] focus:ring-2 focus:ring-[#0c93e7]/20" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={form.password} onChange={e => set({ password: e.target.value })} type="password" required autoComplete="new-password"
              className="h-10.5 w-full rounded-lg border bg-background pl-9 text-[13px] outline-none transition focus:border-[#0c93e7] focus:ring-2 focus:ring-[#0c93e7]/20" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Confirm</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={confirm} onChange={e => setConfirm(e.target.value)} type="password" required autoComplete="new-password"
              className={cn("h-10.5 w-full rounded-lg border bg-background pl-9 text-[13px] outline-none transition focus:border-[#0c93e7] focus:ring-2 focus:ring-[#0c93e7]/20",
                confirm.length > 0 && !matched && "border-rose-400 focus:border-rose-400")} />
          </div>
        </div>
      </div>
      {form.password.length > 0 && (
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
      <div>
        <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Account type</label>
        <div className="grid grid-cols-3 gap-2">
          {SIGNUP_ROLES.map(r => (
            <button key={r.value} type="button" onClick={() => set({ role: r.value })}
              className={cn("rounded-lg border p-2.5 text-left transition",
                form.role === r.value ? "border-[#0c93e7] bg-[#e0effe]/60 dark:bg-[#0c93e7]/10" : "hover:border-[#0c93e7]/40")}>
              <div className="text-[11.5px] font-bold leading-tight">{r.title}</div>
              <div className="mt-0.5 text-[9.5px] leading-snug text-muted-foreground">{r.blurb}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Department</label>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <select value={form.departmentId} onChange={e => set({ departmentId: e.target.value })}
            className="h-10.5 w-full appearance-none rounded-lg border bg-background pl-9 pr-3 text-[12.5px] outline-none transition focus:border-[#0c93e7] focus:ring-2 focus:ring-[#0c93e7]/20">
            {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name.slice(0, 34)}{d.name.length > 34 ? "…" : ""}</option>)}
          </select>
        </div>
      </div>
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}
      <button type="submit" disabled={busy || !valid}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0284c7] text-[14px] font-semibold text-white shadow-md shadow-[#0284c7]/25 transition hover:bg-[#0369a1] disabled:opacity-60">
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Hashing password &amp; creating workspace…</> : <><ShieldCheck className="h-4 w-4" />Create secure account</>}
      </button>
      <button type="button" onClick={switchToSignIn}
        className="w-full text-center text-[11.5px] font-medium text-muted-foreground transition hover:text-foreground">
        Already have an account? <span className="font-semibold text-[#0c93e7]">Sign in</span>
      </button>
      <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
        8+ characters · stored as one-way encryption · mirrored to secure cloud database when configured. Everything you create is saved to your account.
      </p>
    </form>
  );
}
