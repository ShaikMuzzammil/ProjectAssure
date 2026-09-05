"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Authority Review — the one page an senior officer reads before signing.
// Only projects outside the healthy band, each with its issues and the ONE
// recommended action to take. Pending change orders become decisions.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { StatCard, SectionTitle, InfoTip, PipelineStrip, EmptyState, HealthBadge } from "../shared/ui-bits";
import { deriveContracts, deriveChangeOrders, deriveAuthorityReview, csvRows } from "@/lib/projectassure/monitor";
import { downloadCsv, downloadExcel } from "@/lib/projectassure/reports";
import { buildReport, downloadPdf } from "@/lib/projectassure/reports";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Building2, ShieldAlert, IndianRupee, ShoppingCart, Clock, ArrowRight, FileDown, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function AuthorityReviewView() {
  const projects = useApp(s => s.scoped)();
  const stats = useApp(s => s.stats)();
  const user = useApp(s => s.user)!;
  const recordExport = useApp(s => s.recordExport);
  const openProject = useApp(s => s.openProject);
  const navigate = useApp(s => s.navigate);
  const setAiOpen = useApp(s => s.setAiOpen);

  const contracts = useMemo(() => deriveContracts(projects), [projects]);
  const cos = useMemo(() => deriveChangeOrders(projects), [projects]);
  const review = useMemo(() => deriveAuthorityReview(projects, contracts, cos, stats), [projects, contracts, cos, stats]);

  const exportRows = (fmt: "csv" | "xlsx") => {
    const data = csvRows.authority(review.projects);
    const name = `projectassure-authority-review-${new Date().toISOString().slice(0, 10)}`;
    if (fmt === "csv") downloadCsv(data, name + ".csv");
    else void downloadExcel({
      meta: { title: "Authority Review", subtitle: `${review.projects.length} projects requiring attention · recommended actions`, scope: "Simple Monitoring · Authority Review", generatedBy: user.name, generatedAt: new Date().toISOString(), classification: "RESTRICTED :: SIH26103" },
      sections: [{ title: "Authority review", blocks: [{ type: "table", head: data[0].map(String), rows: data.slice(1).map(r => r.map(String)) }] }],
    }, name, [{ name: "Authority review", rows: data }]);
    recordExport("Authority review export", fmt, `${review.projects.length} projects`);
    toast.success(`Authority review ${fmt.toUpperCase()} exported`, { description: `${review.projects.length} projects with issues and actions · audit-logged` });
  };

  const exportBriefing = async () => {
    const doc = buildReport("executive", projects, stats, user);
    doc.meta.title = "Authority Review Briefing";
    doc.meta.subtitle = `${review.projects.length} projects outside the healthy band · one recommended action each`;
    doc.sections.push({
      title: "Authority summary",
      blocks: [
        { type: "para", text: review.headline },
        { type: "table", head: ["Project", "Risk", "Issues", "Recommended action", "Decision pending"], rows: review.projects.map(p => [p.name, String(p.riskScore), p.issues.join("; "), p.recommendedAction, p.needsDecision ? "YES" : "—"]) },
        { type: "para", text: `Financial alerts: ${review.financialAlerts} · procurement alerts: ${review.procurementAlerts} · change orders awaiting decision: ${review.pendingApprovals}.` },
      ],
    });
    await downloadPdf(doc, `projectassure-authority-briefing-${new Date().toISOString().slice(0, 10)}`);
    recordExport("Authority briefing", "pdf", `${review.projects.length} projects`);
    toast.success("Authority briefing PDF exported", { description: "Executive report + issues + recommended actions · audit-logged" });
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Authority Review</h1>
          <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
            The pre-signature page. Only projects <strong className="text-foreground">outside the healthy band</strong> are shown — each with its combined
            issues and <strong className="text-foreground">one recommended action</strong>. If a project has change orders waiting, the decision is flagged here.
            Export the whole thing as a one-click briefing PDF.
          </p>
          <div className="mt-2"><PipelineStrip steps={[
            { label: "Escalation filter", hint: "Anything scored Healthy drops off this page automatically — you only see what genuinely needs an authority's eyes." },
            { label: "Issues combined", hint: "Budget overrun, delay probability, payment-work gap, procurement anomalies and blocked critical milestones — merged per project." },
            { label: "One action each", hint: "The recommended action matches the dominant issue: financial review, field verification, vendor review or critical-path meeting." },
            { label: "Sign-off pack", hint: "Export a branded briefing PDF with the full list for the file — audit-logged like every export." },
          ]} /></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportRows("csv")}><FileDown className="h-3.5 w-3.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportRows("xlsx")}><FileDown className="h-3.5 w-3.5" />Excel</Button>
          <Button size="sm" onClick={() => void exportBriefing()}><FileText className="h-3.5 w-3.5" />Briefing PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Projects needing attention" value={review.projects.length} tone="red" icon={ShieldAlert} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Outside the healthy band</div>} delay={0} />
        <StatCard title="Financial alerts" value={review.financialAlerts} tone="amber" icon={IndianRupee} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Forecast overrun above 10%</div>} delay={0.05} />
        <StatCard title="Procurement alerts" value={review.procurementAlerts} tone="violet" icon={ShoppingCart} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Contracts above benchmark</div>} delay={0.1} />
        <StatCard title="Decisions pending" value={review.pendingApprovals} tone="brand" icon={Clock} footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Change orders awaiting review</div>} delay={0.15} />
      </div>

      {/* headline banner */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className={cn("rounded-xl border p-5",
          review.projects.length > 0
            ? "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10"
            : "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10")}>
        <div className="flex items-start gap-4">
          <div className={cn("rounded-lg p-3", review.projects.length > 0 ? "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300")}>
            {review.projects.length > 0 ? <ShieldAlert className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h3 className={cn("font-bold", review.projects.length > 0 ? "text-rose-800 dark:text-rose-200" : "text-emerald-800 dark:text-emerald-200")}>
              {review.projects.length > 0 ? "Immediate review recommended" : "All clear today"}
            </h3>
            <p className={cn("mt-1 text-[12.5px] leading-relaxed", review.projects.length > 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300")}>{review.headline}</p>
          </div>
        </div>
      </motion.div>

      {/* project cards */}
      {review.projects.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <EmptyState icon={CheckCircle2} title="Nothing needs your signature"
            body="Every scoped project is inside the healthy band. This page refills automatically the moment any project crosses a threshold." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {review.projects.map((p, i) => {
            const proj = projects.find(pp => pp.id === p.id);
            return (
              <motion.div key={p.psId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold leading-tight">{p.name}</p>
                    <p className="mt-0.5 text-[10.5px] text-muted-foreground">{p.psId}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {p.needsDecision && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9.5px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">DECISION PENDING</span>}
                    <span className={cn("rounded-full px-2.5 py-1 text-[10.5px] font-bold",
                      p.riskScore >= 40 ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300")}>
                      risk {p.riskScore}
                    </span>
                  </div>
                </div>

                {proj && <div className="mt-2"><HealthBadge status={p.healthStatus} score={proj.healthScore} /></div>}

                <div className="mt-3 space-y-1.5">
                  <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">Issues found</div>
                  <ul className="space-y-1">
                    {p.issues.map(iss => (
                      <li key={iss} className="flex items-start gap-2 text-[11.5px] leading-relaxed">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />{iss}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-3 rounded-lg border border-[#0c93e7]/25 bg-[#0c93e7]/5 p-3 dark:border-[#0c93e7]/30 dark:bg-[#0c93e7]/10">
                  <div className="text-[9.5px] font-bold uppercase tracking-wider text-[#015ca0] dark:text-[#7cc8fb]">Recommended action</div>
                  <p className="mt-0.5 text-[12px] font-semibold leading-relaxed">{p.recommendedAction}</p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => openProject(p.id)}>Open project</Button>
                  <Button variant="outline" size="sm" onClick={() => { setAiOpen(true); useApp.getState().setAiContext?.(p.id); useApp.getState().askAi(`Give me the full action plan for ${p.name}.`); }}>
                    Intelligence action plan <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                  {p.needsDecision && <Button variant="outline" size="sm" onClick={() => navigate("change-orders")}>See change orders</Button>}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <span className="max-w-xl text-[11.5px] leading-relaxed text-muted-foreground">
          <InfoTip label="What an authority should do with this" body="Read the issues, check the recommended action, then either open the project for detail or export the briefing PDF for the file. The register re-sorts itself the moment any project's health changes." />
          {" "}This page is deliberately short: everything here is actionable, nothing needs interpretation.
        </span>
        <Button variant="outline" size="sm" onClick={() => navigate("monitor")}>Back to the simple overview</Button>
      </div>
    </div>
  );
}
