"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Help & Glossary — the first-time visitor's guide to ProjectAssure.
// Every technical term in the app, explained in plain language.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { GLOSSARY } from "@/lib/projectassure/glossary";
import { useApp } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BookOpenCheck, Search, Compass, MousePointerClick, ShieldCheck, Sparkles, ChevronRight, MapPin } from "lucide-react";

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  metric: { label: "Metrics & scores", icon: "📊" },
  ml: { label: "Intelligence & predictions", icon: "🧠" },
  process: { label: "How the platform works", icon: "🔄" },
  security: { label: "Security & accounts", icon: "🔐" },
  platform: { label: "Platform & tech", icon: "🖥️" },
};

const TOUR = [
  { icon: Compass, title: "1 · Start at the Command Centre", body: "After login you land on the dashboard. The top strip answers the only question that matters first: “What requires my attention today?” — the projects needing intervention are listed with plain reasons." },
  { icon: MousePointerClick, title: "2 · Open a project", body: "Click any project card to enter its 9-tab detail page: Overview (executive summary in plain words), Milestones, Kanban board, Budget with forecast, Resources, Documents, Risk (explainable factors + what-if simulator), Alerts, Audit." },
  { icon: Sparkles, title: "3 · Ask Assure Intelligence", body: "Press / anywhere (or the blue button bottom-right) and ask in plain English: “Why is Bharatmala P-4 at risk?” — the answer cites real numbers from your portfolio, shows the tools it ran, and never invents figures." },
  { icon: ShieldCheck, title: "4 · Act and verify", body: "Risks convert into tracked interventions with an owner and deadline. When the fix is done, evidence (site photos, reports) verifies it before closure. That's the full loop: Detect → Predict → Explain → Recommend → Act → Verify." },
  { icon: MapPin, title: "5 · Watch the map and exports", body: "The Projects screen shows a live national map with health-coloured markers. Every screen exports — PDF for review meetings, Excel for analysis, CSV for data teams. Reports can be emailed directly." },
];

export default function HelpView() {
  const navigate = useApp(s => s.navigate);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  const filtered = useMemo(() => GLOSSARY.filter(g =>
    (cat === "all" || g.category === cat) &&
    (!q || g.term.toLowerCase().includes(q.toLowerCase()) || g.plain.toLowerCase().includes(q.toLowerCase()) || g.detail.toLowerCase().includes(q.toLowerCase()))
  ), [q, cat]);

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight">Help & Guide</h1>
        <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
          New here? Take the 2-minute tour below — every term is explained in plain language.
        </p>
      </div>

      {/* first-time tour */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight">The 2-minute tour</h2>
            <p className="text-xs text-muted-foreground">five steps — how a first-time visitor gets value on day one</p>
          </div>
          <Button size="sm" onClick={() => navigate("dashboard")}>Go to Command Centre <ChevronRight className="h-3.5 w-3.5" /></Button>
        </div>
        <div className="grid gap-2.5 md:grid-cols-2">
          {TOUR.map((t, i) => (
            <motion.div key={t.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="flex gap-3 rounded-lg border bg-muted/30 p-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0c93e7]/10 text-[#015ca0] dark:text-[#7cc8fb]"><t.icon className="h-4.5 w-4.5" /></div>
              <div>
                <div className="text-[12.5px] font-bold">{t.title}</div>
                <div className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{t.body}</div>
              </div>
            </motion.div>
          ))}
        </div>
        {/* the core loop */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0b426e]/5 to-[#0c93e7]/10 p-3 dark:from-[#0b426e]/30 dark:to-[#0c93e7]/10">
          {["DATA", "MONITOR", "DETECT", "PREDICT", "EXPLAIN", "RECOMMEND", "ACT", "VERIFY"].map((s, i, arr) => (
            <React.Fragment key={s}>
              <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#015ca0] shadow-sm dark:text-[#7cc8fb]">{s}</span>
              {i < arr.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </React.Fragment>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          That chain is the heart of the platform: data flows in, problems are found early, the future is estimated,
          reasons are explained in words, actions are recommended — and every action is tracked to verified closure.
        </p>
      </div>

      {/* glossary search */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 items-center gap-2 rounded-lg border bg-background px-3">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search a term — e.g. factor analysis, RBAC, outbox…"
              className="w-56 bg-transparent text-[12.5px] outline-none" />
          </div>
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setCat("all")} className={cn("rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
              cat === "all" ? "bg-foreground text-background" : "border text-muted-foreground hover:bg-muted")}>All ({GLOSSARY.length})</button>
            {Object.entries(CATEGORY_META).map(([k, m]) => (
              <button key={k} onClick={() => setCat(k)} className={cn("rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
                cat === k ? "bg-foreground text-background" : "border text-muted-foreground hover:bg-muted")}>
                {m.icon} {m.label} ({GLOSSARY.filter(g => g.category === k).length})
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-2.5 md:grid-cols-2">
          {filtered.map((g, i) => (
            <motion.div key={g.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.2) }}
              className="rounded-lg border bg-muted/20 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[12.5px] font-bold">{g.term}</div>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{CATEGORY_META[g.category].label}</span>
              </div>
              <div className="mt-1 text-[11.5px] font-medium text-[#015ca0] dark:text-[#7cc8fb]">{g.plain}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{g.detail}</div>
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground/70"><BookOpenCheck className="h-3 w-3" />seen in: {g.where}</div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-2 rounded-lg border border-dashed p-8 text-center text-[12px] text-muted-foreground">
              No term matches “{q}”. Try the category filters, or ask Assure Intelligence — it explains any concept in context.
            </div>
          )}
        </div>
      </div>

      {/* faq quick answers */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-[15px] font-bold tracking-tight">Frequently asked questions</h2>
        <div className="mt-2.5 space-y-2">
          {[
            ["Is the data real?", "The demo runs on a self-contained simulation world (30 projects frozen at 10 Sep 2026) so every number is reproducible. In production the same screens are powered by your organisation's own secure database."],
            ["Are the predictions trustworthy?", "Every prediction shows its probability, confidence range and the exact factors that pushed it up or down. The model's grades (Accuracy, MAE) are visible in Prediction Engine. And rule R10 means a human officer always verifies before escalation."],
            ["Do emails actually send?", "Yes, once an real email service is connected. Without a key, emails are honestly marked SIMULATED in the outbox — the app never pretends a demo send was delivered."],
            ["Where is my data stored?", "Registered accounts get a per-user workspace: projects you create are yours (hash-hashed passwords, RBAC isolation). The Email Centre / Alerts show only what your role may see."],
            ["What happens every 40 seconds?", "The live portfolio feed simulates field updates — progress drift, milestone completions, alerts — exactly the stream a WebSocket connection would push in production. You can toggle it in the top bar."],
          ].map(([qq, aa]) => (
            <details key={qq} className="group rounded-lg border bg-muted/20 p-3">
              <summary className="cursor-pointer list-none text-[12.5px] font-bold">{qq}<ChevronRight className="ml-1 inline h-3.5 w-3.5 transition group-open:rotate-90" /></summary>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">{aa}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
