"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Procurement Anomaly — contract-level price checks. Every contract is
// compared with its intelligence fair-price benchmark; expensive ones are flagged with
// behavioural warnings (concentration, repeat vendors, stressed projects).
// ═══════════════════════════════════════════════════════════════════════════
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { StatCard, SectionTitle, InfoTip, PipelineStrip, EmptyState } from "../shared/ui-bits";
import { deriveContracts, procurementSummary, csvRows } from "@/lib/projectassure/monitor";
import { inr } from "@/lib/projectassure/format";
import { downloadCsv, downloadExcel } from "@/lib/projectassure/reports";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FileWarning, ShieldAlert, TrendingUp, Users, ShoppingCart, FileDown, Flag } from "lucide-react";
import { toast } from "sonner";
import type { ContractRow } from "@/lib/projectassure/monitor";

const riskChip = (r: ContractRow["risk"]) =>
  r === "High" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
    : r === "Medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";

const varColor = (v: number) =>
  v > 12 ? "text-rose-600 dark:text-rose-400" : v > 5 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";

export default function ProcurementView() {
  const projects = useApp(s => s.scoped)();
  const user = useApp(s => s.user)!;
  const recordExport = useApp(s => s.recordExport);
  const openProject = useApp(s => s.openProject);

  const contracts = useMemo(() => deriveContracts(projects), [projects]);
  const summary = useMemo(() => procurementSummary(contracts), [contracts]);
  const [risk, setRisk] = useState<"ALL" | ContractRow["risk"]>("ALL");
  const list = risk === "ALL" ? contracts : contracts.filter(c => c.risk === risk);
  const worst = contracts.slice().sort((a, b) => b.variancePct - a.variancePct)[0];

  const exportRows = (fmt: "csv" | "xlsx") => {
    const data = csvRows.contracts(list);
    const name = `projectassure-procurement-anomalies-${new Date().toISOString().slice(0, 10)}`;
    if (fmt === "csv") downloadCsv(data, name + ".csv");
    else void downloadExcel({
      meta: { title: "Procurement Anomalies", subtitle: `${list.length} contracts · value vs intelligence benchmark with flags`, scope: "Simple Monitoring · Procurement", generatedBy: user.name, generatedAt: new Date().toISOString(), classification: "RESTRICTED :: SIH26103" },
      sections: [{ title: "Procurement anomalies", blocks: [{ type: "table", head: data[0].map(String), rows: data.slice(1).map(r => r.map(String)) }] }],
    }, name, [{ name: "Procurement", rows: data }]);
    recordExport("Procurement export", fmt, `${list.length} contracts`);
    toast.success(`Procurement ${fmt.toUpperCase()} exported`, { description: `${list.length} contracts · values, benchmarks and flags · audit-logged` });
  };

  if (!contracts.length) {
    return <div className="mx-auto max-w-[1200px] space-y-4">
      <h1 className="text-[20px] font-bold tracking-tight">Procurement Anomaly Detection</h1>
      <EmptyState icon={ShoppingCart} title="No executing projects in your scope" body="Contracts are checked for price anomalies on projects that are actively executing. Create or activate a project to see procurement screening." />
    </div>;
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Procurement Anomaly Detection</h1>
          <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
            Every contract package is compared against its <strong className="text-foreground">intelligence fair-price benchmark</strong> (what this category of
            work typically costs). Contracts priced well above benchmark are flagged — and behavioural warnings catch the patterns
            fraud actually takes: one vendor holding too much, split packages, or expensive contracts on already-stressed projects.
          </p>
          <div className="mt-2"><PipelineStrip steps={[
            { label: "Contract register", hint: "Each executing project's packages — civil, electrical, mechanical, IT — with vendor and awarded value." },
            { label: "Fair-price benchmark", hint: "Category-level benchmark estimate per package; variance = awarded vs benchmark." },
            { label: "Anomaly flags", hint: "High variance, single-package concentration above 25% of the project budget, or repeat-vendor patterns." },
            { label: "Investigate", hint: "Open the project to see budget records and raise an intervention with an owner and deadline." },
          ]} /></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportRows("csv")}><FileDown className="h-3.5 w-3.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportRows("xlsx")}><FileDown className="h-3.5 w-3.5" />Excel</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Contracts monitored" value={summary.totalContracts} tone="brand" icon={FileWarning} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Across executing projects</div>} delay={0} />
        <StatCard title="Suspicious contracts" value={summary.suspicious} tone="red" icon={ShieldAlert} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Need investigation</div>} delay={0.05} />
        <StatCard title="Price anomalies" value={summary.priceAnomalies} tone="amber" icon={TrendingUp} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Above fair-price benchmark</div>} delay={0.1} />
        <StatCard title="Vendor alerts" value={summary.vendorAlerts} tone="violet" icon={Users} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Vendors with flagged contracts</div>} delay={0.15} />
      </div>

      {/* worst callout */}
      {worst && worst.variancePct > 12 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-500/30 dark:bg-rose-500/10">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-rose-100 p-3 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300"><ShieldAlert className="h-5 w-5" /></div>
            <div className="min-w-0">
              <h3 className="font-bold text-rose-800 dark:text-rose-200">Largest price anomaly: {worst.id} · {worst.vendor}</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-rose-700 dark:text-rose-300">
                {worst.projectName} — {worst.category} awarded at {inr(worst.value)} against a benchmark of {inr(worst.benchmark)} ({worst.variancePct}% above).
                {worst.flags.length > 0 && <> Behavioural flags: {worst.flags.join("; ")}.</>}
              </p>
              <Button variant="outline" size="sm" className="mt-2.5 border-rose-300 text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/15" onClick={() => openProject(worst.projectId)}>
                Open the project
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(["ALL", "High", "Medium", "Low"] as const).map(b => (
          <button key={b} onClick={() => setRisk(b)}
            className={cn("rounded-full px-3 py-1.5 text-[11.5px] font-bold transition",
              risk === b ? "bg-[#0c93e7] text-white shadow-sm" : "border bg-card text-muted-foreground hover:bg-muted/50")}>
            {b === "ALL" ? `All ${contracts.length}` : `${b} risk · ${contracts.filter(c => c.risk === b).length}`}
          </button>
        ))}
      </div>

      {/* contract table */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b p-5">
          <SectionTitle icon={ShoppingCart} sub="Value vs intelligence fair-price benchmark, with behavioural flags" sub2="Click a row to open the project">Contract screening</SectionTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted/50">
              <tr>
                {["Contract", "Project", "Vendor", "Category", "Value", "Benchmark", "Variance", "Risk", "Signal"].map(h => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map(c => (
                <tr key={c.id} className="cursor-pointer transition hover:bg-muted/40" onClick={() => openProject(c.projectId)}>
                  <td className="px-4 py-3 text-[12.5px] font-bold tabular">{c.id}</td>
                  <td className="max-w-[200px] px-4 py-3"><p className="truncate text-[12.5px] font-medium">{c.projectName}</p><p className="text-[10px] text-muted-foreground">{c.psId}</p></td>
                  <td className="max-w-[170px] truncate px-4 py-3 text-[12.5px]">{c.vendor}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-muted-foreground">{c.category}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] font-semibold tabular">{inr(c.value)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] tabular">
                    <span className="inline-flex items-center gap-1"><InfoTip label="Fair-price benchmark" body={`An independent estimate of what this ${c.category.toLowerCase()} package should cost, given category norms and package size. The variance column compares the awarded price against it.`} />{inr(c.benchmark)}</span>
                  </td>
                  <td className={"px-4 py-3 text-[12.5px] font-bold tabular " + varColor(c.variancePct)}>{c.variancePct > 0 ? "+" : ""}{c.variancePct}%</td>
                  <td className="px-4 py-3"><span className={cn("rounded-full px-2.5 py-1 text-[10.5px] font-bold", riskChip(c.risk))}>{c.risk}</span></td>
                  <td className="max-w-[220px] px-4 py-3">
                    <p className="truncate text-[11px] text-muted-foreground">{c.anomaly}</p>
                    {c.flags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.flags.map(f => <span key={f} className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[9.5px] font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><Flag className="h-2.5 w-2.5" />{f}</span>)}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground">
          All values in ₹ lakhs. Benchmarks are category-level fair-price estimates; flags mark behavioural patterns, not proof of wrongdoing — verify in the project before acting.
        </div>
      </div>

      {/* flagged vendors */}
      {summary.flaggedVendors.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <SectionTitle icon={Users} sub="Vendors holding more than one flagged contract — the repeat-pattern watchlist">Vendor watchlist</SectionTitle>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {summary.flaggedVendors.slice(0, 9).map(v => (
              <div key={v.vendor} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
                <span className="truncate text-[12px] font-medium">{v.vendor}</span>
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{v.count} flagged</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
