"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Budget Variance — approved vs revised vs spent, per project, one table.
// "Remaining" answers the question every officer actually asks: how much is
// left in this project's kitty?
// ═══════════════════════════════════════════════════════════════════════════
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { StatCard, SectionTitle, InfoTip, PipelineStrip, EmptyState, ProgressBar } from "../shared/ui-bits";
import { deriveBudgetVariance, budgetUtilisation, csvRows } from "@/lib/projectassure/monitor";
import { inr } from "@/lib/projectassure/format";
import { downloadCsv, downloadExcel } from "@/lib/projectassure/reports";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { IndianRupee, TrendingUp, AlertTriangle, CheckCircle, FileDown, PieChart } from "lucide-react";
import { toast } from "sonner";
import type { BudgetVarianceRow } from "@/lib/projectassure/monitor";

const statusChip = (s: BudgetVarianceRow["status"]) =>
  s === "High" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
    : s === "Warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";

const varColor = (v: number) =>
  v > 10 ? "text-rose-600 dark:text-rose-400" : v > 3 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";

export default function BudgetVarianceView() {
  const projects = useApp(s => s.scoped)();
  const user = useApp(s => s.user)!;
  const recordExport = useApp(s => s.recordExport);
  const openProject = useApp(s => s.openProject);
  const navigate = useApp(s => s.navigate);

  const rows = useMemo(() => deriveBudgetVariance(projects), [projects]);
  const util = useMemo(() => budgetUtilisation(projects), [projects]);
  const alerts = rows.filter(r => r.status === "High").length;
  const worst = rows[0];

  const exportRows = (fmt: "csv" | "xlsx") => {
    const data = csvRows.budgetVariance(rows);
    const name = `projectassure-budget-variance-${new Date().toISOString().slice(0, 10)}`;
    if (fmt === "csv") downloadCsv(data, name + ".csv");
    else void downloadExcel({
      meta: { title: "Budget Variance", subtitle: `${rows.length} projects · approved vs revised vs spent`, scope: "Simple Monitoring · Budget Variance", generatedBy: user.name, generatedAt: new Date().toISOString(), classification: "RESTRICTED :: SIH26103" },
      sections: [{ title: "Budget variance", blocks: [{ type: "table", head: data[0].map(String), rows: data.slice(1).map(r => r.map(String)) }] }],
    }, name, [{ name: "Budget variance", rows: data }]);
    recordExport("Budget variance export", fmt, `${rows.length} projects`);
    toast.success(`Budget variance ${fmt.toUpperCase()} exported`, { description: `${rows.length} projects · approved / revised / spent / remaining · audit-logged` });
  };

  if (!rows.length) {
    return <div className="mx-auto max-w-[1200px] space-y-4">
      <h1 className="text-[20px] font-bold tracking-tight">Budget Variance</h1>
      <EmptyState icon={PieChart} title="No projects in your scope yet" body="Budget numbers appear automatically once projects are in your portfolio." />
    </div>;
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Budget Variance</h1>
          <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
            Money, in four columns: <strong className="text-foreground">approved</strong> (original sanction) → <strong className="text-foreground">revised</strong> (what the model now
            expects the project to finally cost) → <strong className="text-foreground">spent</strong> (actual bills paid so far) → <strong className="text-foreground">remaining</strong> (revised − spent).
            Positive variance = expected overrun.
          </p>
          <div className="mt-2"><PipelineStrip steps={[
            { label: "Approved", hint: "The sanctioned budget (₹ lakhs) at the time of project approval." },
            { label: "Revised (model-projected)", hint: "The live forecast of final cost from actual burn velocity — this is what 'cost to completion' looks like today." },
            { label: "Spent & remaining", hint: "Actual expenditure recorded in budget entries, and what is left of the projected cost." },
            { label: "Variance", hint: "(Revised − approved) ÷ approved. Above +10% is High, +3–10% Warning, else Normal." },
          ]} /></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportRows("csv")}><FileDown className="h-3.5 w-3.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportRows("xlsx")}><FileDown className="h-3.5 w-3.5" />Excel</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Approved budget" value={inr(util.approvedTotal)} tone="brand" icon={IndianRupee} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Original allocation</div>} delay={0} />
        <StatCard title="Revised (projected)" value={inr(util.revisedTotal)} tone="amber" icon={TrendingUp} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">After model projection</div>} delay={0.05} />
        <StatCard title="Actual spending" value={inr(util.spentTotal)} tone="green" icon={IndianRupee} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Bills paid to date</div>} delay={0.1} />
        <StatCard title="Budget alerts" value={alerts} tone="red" icon={AlertTriangle} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Overrun above 10% forecast</div>} delay={0.15} />
      </div>

      {/* utilisation */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <SectionTitle icon={PieChart} sub="Share of the approved money already spent across the whole portfolio" sub2="Moves live with every budget entry">Overall budget utilisation</SectionTitle>
        <div className="mt-4 flex items-center justify-between text-[12.5px]">
          <span>Approved {inr(util.approvedTotal)} · Spent {inr(util.spentTotal)}</span>
          <span className="font-bold tabular">{util.pct}% utilised</span>
        </div>
        <ProgressBar value={util.pct} className="mt-2 h-3" tone={util.pct > 95 ? "#ef4444" : util.pct > 80 ? "#f59e0b" : "#0c93e7"} />
        <div className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
          <InfoTip label="Why utilisation matters" body="High utilisation with low physical progress is the classic distress pattern — money leaves faster than work appears. Check the Progress Mismatch page to see exactly where that is happening." />
          {" "}Above 95% utilisation before work is nearly done is a distress signal; below 80% mid-project is comfortable.
        </div>
      </div>

      {/* callout for worst */}
      {worst && worst.variancePct > 10 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-500/30 dark:bg-rose-500/10">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-rose-100 p-3 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300"><AlertTriangle className="h-5 w-5" /></div>
            <div className="min-w-0">
              <h3 className="font-bold text-rose-800 dark:text-rose-200">Expected overrun above review threshold</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-rose-700 dark:text-rose-300">
                {worst.name} is trending to finish at {inr(worst.revised)} against an approval of {inr(worst.approved)} — a {worst.variancePct}% overrun, above the 10% authority-review band.
              </p>
              <Button variant="outline" size="sm" className="mt-2.5 border-rose-300 text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/15" onClick={() => openProject(worst.id)}>
                Open project budget
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* table */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b p-5">
          <SectionTitle icon={PieChart} sub="Every project — biggest expected overrun first" sub2="Click a row to open the project">Project budget analysis</SectionTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted/50">
              <tr>
                {["Project", "Approved", "Revised (projected)", "Spent", "Remaining", "Variance", "Status"].map(h => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(r => (
                <tr key={r.psId} className="cursor-pointer transition hover:bg-muted/40" onClick={() => openProject(r.id)}>
                  <td className="max-w-[260px] px-4 py-3"><p className="truncate text-[13px] font-semibold">{r.name}</p><p className="text-[10.5px] text-muted-foreground">{r.psId}</p></td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] tabular">{inr(r.approved)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] tabular"><span className="inline-flex items-center gap-1">
                    <InfoTip label="Revised = model projection" body="This is not a hand-entered revised estimate — it is the 18-signal ML model's forecast of final cost, recomputed every time actuals change." />{inr(r.revised)}</span></td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] tabular">{inr(r.spent)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] font-semibold tabular">{inr(r.remaining)}</td>
                  <td className={"px-4 py-3 text-[12.5px] font-bold tabular " + varColor(r.variancePct)}>{r.variancePct > 0 ? "+" : ""}{r.variancePct}%</td>
                  <td className="px-4 py-3"><span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold", statusChip(r.status))}>
                    {r.status === "Normal" ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground">
          All values in ₹ lakhs · &ldquo;Remaining&rdquo; is the unspent balance of the projected final cost.
          <Button variant="link" size="sm" className="ml-1 h-auto p-0 text-[11px]" onClick={() => navigate("progress-mismatch")}>Cross-check against physical progress →</Button>
        </div>
      </div>
    </div>
  );
}
