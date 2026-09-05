"use client";

import React from "react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import {
  ShieldAlert, ArrowRight, FileSearch, TrendingUp, Bell, BrainCircuit, Lock,
  CheckCircle2, Globe, Activity, FileText, Mail, Workflow, Gauge, FolderKanban, FlaskConical, BookOpenCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import GovHeader from "../shared/gov-header";

const fadeUp = { initial: { opacity: 0, y: 22 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const } };

const PROBLEM_STATS = [
  { value: "1,800+", label: "central-sector projects tracked by the ministry (₹150 Cr+ each)" },
  { value: "~50 mo", label: "average time overrun on delayed projects" },
  { value: "20%+", label: "average cost overrun across the portfolio" },
  { value: "27,000", label: "report pages analysts read manually every month" },
];

const PILLARS = [
  { icon: TrendingUp, title: "Predicts, not reports", body: "Smart risk models flag at-risk projects 30–60 days before the slip — with a probability, an estimated delay and the top reasons in plain language." },
  { icon: Activity, title: "One health score", body: "A 0–100 composite — Schedule 30% · Budget 25% · Resources 20% · Milestones 25%. Green ≥75, Amber 50–74, Red <50. Triage the whole portfolio in 30 seconds." },
  { icon: FileSearch, title: "Reads reports itself", body: "Progress reports, budget sheets and scanned site documents are read and structured automatically — dashboards update in under a minute, with zero manual re-entry." },
  { icon: Bell, title: "Risk-ranked alerts", body: "Budget overrun above 10% warns, above 20% escalates; high delay risk emails the right officer. Every alert carries a recommended action, an owner and a deadline." },
  { icon: BrainCircuit, title: "Ask anything, with evidence", body: "“Why is this project at risk?” — the assistant answers with cited sources, data freshness stamps and a step-by-step action plan. No made-up numbers." },
  { icon: Lock, title: "Governance-grade", body: "Role-based access for officers, managers and viewers; every change is recorded in a tamper-proof trail. One secure web address for the whole platform." },
];

const FEATURES = [
  { icon: Gauge, name: "Dashboard", body: "The whole portfolio in one glance — worst-first attention list, health bands, live activity and the week's key movements." },
  { icon: FolderKanban, name: "Projects", body: "Create or import a project, upload its documents, and watch it get scored instantly. Search, filter and drill into any district or sector." },
  { icon: BrainCircuit, name: "Assure Intelligence", body: "A project-aware assistant that answers questions, explains risks and drafts recommended actions — grounded in your live data." },
  { icon: FlaskConical, name: "Prediction Engine", body: "Run delay and cost predictions for any project, see the driving factors, and re-score the portfolio — all metrics in plain language." },
  { icon: FileText, name: "Reports & Exports", body: "Board-ready summaries, risk packs and project dossiers — exported to PDF, Excel or CSV in one click." },
  { icon: Mail, name: "Email Centre", body: "Send any report to any email address — portfolio pulses, project alerts and document digests, with delivery tracking." },
  { icon: BookOpenCheck, name: "Help & Guide", body: "A built-in plain-language guide: what each screen does, what to enter where, and how the whole pipeline fits together." },
];

const WORKFLOW = [
  { step: "UPLOAD", body: "Field reports arrive as PDF, Excel or scans; the platform reads them and extracts every key figure with confidence scores." },
  { step: "ANALYSE", body: "The engine computes 18 risk signals and a 4-dimension health score for every project, refreshed around the clock." },
  { step: "PREDICT", body: "Delay probability, estimated slip in days and cost-overrun forecasts — each with the plain-language reasons behind it." },
  { step: "ALERT", body: "Risk-ranked alerts reach the right officer via in-app, email and digests — each with an action, owner and deadline." },
  { step: "RECOMMEND", body: "The assistant grounds every recommendation in cited evidence; officers verify and the audit trail closes the loop." },
];

export default function LandingView() {
  const goPage = useApp(s => s.goPage);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* v8: universal official portal band */}
      <GovHeader surface="public" />
      {/* ─── Nav ─── */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0c93e7] to-[#0b426e] text-white shadow-md shadow-[#0c93e7]/25">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[15px] font-bold leading-none tracking-tight">ProjectAssure</div>
              <div className="text-[10px] font-medium text-muted-foreground">Intelligence-Powered Predictive Project Monitoring</div>
            </div>
          </div>
          <nav className="ml-8 hidden items-center gap-6 text-[13px] font-medium text-muted-foreground md:flex">
            <a href="#problem" className="transition hover:text-foreground">Problem</a>
            <a href="#solution" className="transition hover:text-foreground">Solution</a>
            <a href="#features" className="transition hover:text-foreground">Features</a>
            <a href="#workflow" className="transition hover:text-foreground">Workflow</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => goPage("about")} className="hidden rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition hover:text-foreground sm:block">About</button>
            <button onClick={() => goPage("login")}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0b426e] to-[#0c93e7] px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:shadow-md hover:shadow-[#0c93e7]/25">
              Launch demo <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="pa-hero-mesh relative overflow-hidden">
        <div className="pa-grid-bg absolute inset-0 opacity-60" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-20 sm:pt-28">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-card/80 px-3.5 py-1.5 text-[11.5px] font-medium backdrop-blur">
              <span className="rounded-full bg-[#e0effe] px-2 py-0.5 text-[10px] font-bold text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]">SIH 2026 · SIH26103</span>
              <span className="text-muted-foreground">Smart Automation · SIH26103 · Team NEXGEN</span>
            </div>
            <h1 className="text-[34px] font-extrabold leading-[1.08] tracking-tight sm:text-[52px]">
              The intelligence cockpit that watches every{" "}
              <span className="bg-gradient-to-r from-[#0c93e7] to-[#0b426e] bg-clip-text text-transparent dark:from-[#36adf6] dark:to-[#7cc8fb]">rupee</span> and every{" "}
              <span className="bg-gradient-to-r from-[#22c55e] to-[#0c93e7] bg-clip-text text-transparent">deadline</span>.
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground sm:text-[16.5px]">
              India runs 1,800+ central-sector infrastructure projects through ~27,000 pages of monthly paper. Data arrives weeks stale and overruns are discovered <em>after</em> they happen. ProjectAssure flips the model — <strong className="text-foreground">Track → Analyse → Predict → Alert → Recommend</strong> — on one secure web address, with zero licence cost.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button onClick={() => goPage("login")}
                className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0b426e] to-[#0c93e7] px-6 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-[#0c93e7]/30 transition hover:scale-[1.02] hover:shadow-xl">
                Create your free account
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button onClick={() => goPage("about")} className="rounded-xl border bg-card/70 px-6 py-3.5 text-[15px] font-semibold backdrop-blur transition hover:bg-card">
                How it works
              </button>
              <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Real sign-up · own projects · or 30 seeded demo projects
              </div>
            </div>
          </motion.div>

          {/* hero proof strip */}
          <motion.div {...fadeUp} className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { v: "75%", l: "delay probability flagged on the flagship corridor — 44 days early", tone: "text-amber-600 dark:text-amber-400" },
              { v: "<60s", l: "from report upload to validated dashboard fields", tone: "text-[#0c93e7] dark:text-[#36adf6]" },
              { v: "18", l: "risk signals tracked for every single project", tone: "text-emerald-600 dark:text-emerald-400" },
              { v: "30", l: "live demo projects ready to explore the moment you sign in", tone: "text-violet-600 dark:text-violet-400" },
            ].map(x => (
              <div key={x.l} className="rounded-xl border bg-card/70 p-4 backdrop-blur">
                <div className={cn("text-[26px] font-extrabold tabular leading-none", x.tone)}>{x.v}</div>
                <div className="mt-1.5 text-[11.5px] leading-snug text-muted-foreground">{x.l}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Problem ─── */}
      <section id="problem" className="mx-auto max-w-6xl px-4 py-20">
        <motion.div {...fadeUp}>
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#0c93e7] dark:text-[#36adf6]">The problem — project monitoring, today</div>
          <h2 className="mt-2 max-w-2xl text-[26px] font-bold leading-tight tracking-tight sm:text-[32px]">Decisions are made on data that is already months old.</h2>
          <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">
            Field report (day 0–5) → manual re-entry (day 5–15) → consolidation (week 2–4) → compilation (week 4–8) → decision (week 8–12+). By the time a ₹1,450 Cr corridor shows red, the slip has already happened. ~900 analyst-hours a month go to transcription, not judgement.
          </p>
        </motion.div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PROBLEM_STATS.map((s, i) => (
            <motion.div key={s.label} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.07 }}
              className="rounded-xl border bg-card p-5">
              <div className="text-[28px] font-extrabold tabular leading-none text-foreground">{s.value}</div>
              <div className="mt-2 text-[11.5px] leading-snug text-muted-foreground">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Solution pillars ─── */}
      <section id="solution" className="border-y bg-muted/25 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div {...fadeUp}>
            <div className="text-[11px] font-bold uppercase tracking-widest text-[#0c93e7] dark:text-[#36adf6]">The solution</div>
            <h2 className="mt-2 text-[26px] font-bold tracking-tight sm:text-[32px]">Six capabilities, one pane of glass.</h2>
          </motion.div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((p, i) => (
              <motion.div key={p.title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.06 }}
                className="group rounded-xl border bg-card p-5 transition hover:border-[#0c93e7]/40 hover:shadow-lg hover:shadow-black/5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0c93e7]/10 text-[#015ca0] transition group-hover:scale-110 dark:text-[#7cc8fb]">
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3.5 text-[15px] font-bold tracking-tight">{p.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{p.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Seven features ─── */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20">
        <motion.div {...fadeUp} className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-[#0c93e7] dark:text-[#36adf6]">What you get</div>
            <h2 className="mt-2 text-[26px] font-bold tracking-tight sm:text-[32px]">Seven features. Every one of them works.</h2>
            <p className="mt-2 max-w-2xl text-[14px] text-muted-foreground">No clutter, no dead buttons — a compact set of high-impact screens, each fully functional in the live prototype.</p>
          </div>
          <button onClick={() => goPage("login")} className="flex items-center gap-1.5 text-[13.5px] font-semibold text-[#0c93e7] hover:underline dark:text-[#36adf6]">
            Explore them live <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </motion.div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div key={f.name} {...fadeUp} transition={{ ...fadeUp.transition, delay: (i % 6) * 0.05 }}
              className="flex gap-3.5 rounded-xl border bg-card p-5 transition hover:border-[#0c93e7]/40 hover:shadow-lg hover:shadow-black/5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0c93e7]/10 text-[#015ca0] dark:text-[#7cc8fb]">
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-[14.5px] font-bold tracking-tight">{f.name}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            </motion.div>
          ))}
          {/* trust card completes the 8th grid cell */}
          <motion.div {...fadeUp} className="flex gap-3.5 rounded-xl border border-dashed bg-muted/30 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-[14.5px] font-bold tracking-tight">Everything else, included</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">Secure per-user accounts, role-based access, live tracking feed, map view, dark mode and keyboard search — built in, not bolted on.</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Workflow ─── */}
      <section id="workflow" className="border-y bg-[#072b49] py-20 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div {...fadeUp}>
            <div className="text-[11px] font-bold uppercase tracking-widest text-[#7cc8fb]">The pipeline</div>
            <h2 className="mt-2 text-[26px] font-bold tracking-tight sm:text-[32px]">From paper to prediction to action.</h2>
          </motion.div>
          <div className="mt-10 grid gap-4 md:grid-cols-5">
            {WORKFLOW.map((w, i) => (
              <motion.div key={w.step} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.09 }} className="relative">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-bold tracking-widest text-[#7cc8fb]">{w.step}</span>
                    <span className="text-[18px] font-extrabold text-white/15 tabular">0{i + 1}</span>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-white/80">{w.body}</p>
                </div>
                {i < WORKFLOW.length - 1 && <ArrowRight className="absolute -right-3.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-[#0c93e7] md:block" />}
              </motion.div>
            ))}
          </div>
          <motion.div {...fadeUp} className="mt-10 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <Workflow className="h-5 w-5 text-[#7cc8fb]" />
            <p className="flex-1 text-[13px] text-white/80">
              The whole platform lives at one secure web address — open it in any browser, sign in, and the portfolio is live. The same pipeline that powers the demo is documented end-to-end for production rollout.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─── Trust ─── */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <motion.div {...fadeUp}>
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#0c93e7] dark:text-[#36adf6]">Built for trust</div>
          <h2 className="mt-2 text-[26px] font-bold tracking-tight sm:text-[32px]">Trust-first by design.</h2>
        </motion.div>
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {[
            { icon: Globe, t: "One web address", d: "A single secure link for the whole platform — no installs, no downloads, no setup. Open it on any device and the dashboard is live." },
            { icon: TrendingUp, t: "Explainable predictions", d: "Every risk verdict shows its probability, confidence range and the top driving factors — officers see the reasoning, not a black box." },
            { icon: Lock, t: "Every action audited", d: "Role-based access for administrators, project managers, stakeholders and viewers; a tamper-proof trail records every change, export and intelligence answer." },
          ].map(x => (
            <div key={x.t} className="rounded-xl border bg-card p-5">
              <x.icon className="h-5 w-5 text-[#0c93e7] dark:text-[#36adf6]" />
              <h3 className="mt-2.5 text-[14px] font-bold">{x.t}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="pa-hero-mesh relative overflow-hidden py-24">
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <motion.div {...fadeUp}>
            <h2 className="text-[28px] font-extrabold tracking-tight sm:text-[36px]">See the portfolio breathe.</h2>
            <p className="mx-auto mt-3 max-w-xl text-[14.5px] text-muted-foreground">
              Create your own secure account, register your projects, upload field reports and watch the engine
              flag risks — or sign in as the Portfolio Overseer and explore the 30-project demo portfolio with the
              flagship corridor's 75% delay verdict. Export the evidence as a polished PDF and email it anywhere.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => goPage("login")}
                className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0b426e] to-[#0c93e7] px-7 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-[#0c93e7]/30 transition hover:scale-[1.02]">
                Create account / launch demo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button onClick={() => goPage("about")} className="rounded-xl border bg-card px-7 py-3.5 text-[15px] font-semibold transition hover:bg-muted">About & team</button>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[11.5px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Secure accounts · per-user data</span>
              <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />Email reports to any address</span>
              <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />PDF · Excel · CSV exports</span>
              <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />One web address · any device</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="mt-auto border-t bg-[#072b49] py-8 text-white/70">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10"><ShieldAlert className="h-4 w-4 text-[#7cc8fb]" /></div>
              <div className="text-[12.5px]">
                <div className="font-bold text-white">ProjectAssure</div>
                <div className="text-white/50">Smart India Hackathon 2026 · Problem SIH26103</div>
              </div>
            </div>
            <div className="text-[11px] leading-relaxed">
              <div>Problem SIH26103 · Theme: Smart Automation · Category: Software</div>
              <div>Team NEXGEN — Amrita Vishwa Vidyapeetham, Chennai Campus</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
