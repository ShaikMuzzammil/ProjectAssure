"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Progress Mismatch — "money spent" vs "work actually done", side by side.
// The single most understandable fraud/lag signal in public projects:
// payments running ahead of physical output.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { StatCard, SectionTitle, InfoTip, PipelineStrip, EmptyState, ProgressBar } from "../shared/ui-bits";
import { deriveProgressMismatches, csvRows } from "@/lib/projectassure/monitor";
import { inr } from "@/lib/projectassure/format";
import { downloadCsv, downloadExcel } from "@/lib/projectassure/reports";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TrendingDown, TrendingUp, Scale, CheckCircle, AlertTriangle, FileDown } from "lucide-react";
import { toast } from "sonner";
import type { ProgressMismatchRow } from "@/lib/projectassure/monitor";

const statusChip = (s: ProgressMismatchRow["status"]) =>
  s === "Mismatch" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
    : s === "Watch" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";

export default function ProgressMismatchView() {
  const projects = useApp(s => s.scoped)();
  const user = useApp(s => s.user)!;
  const recordExport = useApp(s => s.recordExport);
  const openProject = useApp(s => s.openProject);
  const navigate = useApp(s => s.navigate);

  const rows = useMemo(() => deriveProgressMismatches(projects), [projects]);
  const mismatches = rows.filter(r => r.status === "Mismatch");
  const ahead = rows.filter(r => r.gap > 10);
  const behind = rows.filter(r => r.gap < -10);
  const matched = rows.filter(r => r.status === "Matched").length;

  const exportRows = (fmt: "csv" | "xlsx") => {
    const data = csvRows.progressMismatch(rows);
    const name = `projectassure-progress-mismatch-${new Date().toISOString().slice(0, 10)}`;
    if (fmt === "csv") downloadCsv(data, name + ".csv");
    else void downloadExcel({
      meta: { title: "Progress Mismatch", subtitle: `${rows.length} projects · physical vs financial progress`, scope: "Simple Monitoring · Progress Mismatch", generatedBy: user.name, generatedAt: new Date().toISOString(), classification: "RESTRICTED :: SIH26103" },
      sections: [{ title: "Progress mismatch", blocks: [{ type: "table", head: data[0].map(String), rows: data.slice(1).map(r => r.map(String)) }] }],
    }, name, [{ name: "Progress mismatch", rows: data }]);
    recordExport("Progress mismatch export", fmt, `${rows.length} projects`);
    toast.success(`Progress mismatch ${fmt.toUpperCase()} exported`, { description: `${rows.length} projects · physical vs financial with interpretations · audit-logged` });
  };

  if (!rows.length) {
    return <div className="mx-auto max-w-[1200px] space-y-4">
      <h1 className="text-[20px] font-bold tracking-tight">Progress Mismatch</h1>
      <EmptyState icon={Scale} title="No projects in your scope yet" body="Mismatch analysis appears automatically once projects are in your portfolio." />
    </div>;
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Progress Mismatch</h1>
          <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
            Two bars per project: <strong className="text-foreground">physical progress</strong> (the % of work actually built, field-verified) and
            <strong className="text-foreground"> financial progress</strong> (the % of approved money already paid out). When money runs
            ahead of work, that is the classic early warning of inflated running bills or idle sites.
          </p>
          <div className="mt-2"><PipelineStrip steps={[
            { label: "Two percentages", hint: "Physical % comes from verified milestone/task completion; financial % is spent ÷ approved." },
            { label: "The gap", hint: "Financial − physical, in points. +10 or more means money is clearly outpacing work." },
            { label: "Interpretation", hint: "Each row says in plain words what the gap usually means — advance payments, inflated bills, or genuine efficiency." },
            { label: "Verify", hint: "Open the project to check milestone evidence, document vault and field reports before acting." },
          ]} /></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportRows("csv")}><FileDown className="h-3.5 w-3.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportRows("xlsx")}><FileDown className="h-3.5 w-3.5" />Excel</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Projects compared" value={rows.length} tone="brand" icon={Scale} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Physical vs financial, all scoped</div>} delay={0} />
        <StatCard title="Payments ahead of work" value={ahead.length} tone="red" icon={TrendingUp} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Gap above +10 points</div>} delay={0.05} />
        <StatCard title="Work ahead of payments" value={behind.length} tone="amber" icon={TrendingDown} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Gap below −10 points</div>} delay={0.1} />
        <StatCard title="In step" value={matched} tone="green" icon={CheckCircle} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Within ±5 points</div>} delay={0.15} />
      </div>

      {/* visual bars */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b p-5">
          <SectionTitle icon={Scale} sub="Worst gap first — blue = work done, amber = money spent" sub2="Click a card to open the project">Side-by-side view</SectionTitle>
        </div>
        <div className="divide-y">
          {rows.slice(0, 8).map(r => (
            <div key={r.psId} className="cursor-pointer p-4 transition hover:bg-muted/40" onClick={() => openProject(r.id)}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[13px] font-semibold">{r.name}</p>
                <span className={cn("rounded-full px-2.5 py-1 text-[10.5px] font-bold", statusChip(r.status))}>
                  gap {r.gap > 0 ? "+" : ""}{r.gap} pts · {r.status}
                </span>
              </div>
              <div className="mt-2.5 grid gap-2">
                <div>
                  <div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>Physical — work done</span><span className="tabular font-semibold text-foreground">{r.physical}%</span></div>
                  <ProgressBar value={r.physical} tone="#0c93e7" />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>Financial — money spent</span><span className="tabular font-semibold text-foreground">{r.financial}%</span></div>
                  <ProgressBar value={r.financial} tone={r.gap > 10 ? "#ef4444" : "#f59e0b"} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* full table */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b p-5">
          <SectionTitle icon={Scale} sub="Every project with a plain-language interpretation" sub2="Sorted by the size of the gap">Full mismatch table</SectionTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted/50">
              <tr>
                {["Project", "Physical", "Financial", "Gap", "Status", "What it means"].map(h => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(r => (
                <tr key={r.psId} className="cursor-pointer transition hover:bg-muted/40" onClick={() => openProject(r.id)}>
                  <td className="max-w-[240px] px-4 py-3"><p className="truncate text-[13px] font-semibold">{r.name}</p><p className="text-[10.5px] text-muted-foreground">{r.psId}</p></td>
                  <td className="px-4 py-3 text-[12.5px] tabular font-semibold">{r.physical}%</td>
                  <td className="px-4 py-3 text-[12.5px] tabular font-semibold">{r.financial}%</td>
                  <td className={cn("px-4 py-3 text-[12.5px] font-bold tabular", r.gap > 10 ? "text-rose-600 dark:text-rose-400" : r.gap < -10 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                    {r.gap > 0 ? "+" : ""}{r.gap}
                  </td>
                  <td className="px-4 py-3"><span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold", statusChip(r.status))}>
                    {r.status === "Matched" ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}{r.status}</span></td>
                  <td className="max-w-[360px] px-4 py-3"><span className="inline-flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                    <InfoTip label="Why this matters" body={r.interpretation} /><span className="line-clamp-2">{r.interpretation}</span></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 p-3">
          <span className="text-[11px] text-muted-foreground">
            {mismatches.length} project{mismatches.length === 1 ? "" : "s"} currently outside the ±10-point band
            {mismatches.length > 0 && <> — spend total {inr(mismatches.reduce((s, r) => s + (projects.find(p => p.psId === r.psId)?.spentBudget ?? 0), 0))}</>}
          </span>
          <Button variant="outline" size="sm" onClick={() => navigate("authority-review")}>
            {mismatches.length > 0 ? "See authority-level actions" : "See the authority review"} <TrendingUp className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
