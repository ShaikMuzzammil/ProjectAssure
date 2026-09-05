"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Compare Projects — side-by-side baseline vs actual, variance, risk.
// "Project B requires priority review." — the honest conclusion.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { HealthBadge, SectionTitle, EmptyState, InfoTip, PipelineStrip } from "../shared/ui-bits";
import { inr } from "@/lib/projectassure/format";
import { buildReport, downloadPdf } from "@/lib/projectassure/reports";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GitCompareArrows, Trophy, AlertTriangle, TrendingDown, Plus, X, ArrowRight, FileDown } from "lucide-react";

const MAX_COMPARE = 4;

export default function CompareView() {
  const projects = useApp(s => s.scoped)();
  const user = useApp(s => s.user)!;
  const stats = useApp(s => s.stats)();
  const recordExport = useApp(s => s.recordExport);
  const openProject = useApp(s => s.openProject);
  const navigate = useApp(s => s.navigate);
  const [selected, setSelected] = useState<string[]>(() => {
    const worst = projects.slice().sort((a, b) => a.healthScore - b.healthScore).slice(0, 2).map(p => p.id);
    const best = projects.slice().sort((a, b) => b.healthScore - a.healthScore)[0];
    if (best && !worst.includes(best.id)) worst.push(best.id);
    return worst.slice(0, 3);
  });
  const [search, setSearch] = useState("");

  const chosen = useMemo(() => selected.map(id => projects.find(p => p.id === id)).filter(Boolean) as typeof projects, [selected, projects]);
  const candidates = useMemo(() => projects
    .filter(p => !selected.includes(p.id) && (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.psId.toLowerCase().includes(search.toLowerCase())))
    .slice(0, 8), [projects, selected, search]);

  const toggle = (id: string) => {
    if (selected.includes(id)) setSelected(s => s.filter(x => x !== id));
    else if (selected.length >= MAX_COMPARE) toast.error(`Compare up to ${MAX_COMPARE} projects`);
    else setSelected(s => [...s, id]);
  };

  const metric = (label: string, hint: string, render: (p: typeof projects[number]) => React.ReactNode, worse: (a: ReturnType<typeof val>, b: ReturnType<typeof val>) => boolean, val: (p: typeof projects[number]) => number) =>
    ({ label, hint, render, worse, val });
  const val = (fn: (p: typeof projects[number]) => number) => fn;

  const rows = [
    metric("Health score", "The 0–100 report card: schedule 30% + budget 25% + resources 20% + milestones 25%.", p => <HealthBadge status={p.healthStatus} score={p.healthScore} />, (a, b) => a < b, val(p => p.healthScore)),
    metric("Physical progress", "How much of the actual construction/work is finished (field-verified %).", p => <span className="tabular font-bold">{p.progress}%</span>, (a, b) => a < b, val(p => p.progress)),
    metric("Financial progress", "Share of approved money already spent.", p => {
      const f = p.totalBudget > 0 ? Math.round((p.spentBudget / p.totalBudget) * 100) : 0;
      const gap = f - p.progress;
      return <span className="tabular font-bold">{f}%{Math.abs(gap) > 10 && <span className={cn("ml-1.5 text-[10px] font-semibold", gap > 0 ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400")}>({gap > 0 ? "+" : ""}{gap}% vs work)</span>}</span>;
    }, (a, b) => a > b, val(p => p.totalBudget > 0 ? (p.spentBudget / p.totalBudget) * 100 : 0)),
    metric("Cost variance", "Projected final cost vs approved budget — positive means overrun.", p => {
      const v = p.totalBudget > 0 ? Math.round(((p.projectedBudget - p.totalBudget) / p.totalBudget) * 100) : 0;
      return <span className={cn("tabular font-bold", v > 10 ? "text-rose-600 dark:text-rose-400" : v > 3 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>{v > 0 ? "+" : ""}{v}%</span>;
    }, (a, b) => a > b, val(p => p.totalBudget > 0 ? ((p.projectedBudget - p.totalBudget) / p.totalBudget) * 100 : 0)),
    metric("Expected delay", "Model-estimated days past the contractual finish date (confidence range applies).", p => p.prediction
      ? <span className="tabular font-bold">{p.prediction.estimatedDays}d <span className="text-[10px] font-normal text-muted-foreground">({Math.round(p.prediction.probability * 100)}% prob)</span></span>
      : <span className="text-[11px] text-muted-foreground">no prediction</span>, (a, b) => a > b, val(p => p.prediction?.estimatedDays ?? 0)),
    metric("Sanctioned budget", "The sanctioned budget approved for this project.", p => <span className="tabular">{inr(p.totalBudget)}</span>, (a, b) => false, val(p => 0)),
    metric("Critical milestones delayed", "Milestones on the critical path that are past due — each one delays everything after it.", p => {
      const n = p.milestones.filter(m => m.isCritical && (m.status === "DELAYED" || m.status === "BLOCKED")).length;
      return <span className={cn("tabular font-bold", n > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{n}</span>;
    }, (a, b) => a > b, val(p => p.milestones.filter(m => m.isCritical && (m.status === "DELAYED" || m.status === "BLOCKED")).length)),
    metric("Evidence documents", "Processed reports/photos that verify progress claims.", p => <span className="tabular">{p.documents.filter(d => d.status === "PROCESSED").length}</span>, (a, b) => a < b, val(p => p.documents.filter(d => d.status === "PROCESSED").length)),
    metric("Unread alerts", "Active warnings that no officer has acknowledged yet.", p => {
      const n = p.alerts.filter(a => !a.isRead).length;
      return <span className={cn("tabular font-bold", n > 3 ? "text-rose-600 dark:text-rose-400" : "")}>{n}</span>;
    }, (a, b) => a > b, val(p => p.alerts.filter(a => !a.isRead).length)),
  ];

  const worstIdx = useMemo(() => {
    if (chosen.length < 2) return -1;
    // rank by: health score ascending, then delay descending
    let worst = 0;
    for (let i = 1; i < chosen.length; i++) {
      if (chosen[i].healthScore < chosen[worst].healthScore) worst = i;
    }
    return worst;
  }, [chosen]);

  const exportComparison = async () => {
    if (!chosen.length) return;
    const doc = buildReport("executive", chosen, stats, user);
    doc.meta.title = "Project Comparison Report";
    doc.meta.subtitle = `${chosen.length} projects compared side-by-side · verdict included`;
    doc.sections.push({
      title: "Side-by-side comparison",
      blocks: [
        { type: "table", head: ["Metric", ...chosen.map(p => p.name.replace(/,.*$/, ""))], rows: rows.map(r => [r.label, ...chosen.map(p => String(r.val(p)))]) },
        { type: "para", text: worstIdx >= 0 ? `Verdict: ${chosen[worstIdx].name} requires priority review — lowest health in this comparison. Exported from the Compare Projects screen.` : "Comparison exported from the Compare Projects screen." },
      ],
    });
    await downloadPdf(doc, `projectassure-comparison-${new Date().toISOString().slice(0, 10)}`);
    recordExport("Comparison report", "pdf", `${chosen.length} projects`);
    toast.success("Comparison PDF exported", { description: `${chosen.length} projects · side-by-side metrics + verdict · audit-logged` });
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Compare Projects</h1>
          <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
            Pick up to {MAX_COMPARE} projects and see them side-by-side — planned vs actual, risk vs risk.
            The comparison ends with an honest conclusion: <strong className="text-foreground">which project needs priority review</strong>.
          </p>
          <div className="mt-2"><PipelineStrip steps={[
            { label: "Select projects", hint: "Up to 4 from your scoped portfolio — worst performers are pre-selected for you." },
            { label: "Side-by-side metrics", hint: "Health, progress, cost variance, expected delay, critical milestones — with plain-language explanations on each row." },
            { label: "Verdict", hint: "The comparison names which project needs priority review and why." },
            { label: "Export", hint: "Send the comparison as a branded PDF for review meetings." },
          ]} /></div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void exportComparison()}><FileDown className="h-3.5 w-3.5" />Export PDF</Button>
      </div>

      {/* selector */}
      <div className="rounded-xl border bg-card p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {chosen.map(p => (
            <span key={p.id} className="flex items-center gap-1.5 rounded-full bg-[#e0effe] px-2.5 py-1 text-[11.5px] font-semibold text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]">
              {p.name.replace(/,.*$/, "").slice(0, 26)}
              <button onClick={() => toggle(p.id)} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
            </span>
          ))}
          <span className="ml-auto text-[10.5px] text-muted-foreground">{selected.length}/{MAX_COMPARE} selected</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search portfolio…"
            className="h-8 w-44 rounded-lg border bg-background px-2.5 text-[12px] outline-none focus:border-[#0c93e7]" />
          {candidates.map(p => (
            <button key={p.id} onClick={() => toggle(p.id)}
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition hover:border-[#0c93e7] hover:text-[#0c93e7]">
              <Plus className="h-3 w-3" />{p.name.replace(/,.*$/, "").slice(0, 24)}
            </button>
          ))}
        </div>
      </div>

      {chosen.length < 2 && <EmptyState icon={GitCompareArrows} title="Select at least two projects" body="The worst-performing and best-performing projects are pre-selected so you immediately see the contrast — add or swap with the picker above." />}

      {/* comparison table */}
      {chosen.length >= 2 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[640px] text-[12px]">
            <thead>
              <tr className="border-b">
                <th className="w-44 p-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Metric</th>
                {chosen.map((p, i) => (
                  <th key={p.id} className="p-3 text-left">
                    <button onClick={() => openProject(p.id)} className="group text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12.5px] font-bold group-hover:text-[#0c93e7] dark:group-hover:text-[#36adf6]">{p.psId}</span>
                        {i === worstIdx && <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />}
                      </div>
                      <div className="max-w-44 truncate text-[10.5px] font-normal text-muted-foreground">{p.name.replace(/,.*$/, "")}</div>
                      <div className="text-[9.5px] font-normal text-muted-foreground">{p.sector} · {p.district}</div>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => {
                const values = chosen.map(p => r.val(p));
                const worstVal = Math.max(...values), bestVal = Math.min(...values);
                return (
                  <tr key={r.label} className={cn("border-b last:border-0", ri % 2 === 1 && "bg-muted/25")}>
                    <td className="p-3">
                      <div className="flex items-center gap-1 font-semibold"><InfoTip label={r.label} body={r.hint} />{r.label}</div>
                    </td>
                    {chosen.map((p, i) => (
                      <td key={p.id} className={cn("p-3",
                        values[i] === worstVal && worstVal !== bestVal && r.label !== "Sanctioned budget" && "bg-rose-500/[0.06]")}>
                        {r.render(p)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      )}

      {/* verdict */}
      {chosen.length >= 2 && worstIdx >= 0 && (
        <div className="grid gap-2.5 md:grid-cols-2">
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-500/25 dark:bg-rose-500/5">
            <div className="flex items-center gap-2 text-[13px] font-bold text-rose-700 dark:text-rose-300"><AlertTriangle className="h-4 w-4" />Requires priority review</div>
            <button onClick={() => openProject(chosen[worstIdx].id)} className="mt-1 text-[12.5px] font-semibold text-rose-700 hover:underline dark:text-rose-300">
              {chosen[worstIdx].name.replace(/,.*$/, "")} ({chosen[worstIdx].psId}) <ArrowRight className="inline h-3 w-3" />
            </button>
            <p className="mt-1 text-[11.5px] leading-relaxed text-rose-700/80 dark:text-rose-300/80">
              Health {chosen[worstIdx].healthScore}/100 · {chosen[worstIdx].healthStatus.replace("_", " ")} band
              {chosen[worstIdx].prediction ? ` · ${Math.round(chosen[worstIdx].prediction.probability * 100)}% delay probability` : ""}.
              Open the project's Risk tab for the top recommended interventions.
            </p>
            <Button size="sm" variant="outline" className="mt-2 border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300"
              onClick={() => navigate("interventions")}>Track it as an intervention</Button>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/5">
            <div className="flex items-center gap-2 text-[13px] font-bold text-emerald-700 dark:text-emerald-300"><Trophy className="h-4 w-4" />Best performer in this set</div>
            <button onClick={() => openProject(chosen.reduce((b, p) => (p.healthScore > b.healthScore ? p : b), chosen[0]).id)}
              className="mt-1 text-[12.5px] font-semibold text-emerald-700 hover:underline dark:text-emerald-300">
              {chosen.reduce((b, p) => (p.healthScore > b.healthScore ? p : b), chosen[0]).name.replace(/,.*$/, "")}
            </button>
            <p className="mt-1 text-[11.5px] leading-relaxed text-emerald-700/80 dark:text-emerald-300/80">
              Health {chosen.reduce((b, p) => (p.healthScore > b.healthScore ? p : b), chosen[0]).healthScore}/100 — its practices
              (evidence discipline, milestone cadence) are the benchmark the weaker project should copy.
            </p>
          </div>
        </div>
      )}

      {/* explainer */}
      <div className="rounded-xl border bg-card p-5">
        <SectionTitle icon={TrendingDown} sub="how to read this screen in 20 seconds">The 5-question quick read</SectionTitle>
        <div className="grid gap-2 md:grid-cols-2">
          {[
            ["1. Health score", "Start here — the single report card. Red cells mark the worst value in each row."],
            ["2. Money vs work", "If financial progress is far ahead of physical progress, money is moving faster than work — the classic early warning."],
            ["3. Cost variance", "Positive % = projected overrun. Above +10% is the warning band, above +20% is critical."],
            ["4. Expected delay", "Days late with a probability — never a certainty. Check the confidence range in the project's Risk tab."],
            ["5. Evidence & alerts", "Many unread alerts + few evidence documents = claims without proof. That project needs verification first."],
            ["Then act", "Turn the worst project's top risks into tracked interventions — owners, deadlines, closure."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg border bg-muted/30 p-3">
              <div className="text-[12px] font-bold">{t}</div>
              <div className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
