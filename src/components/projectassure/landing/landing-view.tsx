"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/store/app-store";
import {
  ShieldAlert, ArrowRight, FileSearch, TrendingUp, Bell, BrainCircuit, Lock,
  CheckCircle2, Globe, Activity, FileText, Mail, Workflow, Gauge, FolderKanban, FlaskConical, BookOpenCheck,
  ChevronDown, Menu, X, Sparkles,
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
  // v13: the full landing content is collapsed by default — a single corner toggle reveals it.
  // The hero is now clean: just the headline, one CTA and the trust strip.
  const [expanded, setExpanded] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // scroll-lock the body when expanded overlay is open on mobile
  useEffect(() => {
    if (expanded) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [expanded]);

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <GovHeader surface="public" />

      {/* ─── Slim sticky nav ─── */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0c93e7] to-[#0b426e] text-white shadow-sm">
              <ShieldAlert className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[14px] font-bold leading-none tracking-tight">ProjectAssure</div>
              <div className="text-[9.5px] font-medium text-muted-foreground">Intelligence-Powered Predictive Project Monitoring</div>
            </div>
          </div>
          <nav className="ml-6 hidden items-center gap-5 text-[12.5px] font-medium text-muted-foreground md:flex">
            <button onClick={() => setExpanded(true)} className="transition hover:text-foreground">Explore</button>
            <button onClick={() => goPage("about")} className="transition hover:text-foreground">About</button>
            <a href="https://project-assure.vercel.app" target="_blank" rel="noreferrer" className="transition hover:text-foreground">Live demo ↗</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => goPage("about")} className="hidden rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground transition hover:text-foreground sm:block">About</button>
            <button onClick={() => goPage("login")}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0b426e] to-[#0c93e7] px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm transition hover:shadow-md hover:shadow-[#0c93e7]/25">
              Launch demo <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setMobileNavOpen(o => !o)} className="rounded-lg border p-1.5 md:hidden">
              {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="border-t bg-background px-4 py-3 md:hidden">
            <div className="flex flex-col gap-2 text-[13px]">
              <button onClick={() => { setExpanded(true); setMobileNavOpen(false); }} className="text-left text-muted-foreground">Explore platform</button>
              <button onClick={() => { goPage("about"); setMobileNavOpen(false); }} className="text-left text-muted-foreground">About</button>
              <a href="https://project-assure.vercel.app" target="_blank" rel="noreferrer" className="text-muted-foreground">Live demo ↗</a>
            </div>
          </div>
        )}
      </header>

      {/* ─── Clean hero — single screen, no clutter ─── */}
      <section className="relative flex flex-1 items-center overflow-hidden">
        {/* subtle background — much calmer than v12 */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#e0effe]/40 via-background to-background dark:from-[#072b49]/30" />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

        <div className="relative mx-auto w-full max-w-4xl px-4 py-20 text-center sm:py-28">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-card/80 px-3.5 py-1.5 text-[11px] font-medium backdrop-blur">
              <span className="rounded-full bg-[#e0effe] px-2 py-0.5 text-[9.5px] font-bold text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]">SIH 2026 · SIH26103</span>
              <span className="text-muted-foreground">Team NEXGEN · Amrita Vishwa Vidyapeetham</span>
            </div>
            <h1 className="text-[34px] font-extrabold leading-[1.08] tracking-tight sm:text-[52px]">
              The intelligence cockpit for{" "}
              <span className="bg-gradient-to-r from-[#0c93e7] to-[#0b426e] bg-clip-text text-transparent dark:from-[#36adf6] dark:to-[#7cc8fb]">India&apos;s infrastructure</span>{" "}
              portfolio.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground sm:text-[16px]">
              Track → Analyse → Predict → Alert → Recommend — on one secure web address.
              Predicts delays <strong className="text-foreground">30–60 days early</strong>, reads field reports itself,
              and answers every question with cited evidence.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => goPage("login")}
                className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0b426e] to-[#0c93e7] px-6 py-3.5 text-[14.5px] font-semibold text-white shadow-lg shadow-[#0c93e7]/25 transition hover:scale-[1.02] hover:shadow-xl">
                Launch demo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button onClick={() => setExpanded(true)}
                className="rounded-xl border bg-card/70 px-6 py-3.5 text-[14.5px] font-semibold backdrop-blur transition hover:bg-card">
                Explore the platform
              </button>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />4 demo personas · 30 seeded projects</span>
              <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Secure per-user accounts</span>
              <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />One web address · any device</span>
            </div>
          </motion.div>

          {/* minimal proof strip — 4 inline stats, no separate section */}
          <motion.div {...fadeUp} className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { v: "1,800+", l: "projects tracked" },
              { v: "18", l: "risk signals" },
              { v: "<60s", l: "report → dashboard" },
              { v: "30", l: "live demo projects" },
            ].map(x => (
              <div key={x.l} className="rounded-lg border bg-card/70 px-3 py-3 text-center backdrop-blur">
                <div className="text-[22px] font-extrabold tabular leading-none text-[#0c93e7] dark:text-[#36adf6]">{x.v}</div>
                <div className="mt-1 text-[10.5px] leading-snug text-muted-foreground">{x.l}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ─── Corner toggle button — bottom right ─── */}
        <button
          onClick={() => setExpanded(true)}
          className="group fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full border bg-background/95 px-4 py-2.5 text-[12px] font-semibold shadow-lg backdrop-blur-md transition hover:shadow-xl hover:border-[#0c93e7]/50"
          aria-label="Expand full platform overview"
        >
          <Sparkles className="h-4 w-4 text-[#0c93e7] dark:text-[#36adf6]" />
          <span>Full overview</span>
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:translate-y-0.5" />
        </button>
      </section>

      {/* ─── Footer (slim, no dark band) ─── */}
      <footer className="mt-auto border-t bg-background py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#0c93e7] to-[#0b426e] text-white">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div className="text-[11.5px]">
              <div className="font-bold">ProjectAssure</div>
              <div className="text-muted-foreground">SIH 2026 · SIH26103 · Team NEXGEN · Amrita Vishwa Vidyapeetham Chennai</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10.5px] text-muted-foreground">
            <button onClick={() => setExpanded(true)} className="hover:text-foreground">Overview</button>
            <button onClick={() => goPage("about")} className="hover:text-foreground">About</button>
            <button onClick={() => goPage("login")} className="hover:text-foreground">Launch demo</button>
          </div>
        </div>
      </footer>

      {/* ─── EXPANDED FULL OVERVIEW — slide-over from the right ─── */}
      <AnimatePresence>
        {expanded && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setExpanded(false)}
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl overflow-y-auto bg-background shadow-2xl"
            >
              {/* expanded header */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-5 py-3 backdrop-blur">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#0c93e7] to-[#0b426e] text-white"><ShieldAlert className="h-4 w-4" /></div>
                  <span className="text-[14px] font-bold">ProjectAssure · Full overview</span>
                </div>
                <button onClick={() => setExpanded(false)} className="rounded-lg border p-1.5 transition hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-12 px-5 py-8">
                {/* Problem */}
                <section>
                  <motion.div {...fadeUp}>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-[#0c93e7] dark:text-[#36adf6]">The problem — project monitoring, today</div>
                    <h2 className="mt-2 max-w-2xl text-[22px] font-bold leading-tight tracking-tight">Decisions are made on data that is already months old.</h2>
                    <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
                      Field report (day 0–5) → manual re-entry (day 5–15) → consolidation (week 2–4) → compilation (week 4–8) → decision (week 8–12+). By the time a ₹1,450 Cr corridor shows red, the slip has already happened. ~900 analyst-hours a month go to transcription, not judgement.
                    </p>
                  </motion.div>
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {PROBLEM_STATS.map(s => (
                      <div key={s.label} className="rounded-xl border bg-card p-4">
                        <div className="text-[24px] font-extrabold tabular leading-none text-foreground">{s.value}</div>
                        <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Solution */}
                <section className="rounded-2xl border bg-muted/25 p-6">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[#0c93e7] dark:text-[#36adf6]">The solution</div>
                  <h2 className="mt-2 text-[22px] font-bold tracking-tight">Six capabilities, one pane of glass.</h2>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {PILLARS.map(p => (
                      <div key={p.title} className="rounded-xl border bg-card p-4 transition hover:border-[#0c93e7]/40 hover:shadow-md">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0c93e7]/10 text-[#015ca0] dark:text-[#7cc8fb]">
                          <p.icon className="h-4.5 w-4.5" />
                        </div>
                        <h3 className="mt-3 text-[14px] font-bold tracking-tight">{p.title}</h3>
                        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{p.body}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Features */}
                <section>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[#0c93e7] dark:text-[#36adf6]">What you get</div>
                  <h2 className="mt-2 text-[22px] font-bold tracking-tight">Seven features. Every one of them works.</h2>
                  <p className="mt-2 max-w-2xl text-[13px] text-muted-foreground">No clutter, no dead buttons — a compact set of high-impact screens, each fully functional in the live prototype.</p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {FEATURES.map(f => (
                      <div key={f.name} className="flex gap-3 rounded-xl border bg-card p-4 transition hover:border-[#0c93e7]/40 hover:shadow-md">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0c93e7]/10 text-[#015ca0] dark:text-[#7cc8fb]">
                          <f.icon className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <h3 className="text-[13.5px] font-bold tracking-tight">{f.name}</h3>
                          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{f.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Workflow */}
                <section className="rounded-2xl border border-[#0c93e7]/30 bg-[#072b49] p-6 text-white">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[#7cc8fb]">The pipeline</div>
                  <h2 className="mt-2 text-[22px] font-bold tracking-tight">From paper to prediction to action.</h2>
                  <div className="mt-6 grid gap-3 md:grid-cols-5">
                    {WORKFLOW.map((w, i) => (
                      <div key={w.step} className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold tracking-widest text-[#7cc8fb]">{w.step}</span>
                          <span className="text-[16px] font-extrabold text-white/15 tabular">0{i + 1}</span>
                        </div>
                        <p className="mt-2 text-[11.5px] leading-relaxed text-white/80">{w.body}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Trust */}
                <section>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[#0c93e7] dark:text-[#36adf6]">Built for trust</div>
                  <h2 className="mt-2 text-[22px] font-bold tracking-tight">Trust-first by design.</h2>
                  <div className="mt-6 grid gap-3 md:grid-cols-3">
                    {[
                      { icon: Globe, t: "One web address", d: "A single secure link for the whole platform — no installs, no downloads, no setup." },
                      { icon: TrendingUp, t: "Explainable predictions", d: "Every risk verdict shows its probability, confidence range and the top driving factors — never a black box." },
                      { icon: Lock, t: "Every action audited", d: "Role-based access; a tamper-proof trail records every change, export and intelligence answer." },
                    ].map(x => (
                      <div key={x.t} className="rounded-xl border bg-card p-4">
                        <x.icon className="h-4.5 w-4.5 text-[#0c93e7] dark:text-[#36adf6]" />
                        <h3 className="mt-2 text-[13.5px] font-bold">{x.t}</h3>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{x.d}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* CTA at bottom of expanded view */}
                <section className="rounded-2xl border bg-gradient-to-br from-[#0b426e] to-[#0c93e7] p-8 text-center text-white">
                  <h2 className="text-[22px] font-extrabold tracking-tight">See the portfolio breathe.</h2>
                  <p className="mx-auto mt-2 max-w-xl text-[12.5px] text-white/85">
                    Create your own secure account, register your projects, upload field reports and watch the engine flag risks —
                    or sign in as the Portfolio Overseer and explore the 30-project demo portfolio.
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    <button onClick={() => { setExpanded(false); goPage("login"); }}
                      className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-[14px] font-bold text-[#0b426e] shadow-lg transition hover:scale-[1.02]">
                      Launch demo <ArrowRight className="h-4 w-4" />
                    </button>
                    <button onClick={() => { setExpanded(false); goPage("about"); }}
                      className="rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-[14px] font-semibold text-white backdrop-blur transition hover:bg-white/20">
                      About & team
                    </button>
                  </div>
                </section>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
