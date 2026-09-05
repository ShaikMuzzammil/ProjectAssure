"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Workflow — "How the platform works", end to end, inside the app.
// The full pipeline from login to export, one stage at a time, with the
// screen to open, what happens under the hood, and what you will see.
// Written for a first-time visitor AND for team members onboarding onto the
// codebase/demo (mirrors docs/TEAM_GUIDE.md).
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LogIn, FolderPlus, FileUp, Gauge, BrainCircuit, Bell, Sparkles,
  Wrench, FileDown, Mail, ChevronRight, ChevronDown, ShieldCheck,
  MapPin, Database, Lock, ArrowRight, LayoutDashboard,
} from "lucide-react";

interface Stage {
  icon: React.ElementType;
  n: number;
  title: string;
  screen: string;          // where in the app
  view: Parameters<ReturnType<typeof useApp.getState>["navigate"]>[0];
  what: string;            // what happens (plain language)
  under: string;           // under the hood (for the tech-curious)
  see: string[];           // what you will see
}

const STAGES: Stage[] = [
  {
    icon: LayoutDashboard, n: 0, title: "Start simple — 9 one-idea screens", screen: "Simple Overview (first sidebar group)", view: "monitor",
    what: "New here? The first sidebar group — Simple Monitoring — gives you the whole portfolio in nine one-idea pages: Simple Overview (four big numbers), Risk Scores, Budget Variance, Cost Benchmark, Progress Mismatch, Procurement, Change Orders, Authority Review and Project Search. You can run your entire day from these without touching anything deeper.",
    under: "Every simple screen is derived LIVE from the same store the deep platform uses (src/lib/projectassure/monitor.ts) — deterministic derivations, no second source of truth, so simple and deep screens always agree.",
    see: ["Simple Overview: total projects, budget, high-risk, unread alerts", "Risk Scores: one 0–100 number per project + top 3 plain-language drivers", "Authority Review: only the projects that need a decision, each with ONE action", "Every screen exports CSV/Excel; the Authority view exports a briefing PDF"],
  },
  {
    icon: LogIn, n: 1, title: "Log in securely", screen: "Login page", view: "dashboard",
    what: "Sign in with your own account (created once, free) or pick a demo persona to explore. Your password is never stored as plain text, and every account only ever sees its own projects.",
    under: "Client-side PBKDF2-SHA256 (100k iterations, 128-bit salt) + server scrypt hash in PostgreSQL. Sessions are per-user; every screen, answer and export is RBAC-scoped.",
    see: ["Two ways in: Sign in / Create account", "6 demo personas for instant exploration", "Right panel explains the platform in plain words"],
  },
  {
    icon: Gauge, n: 2, title: "See what needs attention today", screen: "Command Centre", view: "dashboard",
    what: "The dashboard opens with one question answered first: which projects need intervention right now, and the plain-language reason for each. Portfolio totals, health distribution, budget gauge and critical alerts sit around it.",
    under: "Portfolio stats are recomputed from live project records on every mutation — 30/25/20/25 weighted health (schedule, budget, resources, milestones), not a cached snapshot.",
    see: ["“Requires attention today” list with What-to-do buttons", "Total / On track / At risk / Critical counters", "Live portfolio feed ticking in real time"],
  },
  {
    icon: FolderPlus, n: 3, title: "Create your own project", screen: "Projects → New project", view: "projects",
    what: "A 6-step wizard takes a name, location, dates, budget, team and documents. New projects start Green (~95 health) and get a baseline risk score immediately — nothing to set up.",
    under: "District is geocoded onto the live map; a starter milestone set + task graph is seeded so Gantt/Kanban work instantly; uploaded files flow into the OCR/RAG pipeline; PS-ID is allocated without collisions.",
    see: ["Stage choice: Planning (baseline score) vs Execution (full scoring)", "Per-step validation with specific messages", "Created project opens on its detail page"],
  },
  {
    icon: FileUp, n: 4, title: "Upload evidence (the platform reads it)", screen: "Project detail → Documents", view: "projects",
    what: "Drop DPRs, field reports, budget sheets (PDF/XLSX/CSV/TXT/MD/JSON/PNG/JPG). Each file is parsed, its text chunked and embedded — then it becomes searchable evidence that intelligence answers cite with file + page.",
    under: "Real TXT/CSV/MD/JSON parsing + staged OCR pipeline; 256-dim hashing embeddings + cosine similarity (RAG-lite vector store); processed documents feed the smart summary and analytics.",
    see: ["Per-file pipeline: Uploaded → Parsed → Chunked → Embedded → PROCESSED", "Smart summary extracted from the real file content", "Vector Store screen to test semantic search"],
  },
  {
    icon: BrainCircuit, n: 5, title: "The engine scores and predicts", screen: "Project detail → Risk & Intelligence", view: "projects",
    what: "A 0–100 health score per project (four weighted dimensions) plus a delay prediction: probability of missing the date, estimated slip in days, and a confidence interval — with the top factors named in plain language.",
    under: "18-signal ML model (task completion, milestone adherence, burn velocity, monsoon, procurement…) → logistic model with factor analysis-style factor contributions; re-scored on every data change; 90% CI.",
    see: ["Health ring + four sub-scores with weights", "Prediction dial: probability, slip days, CI", "Factor waterfall: green reduces risk, red raises it", "What-if simulator: move progress/spend, watch health move"],
  },
  {
    icon: Bell, n: 6, title: "Alerts fire before it's obvious", screen: "Early Warnings", view: "alerts",
    what: "Rule-based early warnings (R1–R12): projected overrun, delay probability, burn velocity, health entering Red, report staleness. Each alert carries a recommended action, owner and deadline.",
    under: "Alert rules re-evaluated after every mutation; severity-ranked; acknowledgement is audit-logged; email-channel rules can queue real sends from the Email Centre.",
    see: ["Severity-ranked alert list (worst first)", "Acknowledge with one click (audit-logged)", "Every alert explains itself in plain words"],
  },
  {
    icon: Sparkles, n: 7, title: "Ask Assure Intelligence for the plan", screen: "Assure Intelligence (any screen, or ⌘K)", view: "ai-assistant",
    what: "Open the assistant anywhere. Inside a project it scopes itself to THAT project and returns the full Intelligence recommended system: verdict, delay outlook, ranked actions (what/why/do/owner/deadline), root-cause tree, KPI watch, and the cost of doing nothing.",
    under: "ReAct agent with 8 real tools (query_projects, run_delay_prediction, search_documents, build_action_plan…); deterministic engine by default, a live intelligence service in live mode with the same grounding; answers cite tools and documents.",
    see: ["Context chip “Scoped to: <project>”", "Tool-call trace with real latencies", "Citations that resolve to file + page", "Recommended actions ranked P1/P2/P3"],
  },
  {
    icon: Wrench, n: 8, title: "Track the fix as an intervention", screen: "Interventions Centre", view: "interventions",
    what: "One click converts any recommendation into a tracked intervention with an owner, deadline and a 7-step lifecycle from DETECTED to CLOSED. Progress notes accumulate as evidence.",
    under: "Intervention lifecycle state machine; every step change is audit-logged; closure requires the verification note (human-in-the-loop, rule R10).",
    see: ["Intervention cards with stage + deadline", "7-step lifecycle tracker", "Updates timeline per intervention"],
  },
  {
    icon: FileDown, n: 9, title: "Export anything, anywhere", screen: "Every screen", view: "analytics",
    what: "PDF for review meetings, Excel for analysts, CSV for data teams — from the dashboard, projects, alerts, interventions, analytics and every project's detail page. Export history is recorded.",
    under: "jsPDF branded reports (real files, not screenshots), SheetJS multi-sheet workbooks, CSV; every export is audit-logged with scope.",
    see: ["Export buttons on every domain", "Analytics report builder with 6 report kinds", "Export history with who/when/scope"],
  },
  {
    icon: Mail, n: 10, title: "Email reports to anyone", screen: "Email Centre", view: "email-center",
    what: "Send any report or alert email to any address, with attachments. Delivery status is honest: SENT, SIMULATED (no provider configured yet) or FAILED (with the exact fix shown).",
    under: "Provider chain: email service (Gmail App Password) → Brevo → Resend → simulated outbox. Diagnostics endpoint shows exactly which provider and key is missing.",
    see: ["Compose + outbox with delivery states", "Provider setup guide in Settings", "Delivery log with actionable hints"],
  },
];

const DOMAINS = [
  { icon: LayoutDashboard, label: "SIMPLE", items: ["Simple Overview", "Risk Scores", "Budget Variance", "Cost Benchmark", "Progress Mismatch", "Procurement", "Change Orders", "Authority Review", "Project Search"], desc: "The 9-screen starter kit: one idea per page, live data, nothing to learn." },
  { icon: Gauge, label: "MONITOR", items: ["Command Centre", "Projects", "Analytics", "Compare Projects"], desc: "See the truth: every project, live scores, drill-downs." },
  { icon: Wrench, label: "RESPOND", items: ["Early Warnings", "Interventions", "Reports & Docs", "Email Centre"], desc: "Act on it: alerts → recommendations → tracked fixes → communication." },
  { icon: Sparkles, label: "INTELLIGENCE", items: ["Assure Intelligence", "Prediction Engine", "Vector Store", "Workflow · Help"], desc: "Understand it: grounded intelligence answers, model metrics, semantic search." },
  { icon: ShieldCheck, label: "GOVERN", items: ["Administration"], desc: "Control it: users, thresholds, alert rules, audit trail." },
];

export default function WorkflowView() {
  const navigate = useApp(s => s.navigate);
  const [open, setOpen] = useState(0);

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight">Workflow — how ProjectAssure works</h1>
        <p className="mt-0.5 max-w-3xl text-[12.5px] leading-relaxed text-muted-foreground">
          The whole platform in one pipeline: from your first login to a delivered, verified fix.
          Open any stage to see <strong className="text-foreground/80">what happens</strong>,{" "}
          <strong className="text-foreground/80">where to click</strong> and{" "}
          <strong className="text-foreground/80">what you will see</strong>. The same guide ships as
          docs/TEAM_GUIDE.md in the project zip — share it with your team.
        </p>
      </div>

      {/* pipeline overview strip */}
      <div className="rounded-xl border bg-card p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">The pipeline at a glance</div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {["Simple view", "Login", "Dashboard", "Create project", "Upload evidence", "Health + prediction", "Alerts", "Intelligence plan", "Intervention", "Export", "Email"].map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/50" />}
              <span className={cn("rounded-md px-2 py-1 text-[10.5px] font-semibold",
                i === 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" :
                i >= 8 ? "bg-violet-500/10 text-violet-600 dark:text-violet-300" :
                "bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]")}>
                {i + 1}. {s}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 11 stages (0 = Simple Monitoring entry point) */}
      <div className="space-y-2">
        {STAGES.map((s, i) => {
          const isOpen = open === i;
          return (
            <motion.div key={s.n} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className={cn("overflow-hidden rounded-xl border bg-card transition", isOpen && "border-[#0c93e7]/40 shadow-sm")}>
              <button onClick={() => setOpen(isOpen ? -1 : i)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white", isOpen ? "bg-gradient-to-br from-[#0b426e] to-[#0c93e7]" : "bg-muted text-muted-foreground")}>
                  <s.icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold tracking-tight">{s.n === 0 ? "START" : s.n} · {s.title}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" /> {s.screen}
                  </div>
                </div>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div className="grid gap-3 border-t px-4 py-3.5 md:grid-cols-[1.2fr_1fr]">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">What happens</div>
                    <p className="mt-1 text-[12.5px] leading-relaxed">{s.what}</p>
                    <div className="mt-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">You will see</div>
                    <ul className="mt-1 space-y-1">
                      {s.see.map(x => (
                        <li key={x} className="flex items-start gap-1.5 text-[12px] leading-snug text-foreground/85">
                          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#0c93e7]" />{x}
                        </li>
                      ))}
                    </ul>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate(s.view)}>
                      Open {s.screen.split("→")[0].trim()} <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Database className="h-3 w-3" /> Under the hood
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{s.under}</p>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* 4 domains */}
      <div className="rounded-xl border bg-card p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">The sidebar is organised into 4 domains</div>
        <div className="mt-2.5 grid gap-2.5 md:grid-cols-4">
          {DOMAINS.map(d => (
            <div key={d.label} className="rounded-lg border bg-muted/25 p-3">
              <div className="flex items-center gap-2">
                <d.icon className="h-4 w-4 text-[#0c93e7]" />
                <span className="text-[11.5px] font-bold tracking-wide">{d.label}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{d.desc}</p>
              <ul className="mt-2 space-y-0.5">
                {d.items.map(x => <li key={x} className="text-[11px] font-medium text-foreground/80">· {x}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* security */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-emerald-600" />
          <span className="text-[13.5px] font-bold tracking-tight">Your data stays yours</span>
        </div>
        <p className="mt-1.5 max-w-3xl text-[12px] leading-relaxed text-muted-foreground">
          Every account gets its own workspace: projects you create are visible to you (and the roles you choose to share with) —
          never mixed with other users' data. Passwords are hashed (never stored readable), every action lands in an append-only
          audit trail, and no API key or domain link is ever shown in the interface.
        </p>
      </div>
    </div>
  );
}
