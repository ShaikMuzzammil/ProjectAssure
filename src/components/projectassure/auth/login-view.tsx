"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp, type SignUpForm } from "@/store/app-store";
import { DEPARTMENTS } from "@/lib/projectassure/seed";
import { passwordStrength } from "@/lib/projectassure/auth-crypto";
import {
  ShieldAlert, ArrowLeft, ArrowRight, Loader2, KeyRound, UserPlus, Lock, Mail,
  User as UserIcon, Building2, ShieldCheck, Eye, Sparkles, Radar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import GovHeader from "../shared/gov-header";

const SIGNUP_ROLES: { value: SignUpForm["role"]; title: string; blurb: string }[] = [
  { value: "PROJECT_MANAGER", title: "Project Manager", blurb: "Create & run your own projects" },
  { value: "STAKEHOLDER", title: "Stakeholder", blurb: "Monitor, alerts & reports — read-only" },
  { value: "VIEWER", title: "Observer", blurb: "Read-only briefing view" },
];

const FEATURES = [
  { icon: Radar, title: "Delay prediction", text: "18-signal model flags risk 30–60 days before a slip." },
  { icon: Eye, title: "Document intelligence", text: "Upload field reports — fields and risks are extracted automatically." },
  { icon: Sparkles, title: "Live approvals", text: "Every project, evidence file and document is reviewed in real time." },
];

export default function LoginView() {
  const login = useApp(s => s.login);
  const signUp = useApp(s => s.signUp);
  const goPage = useApp(s => s.goPage);
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-950">
      {/* v22 enhanced background: animated India map mesh + grid + glow */}
      <div className="pointer-events-none absolute inset-0">
        {/* Deep navy base */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#04122a] via-[#06243d] to-[#04101e]" />
        {/* Animated mesh gradient — slow drift */}
        <div className="absolute inset-0 opacity-70"
          style={{
            background: `
              radial-gradient(900px 540px at 12% 18%, rgba(12,147,231,0.35), transparent 60%),
              radial-gradient(720px 480px at 88% 22%, rgba(245,158,11,0.18), transparent 55%),
              radial-gradient(680px 460px at 76% 82%, rgba(16,185,129,0.18), transparent 55%),
              radial-gradient(540px 360px at 22% 88%, rgba(124,200,251,0.16), transparent 55%)
            `,
            animation: "pa-mesh-drift 18s ease-in-out infinite alternate",
          }} />
        {/* SVG India silhouette — subtle white outline watermark */}
        <svg viewBox="0 0 512 580" className="absolute left-1/2 top-1/2 h-[120%] -translate-x-1/2 -translate-y-1/2 opacity-[0.07]"
          style={{ animation: "pa-india-pulse 9s ease-in-out infinite" }}>
          <path d="M 196 32 L 232 28 L 268 38 L 296 56 L 318 78 L 322 96 L 312 116 L 296 130 L 304 152 L 322 168 L 344 178 L 360 192 L 372 220 L 386 250 L 398 280 L 412 300 L 422 322 L 414 350 L 396 376 L 372 392 L 348 408 L 322 416 L 296 424 L 280 442 L 268 470 L 252 502 L 236 528 L 220 548 L 206 558 L 196 552 L 192 528 L 196 502 L 200 470 L 196 440 L 188 412 L 174 392 L 154 380 L 130 374 L 104 370 L 80 358 L 64 338 L 52 310 L 44 280 L 40 250 L 44 222 L 56 196 L 72 174 L 88 156 L 96 134 L 100 110 L 108 88 L 122 70 L 140 56 L 162 46 L 180 38 Z"
            fill="none" stroke="white" strokeWidth="1.5" />
          {/* Project pin dots */}
          <circle cx="240" cy="280" r="3" fill="#0c93e7" />
          <circle cx="280" cy="240" r="3" fill="#10b981" />
          <circle cx="220" cy="340" r="3" fill="#f59e0b" />
          <circle cx="180" cy="200" r="3" fill="#8b5cf6" />
          <circle cx="320" cy="280" r="3" fill="#dc2626" />
          <circle cx="160" cy="320" r="3" fill="#0c93e7" />
        </svg>
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)`,
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }} />
        {/* Floating particles — top */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7cc8fb]/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#f59e0b]/50 to-transparent" />
      </div>
      <style>{`
        @keyframes pa-mesh-drift {
          0%   { transform: translate3d(0,0,0) scale(1); }
          100% { transform: translate3d(2%,-2%,0) scale(1.05); }
        }
        @keyframes pa-india-pulse {
          0%,100% { opacity: 0.05; transform: translate(-50%,-50%) scale(1); }
          50%     { opacity: 0.09; transform: translate(-50%,-50%) scale(1.02); }
        }
      `}</style>
      {/* v8: universal official portal band on the login surface too */}
      <GovHeader surface="public" className="relative z-10" />
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-8">
      {/* v21 redesign: calm light canvas + deep-navy feature panel — the old
          full-bleed bright blue drowned the page; now navy carries the weight
          as one elegant rounded card with warm amber accents. */}
      <div className="relative mx-auto grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[1.12fr_0.88fr] lg:gap-10">
        {/* ─── LEFT — navy feature panel: brand, pitch, demo personas ─── */}
        <div className="relative hidden flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-[#08243d] via-[#0a3252] to-[#072b49] p-8 text-white shadow-2xl shadow-[#072b49]/30 ring-1 ring-white/10 lg:flex">
          {/* soft glow accents (teal + amber — not more blue) */}
          <div className="pointer-events-none absolute inset-0 rounded-3xl" style={{ background: "radial-gradient(520px 300px at 85% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(420px 260px at -10% 110%, rgba(251,191,36,0.10), transparent 55%)" }} />
          <div className="pointer-events-none absolute inset-0 rounded-3xl opacity-[0.35]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "34px 34px" }} />

          <button onClick={() => goPage("landing")} className="relative z-10 mb-5 flex items-center gap-1.5 text-[12px] font-medium text-white/55 transition hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to landing
          </button>

          <div className="relative z-10 flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
              <ShieldAlert className="h-6.5 w-6.5 text-sky-200" />
            </div>
            <div>
              <div className="text-[24px] font-extrabold leading-tight tracking-tight">ProjectAssure</div>
              <div className="text-[11.5px] font-medium text-white/55">Secure portal access · Smart India Hackathon 2026</div>
            </div>
          </div>

          <h1 className="relative z-10 mt-7 max-w-lg text-[27px] font-bold leading-snug">One dashboard for India&apos;s projects.</h1>
          <p className="relative z-10 mt-2 max-w-lg text-[13px] leading-relaxed text-white/70">
            Predicts delays <strong className="font-semibold text-amber-200">30–60 days early</strong>, reads field reports itself, and
            recommends the next best action — on free-tier infrastructure at <strong className="font-semibold text-amber-200">₹0 running cost</strong>.
          </p>

          {/* v23: clean universal login — no demo personas here. Feature list instead. */}
          <div className="relative z-10 mt-7 space-y-2.5">
            {FEATURES.map(f => (
              <div key={f.title} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3">
                <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />
                <div>
                  <div className="text-[12px] font-bold leading-tight text-white">{f.title}</div>
                  <div className="mt-0.5 text-[10.5px] leading-snug text-white/55">{f.text}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="relative z-10 mt-6">
            <button onClick={() => goPage("demo")}
              className="text-[11px] font-semibold text-sky-300 underline decoration-sky-300/40 underline-offset-2 transition hover:text-sky-200">
              Explore the guided demo →
            </button>
          </div>

          <div className="relative z-10 mt-auto pt-6 text-[10px] text-white/35">
            Smart India Hackathon 2026 · SIH26103 · Team NEXGEN · Amrita Vishwa Vidyapeetham Chennai
          </div>
        </div>

        {/* ─── RIGHT — the white sign-in / create-account card ─── */}
        <div className="w-full">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl border border-slate-200/80 bg-card p-7 shadow-2xl shadow-slate-300/50 dark:border-slate-800 dark:shadow-black/40">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#0c93e7]">Smart India Hackathon 2026 · SIH26103</div>
            <h2 className="text-[19px] font-bold tracking-tight">{tab === "signin" ? "Sign in to ProjectAssure" : "Create your account"}</h2>
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
              {tab === "signin"
                ? "Sign in with your registered email — your workspace follows your account."
                : "Your own workspace — projects, documents, predictions and exports, stored per user."}
            </p>

            <AnimatePresence mode="wait">
              {tab === "signin"
                ? <motion.div key="signin" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.16 }}>
                  <SignInPanel login={login} email={email} password={password} setEmail={setEmail} setPassword={setPassword}
                    switchToSignUp={() => setTab("signup")} goPage={goPage} />
                </motion.div>
                : <motion.div key="signup" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.16 }}>
                  <SignUpPanel signUp={signUp} switchToSignIn={() => setTab("signin")} />
                </motion.div>}
            </AnimatePresence>
          </motion.div>

          <div className="mt-3 text-center text-[10px] text-slate-500 lg:hidden">
            SIH 2026 · SIH26103 · Team NEXGEN
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

// ─── Sign in (registered accounts — clean, no persona prefill) ─────────────
function SignInPanel({ login, email, password, setEmail, setPassword, switchToSignUp, goPage }: {
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string; user?: { name: string; role: string } }>;
  email: string; password: string; setEmail: (v: string) => void; setPassword: (v: string) => void;
  switchToSignUp: () => void; goPage: (p: "landing") => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    const res = await login(email, password);
    if (!res.ok) { setError(res.error ?? "Sign-in failed"); setBusy(false); return; }
    toast.success(`Welcome back, ${res.user?.name.split(" ")[0]}`, { description: "Your workspace is ready" });
  };

  return (
    <div>
      <form onSubmit={submit} className="space-y-3.5">
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Official email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="you@organisation.gov.in" autoComplete="username"
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
          <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-emerald-600" />Passwords encrypted end-to-end</span>
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
