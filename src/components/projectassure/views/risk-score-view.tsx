"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Risk Scores — every project as one number (0–100 risk), its band, the ML
// delay probability, and the top three reasons in plain words. The "who is
// in trouble and why" page.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { StatCard, InfoTip, PipelineStrip, EmptyState, HealthBadge } from "../shared/ui-bits";
import { deriveRiskScores, csvRows } from "@/lib/projectassure/monitor";
import { downloadCsv, downloadExcel } from "@/lib/projectassure/reports";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Brain, ArrowRight, FileDown, Gauge } from "lucide-react";
import { toast } from "sonner";
import type { RiskScoreRow } from "@/lib/projectassure/monitor";

const bandChip = (b: RiskScoreRow["band"]) =>
  b === "High" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
    : b === "Medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";

const riskColor = (v: number) => (v >= 40 ? "#ef4444" : v >= 25 ? "#f59e0b" : "#22c55e");

export default function RiskScoreView() {
  const projects = useApp(s => s.scoped)();
  const user = useApp(s => s.user)!;
  const recordExport = useApp(s => s.recordExport);
  const openProject = useApp(s => s.openProject);
  const navigate = useApp(s => s.navigate);
  const setAiOpen = useApp(s => s.setAiOpen);
  const [band, setBand] = useState<"ALL" | RiskScoreRow["band"]>("ALL");

  const rows = useMemo(() => deriveRiskScores(projects), [projects]);
  const counts = useMemo(() => ({
    high: rows.filter(r => r.band === "High").length,
    medium: rows.filter(r => r.band === "Medium").length,
    low: rows.filter(r => r.band === "Low").length,
  }), [rows]);
  const list = band === "ALL" ? rows : rows.filter(r => r.band === band);

  const exportRows = (fmt: "csv" | "xlsx") => {
    const data = csvRows.riskScores(list);
    const name = `projectassure-risk-scores-${new Date().toISOString().slice(0, 10)}`;
    if (fmt === "csv") downloadCsv(data, name + ".csv");
    else void downloadExcel({
      meta: { title: "Risk Scores", subtitle: `${list.length} projects · risk 0-100 with top ML factors`, scope: "Simple Monitoring · Risk Scores", generatedBy: user.name, generatedAt: new Date().toISOString(), classification: "RESTRICTED :: SIH26103" },
      sections: [{ title: "Risk scores", blocks: [{ type: "table", head: data[0].map(String), rows: data.slice(1).map(r => r.map(String)) }] }],
    }, name, [{ name: "Risk scores", rows: data }]);
    recordExport("Risk score export", fmt, `${list.length} projects`);
    toast.success(`Risk scores ${fmt.toUpperCase()} exported`, { description: `${list.length} projects · scores, bands and top factors · audit-logged` });
  };

  if (!rows.length) {
    return <div className="mx-auto max-w-[1200px] space-y-4">
      <h1 className="text-[20px] font-bold tracking-tight">Risk Scores</h1>
      <EmptyState icon={ShieldAlert} title="No projects in your scope yet" body="Risk scores appear automatically once projects are in your portfolio." />
    </div>;
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Risk Scores</h1>
          <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
            Every project boiled down to <strong className="text-foreground">one risk number from 0 to 100</strong> (it is simply 100 minus the health score), the ML model&apos;s
            <strong className="text-foreground"> delay probability</strong>, and the <strong className="text-foreground">top three reasons</strong> in plain words. High = needs action now, Medium = watch, Low = fine.
          </p>
          <div className="mt-2"><PipelineStrip steps={[
            { label: "Health score", hint: "Schedule 30% + budget 25% + resources 20% + milestones 25% — recomputed on every data change." },
            { label: "Risk = 100 − health", hint: "Flipped so bigger means worse. 40+ is High, 25–40 is Medium, below is Low." },
            { label: "ML delay probability", hint: "The 18-signal gradient-boosted model's probability of missing the finish date, with expected delay days." },
            { label: "Top factors", hint: "The strongest signals behind the score, in plain language — click through to see all 18 features." },
          ]} /></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportRows("csv")}><FileDown className="h-3.5 w-3.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportRows("xlsx")}><FileDown className="h-3.5 w-3.5" />Excel</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="High risk" value={counts.high} tone="red" icon={ShieldAlert} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Risk score 40+ — act today</div>} delay={0} />
        <StatCard title="Medium risk" value={counts.medium} tone="amber" icon={Gauge} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Risk 25–40 — keep watching</div>} delay={0.05} />
        <StatCard title="Low risk" value={counts.low} tone="green" icon={Gauge} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Below 25 — comfortable</div>} delay={0.1} />
        <StatCard title="Average risk" value={Math.round(rows.reduce((s, r) => s + r.riskScore, 0) / rows.length)} unit="/100" tone="slate" icon={Brain} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Across your whole scope</div>} delay={0.15} />
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(["ALL", "High", "Medium", "Low"] as const).map(b => (
          <button key={b} onClick={() => setBand(b)}
            className={cn("rounded-full px-3 py-1.5 text-[11.5px] font-bold transition",
              band === b ? "bg-[#0c93e7] text-white shadow-sm" : "border bg-card text-muted-foreground hover:bg-muted/50")}>
            {b === "ALL" ? `All ${rows.length}` : `${b} ${b === "High" ? counts.high : b === "Medium" ? counts.medium : counts.low}`}
          </button>
        ))}
      </div>

      {/* scoreboard cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((r, i) => {
          const p = projects.find(pp => pp.psId === r.psId);
          return (
            <motion.div key={r.psId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className="cursor-pointer rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md hover:shadow-black/5" onClick={() => openProject(r.id)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold leading-tight">{r.name}</p>
                  <p className="mt-0.5 text-[10.5px] text-muted-foreground">{r.psId}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold", bandChip(r.band))}>{r.band} risk</span>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
                  <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="7" className="text-muted/30" />
                    <motion.circle cx="32" cy="32" r="26" fill="none" stroke={riskColor(r.riskScore)} strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 26} initial={{ strokeDashoffset: 2 * Math.PI * 26 }} animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - r.riskScore / 100) }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
                  </svg>
                  <div className="absolute text-[17px] font-bold tabular">{r.riskScore}</div>
                </div>
                <div className="min-w-0 flex-1">
                  {r.delayProbability > 0 ? (
                    <>
                      <div className="flex items-baseline justify-between text-[11.5px]">
                        <span className="text-muted-foreground">Delay probability</span>
                        <span className="font-bold tabular">{r.delayProbability}%</span>
                      </div>
                      <div className="mt-0.5 flex items-baseline justify-between text-[11.5px]">
                        <span className="text-muted-foreground">Expected slip</span>
                        <span className="font-bold tabular">{r.expectedDelayDays} days</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] text-muted-foreground">
                      No delay prediction yet — <button className="font-semibold text-[#015ca0] underline dark:text-[#7cc8fb]" onClick={e => { e.stopPropagation(); if (p) { useApp.getState().runPrediction(p.id); } }}>run the model</button>
                    </div>
                  )}
                  {p && <div className="mt-1.5"><HealthBadge status={p.healthStatus} score={p.healthScore} /></div>}
                </div>
              </div>

              {r.topFactors.length > 0 && (
                <div className="mt-3 rounded-lg bg-muted/40 p-2.5">
                  <div className="mb-1 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">Top risk drivers</div>
                  <ul className="space-y-0.5">
                    {r.topFactors.map(f => (
                      <li key={f.label} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate">{f.label}</span>
                        <span className="shrink-0 font-bold tabular text-rose-600 dark:text-rose-400">+{f.value.toFixed(1)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <span className="max-w-xl text-[11.5px] leading-relaxed text-muted-foreground">
          <InfoTip label="Where do these numbers come from?" body="The health score is deterministic (30/25/20/25 weights). The delay probability comes from the 18-signal ML model in the Prediction Engine — you can inspect every feature there, and re-run predictions per project." />
          {" "}Risk numbers move the moment any project data changes — there is no stale cache.
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("model-lab")}>Open Prediction Engine</Button>
          <Button variant="outline" size="sm" onClick={() => { setAiOpen(true); useApp.getState().askAi(`Explain in plain language why ${list[0]?.name ?? "the worst project"} is risky and what to do first.`); }}>
            Ask Intelligence about the top risk <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
