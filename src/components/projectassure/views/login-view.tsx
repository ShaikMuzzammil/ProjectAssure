"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Building2, ChevronRight, Lock, Mail, Sparkles, Radar, FileSearch, Users2, Landmark, LineChart } from "lucide-react";
import { USERS } from "@/lib/projectassure/engine";
import { useAppStore } from "@/store/app-store";
import { toast } from "sonner";

const PERSONA_ICONS = [Landmark, Users2, Radar, FileSearch, ShieldCheck, LineChart];

export function LoginView() {
  const login = useAppStore((s) => s.login);
  const [selected, setSelected] = useState<string>(USERS[0].id);
  const [email, setEmail] = useState(USERS[0].email);
  const [password, setPassword] = useState("demo-access-2026");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    const u = USERS.find((x) => x.id === selected)!;
    setLoading(true);
    setTimeout(() => {
      login(u);
      toast.success(`Welcome, ${u.name.split(" ")[0]}`, { description: `Signed in as ${u.designation} · SSO session valid on all 3 domains` });
    }, 700);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#072b49] p-4">
      {/* animated gradient backdrop */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background: "linear-gradient(125deg, #072b49 0%, #0b426e 30%, #0c93e7 70%, #072b49 100%)",
          backgroundSize: "300% 300%",
          animation: "pa-gradient-loop 8s ease infinite",
        }}
      />
      {/* grid overlay */}
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "44px 44px" }} />

      <div className="relative z-10 grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        {/* left: brand + persona picker */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="hidden flex-col justify-center text-white lg:flex">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">ProjectAssure</h1>
              <p className="text-xs text-white/70">Ministry-grade access · Government of India · MoSPI</p>
            </div>
          </div>
          <p className="mb-6 max-w-md text-sm leading-relaxed text-white/80">
            One dashboard for India&rsquo;s projects. Predicts delays <strong className="text-white">30–60 days early</strong>, reads reports itself, and recommends the next best action — all on free-tier infrastructure at <strong className="text-white">₹0 running cost</strong>.
          </p>

          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">Choose a demo persona — 6 roles, one SSO</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {USERS.map((u, i) => {
              const Icon = PERSONA_ICONS[i % PERSONA_ICONS.length];
              const active = selected === u.id;
              return (
                <button
                  key={u.id}
                  onClick={() => { setSelected(u.id); setEmail(u.email); }}
                  className={`group rounded-xl border p-3 text-left backdrop-blur transition-all ${active ? "border-white/70 bg-white/20 shadow-lg" : "border-white/15 bg-white/5 hover:bg-white/10"}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-white text-[#0b426e]" : "bg-white/15 text-white"}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{u.persona}</p>
                      <p className="truncate text-[11px] text-white/60">{u.designation}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* right: auth card */}
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, delay: 0.1 }} className="my-auto">
          <div className="rounded-2xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur dark:bg-[#0f172a]/95 sm:p-8">
            <div className="mb-1 flex items-center gap-2 text-[#0c93e7]">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Smart India Hackathon 2026 · SIH26103</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">Sign in to ProjectAssure</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ministry-grade access. Demo environment — any password works.</p>

            {/* mobile persona select */}
            <div className="mt-4 lg:hidden">
              <label className="text-xs font-medium text-muted-foreground">Demo persona</label>
              <select
                value={selected}
                onChange={(e) => { setSelected(e.target.value); setEmail(USERS.find((u) => u.id === e.target.value)!.email); }}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {USERS.map((u) => <option key={u.id} value={u.id}>{u.persona} — {u.name}</option>)}
              </select>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Official email</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none ring-[#0c93e7] focus:ring-2"
                    placeholder="name@mospi.gov.in"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    className="w-full rounded-md border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none ring-[#0c93e7] focus:ring-2"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <button
                onClick={handleLogin}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[#0c93e7] py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0b426e] active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Authenticating…</span>
                ) : (
                  <><Building2 className="h-4 w-4" />Sign in with SSO<ChevronRight className="h-4 w-4" /></>
                )}
              </button>
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border" /><span className="text-[10px] uppercase tracking-wider text-muted-foreground">or</span><div className="h-px flex-1 bg-border" />
              </div>
              <button
                onClick={handleLogin}
                className="w-full rounded-md border border-input py-2.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                Continue with Parichay SSO · Government of India
              </button>
            </div>

            <div className="mt-5 rounded-lg bg-[#e0effe] p-3 text-[11px] leading-relaxed text-[#015ca0] dark:bg-sky-500/10 dark:text-sky-300">
              <strong>Demo credentials chip:</strong> persona picker on the left switches between Overseer / PM / Field Officer / Analyst / Auditor / Observer roles. RBAC views adapt automatically.
            </div>
          </div>
          <p className="mt-4 text-center text-[11px] text-white/60">Government of India · Ministry of Statistics & Programme Implementation · SIH 2026 · Team NEXGEN</p>
        </motion.div>
      </div>
    </div>
  );
}
