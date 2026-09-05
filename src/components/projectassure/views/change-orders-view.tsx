"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Change Orders — every scope/cost/schedule change in one register: what
// changed, what it costs, how much schedule it eats, and whether it still
// awaits a decision. The "pending approvals" queue for authorities.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { StatCard, SectionTitle, InfoTip, PipelineStrip, EmptyState } from "../shared/ui-bits";
import { deriveChangeOrders, changeOrderSummary, csvRows } from "@/lib/projectassure/monitor";
import { inr, shortDate } from "@/lib/projectassure/format";
import { downloadCsv, downloadExcel } from "@/lib/projectassure/reports";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FileEdit, Clock, IndianRupee, ShieldAlert, FileDown, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import type { ChangeOrderRow } from "@/lib/projectassure/monitor";

const statusChip = (s: ChangeOrderRow["status"]) =>
  s === "Approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
    : s === "Rejected" ? "bg-slate-200 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300"
      : s === "Pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        : "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300";

const riskChip = (r: ChangeOrderRow["risk"]) =>
  r === "High" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
    : r === "Medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";

export default function ChangeOrdersView() {
  const projects = useApp(s => s.scoped)();
  const user = useApp(s => s.user)!;
  const recordExport = useApp(s => s.recordExport);
  const openProject = useApp(s => s.openProject);
  const navigate = useApp(s => s.navigate);

  const rows = useMemo(() => deriveChangeOrders(projects), [projects]);
  const summary = useMemo(() => changeOrderSummary(rows), [rows]);
  const [status, setStatus] = useState<"ALL" | ChangeOrderRow["status"]>("ALL");
  const list = status === "ALL" ? rows : rows.filter(r => r.status === status);

  const exportRows = (fmt: "csv" | "xlsx") => {
    const data = csvRows.changeOrders(list);
    const name = `projectassure-change-orders-${new Date().toISOString().slice(0, 10)}`;
    if (fmt === "csv") downloadCsv(data, name + ".csv");
    else void downloadExcel({
      meta: { title: "Change Orders", subtitle: `${list.length} change orders · cost and schedule impact`, scope: "Simple Monitoring · Change Orders", generatedBy: user.name, generatedAt: new Date().toISOString(), classification: "RESTRICTED :: SIH26103" },
      sections: [{ title: "Change orders", blocks: [{ type: "table", head: data[0].map(String), rows: data.slice(1).map(r => r.map(String)) }] }],
    }, name, [{ name: "Change orders", rows: data }]);
    recordExport("Change orders export", fmt, `${list.length} change orders`);
    toast.success(`Change orders ${fmt.toUpperCase()} exported`, { description: `${list.length} orders · cost, schedule impact and status · audit-logged` });
  };

  if (!rows.length) {
    return <div className="mx-auto max-w-[1200px] space-y-4">
      <h1 className="text-[20px] font-bold tracking-tight">Change Orders</h1>
      <EmptyState icon={FileEdit} title="No change orders in your scope" body="Change orders appear when a project's projected cost moves beyond its approval — the register grows as budgets diverge." />
    </div>;
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Change Orders</h1>
          <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
            When a project changes course — extra scope, design revisions, rate escalation — it lands here:
            <strong className="text-foreground"> what changed, what it costs, how many days it adds</strong>, and whether the decision is still pending.
            Pending orders on stressed projects are exactly where overruns are born.
          </p>
          <div className="mt-2"><PipelineStrip steps={[
            { label: "Change detected", hint: "A project whose projected cost diverges from its approval generates change-order entries — the register follows the money." },
            { label: "Impact quantified", hint: "Each order carries its cost impact (₹ and % of budget) and its schedule impact in days." },
            { label: "Decision queue", hint: "Pending and Under-Review orders are decisions waiting for an authority — the queue the Authority Review page summarises." },
            { label: "Traceability", hint: "Every row links back to its project, where the full budget records and audit trail live." },
          ]} /></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportRows("csv")}><FileDown className="h-3.5 w-3.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportRows("xlsx")}><FileDown className="h-3.5 w-3.5" />Excel</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Change orders" value={summary.total} tone="brand" icon={FileEdit} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Across your scoped projects</div>} delay={0} />
        <StatCard title="Awaiting decision" value={summary.pending} tone="amber" icon={Clock} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Pending + under review</div>} delay={0.05} />
        <StatCard title="Approved cost impact" value={inr(summary.approvedCost)} tone="red" icon={IndianRupee} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Already committed to budget</div>} delay={0.1} />
        <StatCard title="High-risk orders" value={summary.highRisk} tone="violet" icon={ShieldAlert} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Big cost or schedule bite</div>} delay={0.15} />
      </div>

      {/* decision queue banner */}
      {summary.pending > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-100 p-2.5 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300"><CalendarClock className="h-5 w-5" /></div>
            <div>
              <h3 className="text-[13px] font-bold text-amber-800 dark:text-amber-200">{summary.pending} change order{summary.pending > 1 ? "s" : ""} awaiting a decision</h3>
              <p className="text-[12px] text-amber-700 dark:text-amber-300">Pipeline value {inr(summary.pipelineCost)} in cost impact — these become committed the moment they are approved.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:text-amber-200" onClick={() => navigate("authority-review")}>
            Review in Authority view
          </Button>
        </motion.div>
      )}

      {/* filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(["ALL", "Pending", "Under Review", "Approved", "Rejected"] as const).map(b => (
          <button key={b} onClick={() => setStatus(b)}
            className={cn("rounded-full px-3 py-1.5 text-[11.5px] font-bold transition",
              status === b ? "bg-[#0c93e7] text-white shadow-sm" : "border bg-card text-muted-foreground hover:bg-muted/50")}>
            {b === "ALL" ? `All ${rows.length}` : `${b} · ${rows.filter(r => r.status === b).length}`}
          </button>
        ))}
      </div>

      {/* orders list */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b p-5">
          <SectionTitle icon={FileEdit} sub="Newest first · click to open the project" sub2="Cost impact in ₹ lakhs">Change order register</SectionTitle>
        </div>
        <div className="divide-y">
          {list.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.2) }}
              className="cursor-pointer p-4 transition hover:bg-muted/40" onClick={() => openProject(r.projectId)}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold tabular text-[#015ca0] dark:text-[#7cc8fb]">{r.id}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[9.5px] font-bold text-muted-foreground">{shortDate(r.raisedAt)}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", statusChip(r.status))}>{r.status}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", riskChip(r.risk))}>{r.risk} risk</span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] font-semibold leading-snug">{r.description}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{r.projectName} · {r.psId}</p>
                </div>
                <div className="flex shrink-0 gap-4 text-right">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cost impact</div>
                    <div className="text-[14px] font-bold tabular text-rose-600 dark:text-rose-400">+{inr(r.costImpact)}</div>
                    <div className="text-[10px] text-muted-foreground">{r.costImpactPct}% of budget</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Schedule</div>
                    <div className="text-[14px] font-bold tabular text-amber-600 dark:text-amber-400">+{r.scheduleImpactDays}d</div>
                    <div className="text-[10px] text-muted-foreground">added to finish</div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="border-t bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground">
          <InfoTip label="How this register builds" body="Change orders concentrate on projects whose model-projected cost has actually diverged from approval — the register follows real budget movement, not manual entry." />
          {" "}Approvals become part of the project&apos;s budget trajectory immediately.
        </div>
      </div>
    </div>
  );
}
