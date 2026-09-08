"use client";
// ═══════════════════════════════════════════════════════════════════════════
// #/demo — the dedicated demo-persona route.
// Four ready personas, each with a full private workspace: their own
// notifications, scoped projects and role-tuned screens. One click enters.
// Freshly created accounts (Sign up) live separately on #/login — demo
// traffic and real users never mix.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { useApp } from "@/store/app-store";
import { USERS } from "@/lib/projectassure/seed";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, BadgeCheck, Bell, BrainCircuit, Building2, ChartNoAxesCombined,
  Eye, FileSearch, FolderKanban, Lock, Mail, ShieldCheck, Sparkles, Users2, Zap,
} from "lucide-react";

const ROLE_EXTRAS: Record<string, { icon: typeof Eye; perks: string[] }> = {
  ADMIN: {
    icon: ShieldCheck,
    perks: ["All 30+ projects visible", "Broadcast to every user", "Host Control bridge live", "Full audit trail"],
  },
  PROJECT_MANAGER: {
    icon: FolderKanban,
    perks: ["Own projects + ministry block", "Milestone boards & Gantt", "Predictions re-scored live", "Geo evidence review"],
  },
  STAKEHOLDER: {
    icon: ChartNoAxesCombined,
    perks: ["Department-wide visibility", "Analytics + benchmarks", "Export centre", "Alert digests"],
  },
  VIEWER: {
    icon: Eye,
    perks: ["Read-only strategic briefs", "Public-style status pages", "Zero write access", "Safe for observers"],
  },
};

export default function DemoView() {
  const login = useApp(s => s.login);
  const goPage = useApp(s => s.goPage);
  const [busy, setBusy] = useState<string | null>(null);
  const [entered, setEntered] = useState<string | null>(null);

  const enter = async (email: string, password: string, name: string) => {
    setBusy(email);
    const res = await login(email, password);
    setBusy(null);
    if (res.ok) {
      setEntered(name);
      toast.success(`Entered as ${name}`, { description: "The persona's own workspace is loading — notifications are isolated to this account." });
      setTimeout(() => goPage("app"), 600);
    } else {
      toast.error("Could not enter the demo", { description: res.error });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-sky-50/60 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => goPage("landing")} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to landing
          </button>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-400">
            <Lock className="h-3.5 w-3.5" /> DEMO ROUTE · NO REAL DATA
          </div>
        </div>

        {/* hero */}
        <div className="mt-10 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300">
            <Sparkles className="h-3.5 w-3.5" /> 4 demo personas · separate from real accounts
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Try every role in one click
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
            Each persona opens its own workspace — scoped projects, isolated notifications and
            role-tuned screens. New users you create live separately on the{" "}
            <button onClick={() => goPage("login")} className="font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 dark:text-sky-300">
              login page
            </button>
            , so demo traffic and fresh accounts never mix.
          </p>
        </div>

        {/* persona grid */}
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {USERS.map((u) => {
            const extras = ROLE_EXTRAS[u.role] ?? ROLE_EXTRAS.VIEWER;
            const Icon = extras.icon;
            return (
              <div
                key={u.id}
                className={`group relative overflow-hidden rounded-2xl border bg-white p-6 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 dark:bg-slate-900 ${
                  entered === u.name ? "border-emerald-400 ring-2 ring-emerald-200 dark:ring-emerald-900" : "border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-indigo-600 text-lg font-bold text-white">
                      {u.avatarInitials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{u.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          u.role === "ADMIN" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                          : u.role === "PROJECT_MANAGER" ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                          : u.role === "STAKEHOLDER" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }`}>{u.role.replace("_", " ")}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{u.designation} · {u.email}</p>
                    </div>
                  </div>
                  <Icon className="h-5 w-5 text-slate-300 transition-colors group-hover:text-sky-500 dark:text-slate-600" />
                </div>

                <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{u.personaDescription}</p>

                <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
                  {extras.perks.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> {p}
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-500">
                    one-click entry — no password needed
                  </div>
                  <button
                    onClick={() => enter(u.email, u.password, u.name)}
                    disabled={busy === u.email}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-sky-400"
                  >
                    {busy === u.email ? "Entering…" : entered === u.name ? "Entered ✓" : "Enter as this persona"}
                    {entered !== u.name && <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* what runs inside */}
        <div className="mt-12 rounded-2xl border border-slate-200 bg-white/70 p-6 dark:border-slate-800 dark:bg-slate-900/60">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">What is live inside every persona</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: BrainCircuit, t: "Assure Intelligence", d: "Chat grounded on the scoped portfolio · uploaded files parsed for real · citations shown" },
              { icon: Zap, t: "Prediction Engine", d: "Train real models in-browser · Monte Carlo · survival · drift — promote a champion" },
              { icon: Bell, t: "Isolated notifications", d: "Each persona sees only its own alerts — no cross-user leaks" },
              { icon: Users2, t: "Host Control bridge", d: "Logins, users and alerts mirror to the host platform in real time" },
            ].map(({ icon: F, t, d }) => (
              <div key={t} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
                <F className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                <div className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{t}</div>
                <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* footer strip */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-slate-200 pt-6 text-xs text-slate-400 dark:border-slate-800">
          <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> MoSPI demo world · 30 seeded projects</span>
          <span className="inline-flex items-center gap-1.5"><FileSearch className="h-3.5 w-3.5" /> every number derived, never hardcoded</span>
          <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> demo emails simulated honestly</span>
          <button onClick={() => goPage("public")} className="inline-flex items-center gap-1.5 font-semibold text-sky-700 hover:underline dark:text-sky-300">
            <Eye className="h-3.5 w-3.5" /> Citizen view (no login)
          </button>
        </div>
      </div>
    </div>
  );
}
