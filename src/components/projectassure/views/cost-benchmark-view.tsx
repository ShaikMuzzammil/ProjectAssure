"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Cost Benchmark — three numbers per project: what was sanctioned, what the
// AI says it should cost, and where it is actually heading. One table, one
// honest callout. Teammates learn it in 30 seconds.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { StatCard, SectionTitle, InfoTip, PipelineStrip, EmptyState } from "../shared/ui-bits";
import { deriveCostBenchmarks, csvRows } from "@/lib/projectassure/monitor";
import { inr } from "@/lib/projectassure/format";
import { downloadCsv, downloadExcel } from "@/lib/projectassure/reports";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { IndianRupee, TrendingUp, AlertTriangle, CheckCircle, FileDown, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { CostBenchmarkRow } from "@/lib/projectassure/monitor";

const statusChip = (s: CostBenchmarkRow["status"]) =>
  s === "High"
    ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
    : s === "Watch"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";

const varColor = (v: number) =>
  v > 10 ? "text-rose-600 dark:text-rose-400" : v > 4 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";

export default function CostBenchmarkView() {
  const projects = useApp(s => s.scoped)();
  const user = useApp(s => s.user)!;
  const recordExport = useApp(s => s.recordExport);
  const openProject = useApp(s => s.openProject);
  const navigate = useApp(s => s.navigate);

  const rows = useMemo(() => deriveCostBenchmarks(projects), [projects]);
  const totals = useMemo(() => ({
    approved: rows.reduce((s, r) => s + r.approved, 0),
    benchmark: rows.reduce((s, r) => s + r.aiBenchmark, 0),
    trajectory: rows.reduce((s, r) => s + r.trajectory, 0),
    alerts: rows.filter(r => r.status === "High").length,
  }), [rows]);
  const worst = rows[0];

  const exportRows = (fmt: "csv" | "xlsx") => {
    const data = csvRows.costBenchmark(rows);
    const name = `projectassure-cost-benchmark-${new Date().toISOString().slice(0, 10)}`;
    if (fmt === "csv") downloadCsv(data, name + ".csv");
    else void downloadExcel({
      meta: { title: "Cost Benchmark", subtitle: `${rows.length} projects · approved vs intelligence benchmark vs live trajectory`, scope: "Simple Monitoring · Cost Benchmark", generatedBy: user.name, generatedAt: new Date().toISOString(), classification: "RESTRICTED :: SIH26103" },
      sections: [{ title: "Cost benchmark", blocks: [{ type: "table", head: data[0].map(String), rows: data.slice(1).map(r => r.map(String)) }] }],
    }, name, [{ name: "Cost benchmark", rows: data }]);
    recordExport("Cost benchmark export", fmt, `${rows.length} projects`);
    toast.success(`Cost benchmark ${fmt.toUpperCase()} exported`, { description: `${rows.length} projects · approved vs intelligence benchmark vs trajectory · audit-logged` });
  };

  if (!rows.length) {
    return <div className="mx-auto max-w-[1200px] space-y-4">
      <h1 className="text-[20px] font-bold tracking-tight">Cost Benchmark</h1>
      <EmptyState icon={IndianRupee} title="No projects in your scope yet" body="Cost benchmarks appear automatically once projects are in your portfolio." />
    </div>;
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Cost Benchmark</h1>
          <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
            For every project: <strong className="text-foreground">what was sanctioned</strong> vs <strong className="text-foreground">what the intelligence engine says it should cost</strong> (a fair-cost
            estimate from sector, size and team characteristics) vs <strong className="text-foreground">where the money is actually heading</strong> (the live model forecast).
            A big gap between the last two is an early cost signal — before it becomes an overrun.
          </p>
          <div className="mt-2"><PipelineStrip steps={[
            { label: "Fair-cost benchmark", hint: "The model estimates what a comparable well-run project of this type should cost (sector factor + size diseconomy + team adequacy)." },
            { label: "Live trajectory", hint: "The budget-forecast model projects the final cost from actual burn velocity and milestones — this moves as real data changes." },
            { label: "Variance", hint: "Trajectory vs benchmark. Above +10% is flagged High; +4–10% is Watch; below is normal." },
            { label: "Investigate", hint: "Open the project to see the burn forecast chart, budget records and the recommended action plan." },
          ]} /></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportRows("csv")}><FileDown className="h-3.5 w-3.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportRows("xlsx")}><FileDown className="h-3.5 w-3.5" />Excel</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Approved budget" value={inr(totals.approved)} tone="brand" icon={IndianRupee} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Total sanctioned across scope</div>} delay={0} />
        <StatCard title="Intelligence benchmark" value={inr(totals.benchmark)} tone="green" icon={TrendingUp} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">What fair delivery should cost</div>} delay={0.05} />
        <StatCard title="Projected trajectory" value={inr(totals.trajectory)} tone="amber" icon={IndianRupee} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Where current burn is heading</div>} delay={0.1} />
        <StatCard title="Cost alerts" value={totals.alerts} tone="red" icon={AlertTriangle} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Projects above benchmark</div>} delay={0.15} />
      </div>

      {/* anomaly callout */}
      {worst && worst.variancePct > 10 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-500/30 dark:bg-rose-500/10">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-rose-100 p-3 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300"><AlertTriangle className="h-5 w-5" /></div>
            <div className="min-w-0">
              <h3 className="font-bold text-rose-800 dark:text-rose-200">Cost anomaly detected</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-rose-700 dark:text-rose-300">{worst.reason}</p>
              <p className="mt-1.5 text-[11.5px] text-rose-700/80 dark:text-rose-300/80">{worst.name} · trajectory {inr(worst.trajectory)} vs benchmark {inr(worst.aiBenchmark)} ({worst.variancePct > 0 ? "+" : ""}{worst.variancePct}%)</p>
              <Button variant="outline" size="sm" className="mt-2.5 border-rose-300 text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/15" onClick={() => openProject(worst.id)}>
                Open project budget <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* table */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b p-5">
          <SectionTitle icon={IndianRupee} sub="Comparison per project — worst variance first" sub2="Click a row to open the project">Project-wise cost comparison</SectionTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted/50">
              <tr>
                {["Project", "Approved", "Intelligence benchmark", "Projected", "Variance", "Status"].map(h => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(r => (
                <tr key={r.psId} className="cursor-pointer transition hover:bg-muted/40" onClick={() => openProject(r.id)}>
                  <td className="max-w-[280px] px-4 py-3">
                    <p className="truncate text-[13px] font-semibold">{r.name}</p>
                    <p className="text-[10.5px] text-muted-foreground">{r.psId} · {r.sector}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] tabular">{inr(r.approved)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] tabular">
                    <span className="inline-flex items-center gap-1"><InfoTip label="Intelligence benchmark" body={r.reason} />{inr(r.aiBenchmark)}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] font-semibold tabular">{inr(r.trajectory)}</td>
                  <td className={"px-4 py-3 text-[12.5px] font-bold tabular " + varColor(r.variancePct)}>{r.variancePct > 0 ? "+" : ""}{r.variancePct}%</td>
                  <td className="px-4 py-3"><span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold", statusChip(r.status))}>
                    {r.status === "Normal" ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground">
          All values in ₹ lakhs. &ldquo;Projected&rdquo; is the live model forecast — it moves whenever actual expenditure or burn velocity changes.
          <Button variant="link" size="sm" className="ml-1 h-auto p-0 text-[11px]" onClick={() => navigate("budget-variance")}>See the budget variance view →</Button>
        </div>
      </div>
    </div>
  );
}
