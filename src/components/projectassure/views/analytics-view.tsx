"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid, ScatterChart, Scatter, ZAxis, ReferenceLine, Cell, Legend, LineChart, Line, ComposedChart, Area } from "recharts";
import { useApp } from "@/store/app-store";
import { SectionTitle, HealthBadge, SECTOR_COLORS, CHART_COLORS, EmptyState } from "../shared/ui-bits";
import { inr, shortDate, monthLabel } from "@/lib/projectassure/format";
import { buildReport, downloadPdf, downloadExcel, downloadCsv, projectsToRows, reportFileName, REPORT_KINDS } from "@/lib/projectassure/reports";
import type { ReportKind } from "@/lib/projectassure/types";
import { can } from "@/lib/projectassure/permissions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileText, FileSpreadsheet, FileDown, Mail, LineChart as LineIcon, BarChart3, ScatterChart as ScatterIcon, History, Sparkles, Building2 } from "lucide-react";

const TABS = [
  { id: "portfolio", label: "Portfolio", icon: BarChart3 },
  { id: "budget", label: "Budget bands", icon: LineIcon },
  { id: "trends", label: "Trends", icon: LineIcon },
  { id: "reports", label: "Report builder", icon: FileText },
];

export default function AnalyticsView() {
  const user = useApp(s => s.user)!;
  const projects = useApp(s => s.scoped)();
  const stats = useApp(s => s.stats)();
  const thresholds = useApp(s => s.thresholds);
  const exportHistory = useApp(s => s.exportHistory);
  const recordExport = useApp(s => s.recordExport);
  const queueEmail = useApp(s => s.queueEmail);
  const navigate = useApp(s => s.navigate);
  const openProject = useApp(s => s.openProject);
  const [tab, setTab] = useState("portfolio");
  const [emailDlg, setEmailDlg] = useState<ReportKind | null>(null);

  const deptData = useMemo(() => {
    const m = new Map<string, { code: string; count: number; budget: number; spent: number; avgHealth: number }>();
    for (const p of projects) {
      const e = m.get(p.departmentId) ?? { code: p.departmentId.replace("dept-", "").toUpperCase(), count: 0, budget: 0, spent: 0, avgHealth: 0 };
      e.count++; e.budget += p.totalBudget; e.spent += p.spentBudget; e.avgHealth += p.healthScore;
      m.set(p.departmentId, e);
    }
    return [...m.values()].map(d => ({ ...d, budget: Math.round(d.budget / 100), spent: Math.round(d.spent / 100), avgHealth: Math.round(d.avgHealth / d.count) }));
  }, [projects]);

  const scatter = projects.filter(p => p.status === "ACTIVE").map(p => ({
    x: Math.round((p.spentBudget / p.totalBudget) * 100), y: p.healthScore, z: p.totalBudget / 100, name: p.name.replace(/,.*$/, ""), sector: p.sector,
  }));

  const bottom10 = [...projects].sort((a, b) => a.healthScore - b.healthScore).slice(0, 10);
  const overrunWatch = projects.filter(p => p.projectedBudget > p.totalBudget * 1.05).sort((a, b) => (b.projectedBudget / b.totalBudget) - (a.projectedBudget / a.totalBudget));

  const trend = useMemo(() => {
    const m = new Map<string, { planned: number; spent: number }>();
    for (const p of projects) for (const r of p.budgetRecords) { const k = monthLabel(r.month, r.year); const e = m.get(k) ?? { planned: 0, spent: 0 }; e.planned += r.planned; e.spent += r.spent; m.set(k, e); }
    return [...m.entries()].sort().map(([k, v]) => ({ month: k, planned: Math.round(v.planned / 100), spent: Math.round(v.spent / 100) }));
  }, [projects]);

  const doExport = async (kind: ReportKind, format: "pdf" | "xlsx" | "csv") => {
    const scopeP = kind === "project-status" ? projects.find(p => p.healthStatus !== "HEALTHY") ?? projects[0] : undefined;
    const doc = buildReport(kind, projects, stats, user, scopeP);
    const fn = reportFileName(kind, scopeP);
    if (format === "pdf") await downloadPdf(doc, fn);
    else if (format === "xlsx") await downloadExcel(doc, fn, [{ name: "Data", rows: projectsToRows(projects) }]);
    else downloadCsv(projectsToRows(projects), fn);
    recordExport(REPORT_KINDS.find(r => r.id === kind)?.title ?? kind, format, scopeP ? `${scopeP.psId} — ${scopeP.name}` : `portfolio (${projects.length})`);
    toast.success(`${format.toUpperCase()} exported`, { description: `${fn}.${format} · generated from live data · audit-logged` });
  };

  const emailReport = async (kind: ReportKind) => {
    setEmailDlg(null);
    const scopeP = kind === "project-status" ? projects.find(p => p.healthStatus !== "HEALTHY") ?? projects[0] : undefined;
    const fn = reportFileName(kind, scopeP);
    const msg = await queueEmail({ to: user.email, toName: user.name, template: "report_delivery", reportName: `${fn}.pdf`, project: scopeP, projectId: scopeP?.id, attachments: [{ name: `${fn}.pdf`, kind: "pdf", sizeKb: 312 }], send: true });
    toast.success(msg.status === "SENT" ? "Report emailed via email service" : "Report queued to the demo outbox", { description: `To: ${msg.to} · preview in the Email Centre` });
    navigate("email-center");
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Analytics</h1>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">Portfolio lens · {projects.length} projects in scope · read-only aggregation domain (analytics.projectassure)</p>
        </div>
      </div>

      <div className="custom-scrollbar flex gap-1 overflow-x-auto rounded-xl border bg-card p-1.5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold transition", tab === t.id ? "bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]" : "text-muted-foreground hover:bg-muted")}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === "portfolio" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <SectionTitle icon={Building2} sub="projects monitored and sanctioned outlay by division (₹ Cr)">Department comparison</SectionTitle>
            <div className="h-[240px]">
              <ResponsiveContainer>
                <ComposedChart data={deptData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="code" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} label={{ value: "₹ Cr", angle: -90, position: "insideLeft", fontSize: 9, fill: "#64748b" }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <RTooltip contentStyle={{ borderRadius: 8, fontSize: 11.5 }} />
                  <Bar yAxisId="left" dataKey="budget" name="Sanction (₹ Cr)" fill="#0c93e7" radius={[4, 4, 0, 0]} animationDuration={800} />
                  <Bar yAxisId="left" dataKey="spent" name="Spent (₹ Cr)" fill="#0b426e" radius={[4, 4, 0, 0]} animationDuration={800} />
                  <Line yAxisId="right" type="monotone" dataKey="avgHealth" name="Avg health" stroke="#f59e0b" strokeWidth={2.2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="rounded-xl border bg-card p-5 lg:col-span-3">
              <SectionTitle icon={ScatterIcon} sub="bubble size = sanctioned outlay · dashed lines = health bands">Budget utilisation vs health</SectionTitle>
              <div className="h-[300px]">
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 10, right: 16, left: -8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" dataKey="x" name="Budget utilised %" domain={[0, 110]} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} label={{ value: "budget utilised (%)", position: "insideBottom", offset: -2, fontSize: 9.5, fill: "#64748b" }} />
                    <YAxis type="number" dataKey="y" name="Health" domain={[20, 100]} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} label={{ value: "health score", angle: -90, position: "insideLeft", fontSize: 9.5, fill: "#64748b" }} />
                    <ZAxis type="number" dataKey="z" range={[40, 320]} />
                    <RTooltip content={({ payload }) => payload?.[0] && (
                      <div className="rounded-lg border bg-popover p-2.5 text-[11px] shadow-lg">
                        <div className="font-bold">{payload[0].payload.name}</div>
                        <div className="text-muted-foreground">health {payload[0].payload.y} · util {payload[0].payload.x}% · ₹{payload[0].payload.z} Cr · {payload[0].payload.sector}</div>
                      </div>
                    )} />
                    <ReferenceLine y={thresholds.amberAt} stroke="#f59e0b" strokeDasharray="5 4" label={{ value: "amber", fontSize: 9, fill: "#f59e0b" }} />
                    <ReferenceLine y={thresholds.redAt} stroke="#ef4444" strokeDasharray="5 4" label={{ value: "red", fontSize: 9, fill: "#ef4444" }} />
                    <Scatter data={scatter} animationDuration={800}>
                      {scatter.map((s, i) => <Cell key={i} fill={SECTOR_COLORS[s.sector] ?? "#0c93e7"} fillOpacity={0.68} />)}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-3 text-[10px] font-medium text-muted-foreground">
                {Object.entries(SECTOR_COLORS).map(([s, c]) => <span key={s} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{s}</span>)}
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5 lg:col-span-2">
              <SectionTitle icon={BarChart3} sub="worst first — the review queue">Bottom-10 review queue</SectionTitle>
              <div className="custom-scrollbar max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
                {bottom10.map((p, i) => (
                  <button key={p.id} onClick={() => openProject(p.id)} className="flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition hover:border-[#0c93e7]/40">
                    <span className="w-5 text-center text-[10px] font-bold tabular text-muted-foreground">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-semibold">{p.name.replace(/,.*$/, "")}</div>
                      <div className="text-[9.5px] text-muted-foreground">{p.state} · {p.sector}</div>
                    </div>
                    <div className="text-right"><HealthBadge status={p.healthStatus} /><div className="mt-0.5 text-[10px] tabular text-muted-foreground">{p.healthScore}</div></div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "budget" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <SectionTitle icon={LineIcon} sub={`+{t}% WARNING / +20% CRITICAL bands · ${overrunWatch.length} projects above +5%`}>Overrun watchlist</SectionTitle>
            <table className="w-full text-[12px]">
              <thead><tr className="border-b text-[9.5px] uppercase tracking-wider text-muted-foreground"><th className="py-2 text-left font-semibold">Project</th><th className="py-2 text-right font-semibold">Sanction</th><th className="py-2 text-right font-semibold">Spent</th><th className="py-2 text-right font-semibold">Projected</th><th className="py-2 text-right font-semibold">Overrun</th><th className="py-2 text-right font-semibold">Band</th></tr></thead>
              <tbody>
                {overrunWatch.map(p => {
                  const ov = ((p.projectedBudget - p.totalBudget) / p.totalBudget) * 100;
                  return (
                    <tr key={p.id} className="cursor-pointer border-b transition hover:bg-muted/40" onClick={() => openProject(p.id, "budget")}>
                      <td className="max-w-[280px] truncate py-2 font-semibold">{p.name.replace(/,.*$/, "")}</td>
                      <td className="py-2 text-right tabular">{inr(p.totalBudget)}</td>
                      <td className="py-2 text-right tabular">{inr(p.spentBudget)}</td>
                      <td className="py-2 text-right tabular">{inr(p.projectedBudget)}</td>
                      <td className={cn("py-2 text-right font-bold tabular", ov > 20 ? "text-rose-600 dark:text-rose-400" : ov > 10 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>+{ov.toFixed(1)}%</td>
                      <td className="py-2 text-right">{ov > 20 ? <span className="rounded-full bg-[#fee2e2] px-2 py-0.5 text-[10px] font-bold text-[#b91c1c] dark:bg-[#ef4444]/15 dark:text-[#fca5a5]">CRITICAL</span> : ov > 10 ? <span className="rounded-full bg-[#fef3c7] px-2 py-0.5 text-[10px] font-bold text-[#b45309] dark:bg-[#f59e0b]/15 dark:text-[#fcd34d]">WARNING</span> : <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">watch</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {[["WARNING band", projects.filter(p => p.projectedBudget > p.totalBudget * 1.1 && p.projectedBudget <= p.totalBudget * 1.2).length, "#f59e0b"], ["CRITICAL band", projects.filter(p => p.projectedBudget > p.totalBudget * 1.2).length, "#ef4444"], ["Within sanction", projects.filter(p => p.projectedBudget <= p.totalBudget * 1.05).length, "#22c55e"]].map(([l, v, c]) => (
              <div key={l as string} className="rounded-xl border bg-card p-4"><div className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">{l}</div><div className="mt-1 text-[24px] font-extrabold tabular" style={{ color: c as string }}>{v as number}</div></div>
            ))}
          </div>
        </div>
      )}

      {tab === "trends" && (
        <div className="rounded-xl border bg-card p-5">
          <SectionTitle icon={LineIcon} sub="portfolio-level monthly plan vs actual (₹ Cr)">Expenditure trend</SectionTitle>
          <div className="h-[320px]">
            <ResponsiveContainer>
              <ComposedChart data={trend} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
                <defs><linearGradient id="tr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0c93e7" stopOpacity={0.25} /><stop offset="100%" stopColor="#0c93e7" stopOpacity={0.02} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 9.5, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <RTooltip contentStyle={{ borderRadius: 8, fontSize: 11.5 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="spent" name="Actual (₹ Cr)" stroke="#0c93e7" strokeWidth={2.2} fill="url(#tr)" animationDuration={800} />
                <Line type="monotone" dataKey="planned" name="Planned (₹ Cr)" stroke="#0b426e" strokeWidth={2} strokeDasharray="5 4" dot={false} animationDuration={800} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === "reports" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <SectionTitle icon={FileText} sub="pick a report → export PDF/Excel/CSV or email it — every export is audit-logged">Report builder</SectionTitle>
            <div className="grid gap-3 md:grid-cols-2">
              {REPORT_KINDS.map(r => (
                <div key={r.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[13.5px] font-bold">{r.title}</div>
                      <div className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{r.desc}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular">~{r.pages}p</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {r.formats.map(f => (
                      <button key={f} onClick={() => doExport(r.id, f)}
                        className="flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-[11px] font-semibold transition hover:border-[#0c93e7]/50 hover:text-[#015ca0] dark:hover:text-[#7cc8fb]">
                        {f === "pdf" ? <FileText className="h-3 w-3" /> : f === "xlsx" ? <FileSpreadsheet className="h-3 w-3" /> : <FileDown className="h-3 w-3" />}{f.toUpperCase()}
                      </button>
                    ))}
                    {can(user, "email:send") && (
                      <button onClick={() => setEmailDlg(r.id)} className="flex items-center gap-1.5 rounded-lg bg-[#0b426e] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#0c93e7]"><Mail className="h-3 w-3" />Email</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <SectionTitle icon={History} sub="append-only export log (also in the global audit trail)">Export history</SectionTitle>
            <div className="custom-scrollbar max-h-[240px] overflow-y-auto">
              {exportHistory.length === 0 ? <EmptyState icon={History} title="No exports yet" body="Generate a report above — the audit trail records every download and email." /> : (
                <table className="w-full text-[11.5px]">
                  <thead><tr className="border-b text-[9.5px] uppercase tracking-wider text-muted-foreground"><th className="py-2 text-left font-semibold">Report</th><th className="py-2 text-left font-semibold">Format</th><th className="py-2 text-left font-semibold">Scope</th><th className="py-2 text-left font-semibold">By</th><th className="py-2 text-right font-semibold">At</th></tr></thead>
                  <tbody>
                    {exportHistory.map(e => (
                      <tr key={e.id} className="border-b last:border-0"><td className="py-2 font-semibold">{e.kind}</td><td className="py-2"><span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase">{e.format}</span></td><td className="max-w-[240px] truncate py-2 text-muted-foreground">{e.scope}</td><td className="py-2">{e.by}</td><td className="py-2 text-right tabular text-muted-foreground">{new Date(e.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!emailDlg} onOpenChange={o => !o && setEmailDlg(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-[15px]">Email this report</DialogTitle></DialogHeader>
          <p className="text-[12px] text-muted-foreground">The report will be generated and emailed to <strong>{user.email}</strong> with a PDF attachment. In demo mode it lands in the outbox with a full preview; when a real email service is connected it is sent for real.</p>
          <Button className="w-full bg-gradient-to-r from-[#0b426e] to-[#0c93e7]" onClick={() => emailDlg && emailReport(emailDlg)}><Mail className="h-4 w-4" />Generate & email</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
