"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, RadialBarChart, RadialBar, PolarAngleAxis, ComposedChart, Line, Area, CartesianGrid, ReferenceLine } from "recharts";
import { useApp } from "@/store/app-store";
import { StatCard, HealthRing, HealthBadge, ProgressBar, SectionTitle, SECTOR_COLORS, CHART_COLORS, EmptyState, MiniGauge, Delta, PipelineStrip } from "../shared/ui-bits";
import { inr, relTime, shortDate } from "@/lib/projectassure/format";
import { SEVERITY_RANK } from "@/lib/projectassure/permissions";
import { buildAttentionList } from "@/lib/projectassure/recommendations";
import { downloadCsv, downloadExcel, downloadPdf, projectsToRows, buildReport } from "@/lib/projectassure/reports";
import { toast } from "sonner";
import {
  FolderKanban, CheckCircle2, AlertTriangle, Siren, IndianRupee, ShieldAlert, Sparkles, Download,
  TrendingUp, FileDown, Gauge as GaugeIcon, BrainCircuit, ArrowRight, RefreshCw, Bell, Plus, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function DashboardView() {
  const user = useApp(s => s.user)!;
  const projects = useApp(s => s.scoped)();
  const stats = useApp(s => s.stats)();
  const navigate = useApp(s => s.navigate);
  const openProject = useApp(s => s.openProject);
  const askAi = useApp(s => s.askAi);
  const recordExport = useApp(s => s.recordExport);
  const runPrediction = useApp(s => s.runPrediction);
  const createIntervention = useApp(s => s.createIntervention);
  const liveEvents = useApp(s => s.liveEvents);
  const thresholds = useApp(s => s.thresholds);

  const donut = [
    { name: "Healthy", value: stats.healthy, color: "#22c55e" },
    { name: "At Risk", value: stats.atRisk, color: "#f59e0b" },
    { name: "Critical", value: stats.critical, color: "#ef4444" },
  ];
  const sectorData = useMemo(() => {
    const m = new Map<string, { budget: number; count: number }>();
    for (const p of projects) { const e = m.get(p.sector) ?? { budget: 0, count: 0 }; e.budget += p.totalBudget; e.count++; m.set(p.sector, e); }
    return [...m.entries()].map(([sector, v]) => ({ sector, ...v })).sort((a, b) => b.budget - a.budget);
  }, [projects]);

  const criticalAlerts = useMemo(() => projects.flatMap(p => p.alerts.filter(a => !a.isRead).map(a => ({ ...a, project: p })))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5), [projects]);

  const ranking = useMemo(() => [...projects].sort((a, b) => a.healthScore - b.healthScore).slice(0, 8), [projects]);
  // v3: “What requires my attention today?” — the authority's first answer
  const attention = useMemo(() => buildAttentionList(projects, 6), [projects]);
  const exceptions = useMemo(() => projects.filter(p => p.healthStatus !== "HEALTHY"), [projects]);

  const budgetUtil = stats.totalBudget ? (stats.totalSpent / stats.totalBudget) * 100 : 0;
  const projectedOverrunProjects = projects.filter(p => p.projectedBudget > p.totalBudget * 1.1);

  // cumulative burn trend (portfolio)
  const burnTrend = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of projects) for (const r of p.budgetRecords) { const k = `${r.year}-${String(r.month).padStart(2, "0")}`; m.set(k, (m.get(k) ?? 0) + r.spent); }
    const keys = [...m.keys()].sort();
    let acc = 0;
    const rows: { month: string; cumulative: number; idx: number }[] = [];
    for (let i = 0; i < keys.length; i++) { acc += m.get(keys[i])!; rows.push({ month: keys[i].slice(2).replace("-", "/"), cumulative: Math.round(acc / 100), idx: i }); }
    return rows.slice(-12);
  }, [projects]);

  const exportPortfolio = (fmt: "csv" | "xlsx" | "pdf") => {
    if (fmt === "csv") {
      const rows = projectsToRows(projects);
      downloadCsv(rows, `projectassure-portfolio-${new Date().toISOString().slice(0, 10)}.csv`);
      recordExport("Portfolio export", "csv", `${projects.length} projects (scoped)`);
      toast.success("Portfolio CSV exported", { description: `${rows.length - 1} rows · 23 columns · audit-logged` });
    } else if (fmt === "xlsx") {
      const doc = buildReport("executive", projects, stats, user);
      void downloadExcel(doc, `projectassure-portfolio-${new Date().toISOString().slice(0, 10)}`, [{ name: "Projects", rows: projectsToRows(projects) }]);
      recordExport("Portfolio export", "xlsx", `${projects.length} projects (scoped)`);
      toast.success("Portfolio Excel exported", { description: "Executive summary sheet + full project rows · audit-logged" });
    } else {
      const doc = buildReport("executive", projects, stats, user);
      void downloadPdf(doc, `projectassure-portfolio-${new Date().toISOString().slice(0, 10)}`);
      recordExport("Portfolio export", "pdf", `${projects.length} projects (scoped)`);
      toast.success("Portfolio PDF exported", { description: "Branded annexure — totals, exceptions, per-project rows · audit-logged" });
    }
  };

  const flagged = projects.find(p => p.healthStatus === "AT_RISK") ?? projects.find(p => p.healthStatus !== "HEALTHY");

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Namaste, {user.name.split(" ")[0]} 🙏</h1>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {user.persona} · {projects.length} projects in your scope · {stats.alertsUnread} unread alerts · portfolio refreshed {liveEvents[0] ? relTime(liveEvents[0].at) : "3h ago"}
          </p>
          <div className="mt-2"><PipelineStrip steps={[
            { label: "Live project data", hint: "Every score, alert and chart is recomputed from the project records on each change — no cached snapshots." },
            { label: "Health engine 30/25/20/25", hint: "Schedule 30% · Budget 25% · Resources 20% · Milestones 25% → composite 0–100 per project." },
            { label: "Attention list", hint: "The engine ranks which projects need intervention today, with the plain-language reason for each." },
            { label: "Act & export", hint: "Open a project, ask Assure Intelligence, raise an intervention — or export this view as CSV/Excel/PDF." },
          ]} /></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { flagged && runPrediction(flagged.id); toast.success("Scoring run triggered", { description: `${flagged?.psId} re-scored with AssurePredict 2.3` }); }}
            className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-[12.5px] font-semibold transition hover:border-[#0c93e7]/40">
            <RefreshCw className="h-3.5 w-3.5" />Re-score worst project
          </button>
          <button onClick={() => exportPortfolio("csv")} className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-[12.5px] font-semibold transition hover:border-[#0c93e7]/40">
            <FileDown className="h-3.5 w-3.5" />CSV
          </button>
          <button onClick={() => exportPortfolio("xlsx")} className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-[12.5px] font-semibold transition hover:border-[#0c93e7]/40">
            <FileDown className="h-3.5 w-3.5" />Excel
          </button>
          <button onClick={() => exportPortfolio("pdf")} className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-[12.5px] font-semibold transition hover:border-[#0c93e7]/40">
            <FileDown className="h-3.5 w-3.5" />PDF
          </button>
          <button onClick={() => askAi("Which projects need my attention today?")}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0b426e] to-[#0c93e7] px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:shadow-md">
            <Sparkles className="h-3.5 w-3.5" />Ask Assure Intelligence
          </button>
        </div>
      </div>

      {/* getting-started banner for fresh registered accounts */}
      {projects.length === 0 && user.source === "registered" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[#0c93e7]/30 bg-gradient-to-r from-[#e0effe]/70 to-card p-5 dark:from-[#0c93e7]/10">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0c93e7] text-white"><Sparkles className="h-5 w-5" /></div>
            <div className="min-w-[240px] flex-1">
              <div className="text-[15px] font-bold">Your workspace is ready, {user.name.split(" ")[0]} — create your first project</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                Register a project with the 6-step wizard (name, timeline, budget, team, <strong>document upload</strong>), and the
                18-signal ML engine starts monitoring immediately — milestones, predictions, alerts, PDF/Excel exports and email
                reports are all wired to your data.
              </p>
            </div>
            <button onClick={() => navigate("projects")}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0b426e] to-[#0c93e7] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:shadow-md">
              <Plus className="h-4 w-4" />Create project
            </button>
          </div>
        </motion.div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Projects monitored" value={stats.totalProjects} icon={FolderKanban} tone="brand" delay={0}
          footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">{stats.active} active · {inr(stats.totalBudget)} sanctioned</div>} />
        <StatCard title="On track (Green ≥75)" value={stats.healthy} icon={CheckCircle2} tone="green" delay={0.05
        } onClick={() => navigate("projects")} deltaNote="healthy" />
        <StatCard title="At risk (Amber 50–74)" value={stats.atRisk} icon={AlertTriangle} tone="amber" delay={0.1}
          onClick={() => flagged && openProject(flagged.id)} />
        <StatCard title="Critical (Red <50)" value={stats.critical} icon={Siren} tone="red" delay={0.15}
          onClick={() => { const c = projects.find(p => p.healthStatus === "CRITICAL"); c && openProject(c.id); }} />
      </div>

      {/* v3: IMMEDIATE ATTENTION — the first thing an authority reads */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
        className="rounded-xl border-2 border-l-[3px] border-l-rose-500 bg-card p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-[15px] font-bold">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" /></span>
              Requires your attention today
            </h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {attention.length ? `${attention.length} project${attention.length > 1 ? "s" : ""} need intervention — with the plain reason for each.` : "Nothing needs intervention today — the rule engine keeps watching."}
            </p>
          </div>
          <button onClick={() => navigate("interventions")} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11.5px] font-semibold transition hover:bg-muted"><ClipboardList className="h-3.5 w-3.5" />Interventions Centre →</button>
        </div>
        {attention.length === 0 && (
          <div className="rounded-lg border border-dashed p-4 text-center text-[12px] text-muted-foreground">
            All clear. Portfolio health averages {Math.round(stats.avgHealth)}/100 — the live feed keeps checking every 40 seconds.
          </div>
        )}
        <div className="space-y-2">
          {attention.map((item, i) => (
            <motion.div key={item.project.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}
              className={cn("grid items-center gap-3 rounded-lg border p-3 sm:grid-cols-[auto_1fr_auto_auto]", item.urgency === 1 ? "border-rose-500/30 bg-rose-500/[0.04]" : item.urgency === 2 ? "border-amber-500/30 bg-amber-500/[0.04]" : "")}>
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold", item.urgency === 1 ? "bg-rose-500 text-white" : item.urgency === 2 ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground")}>{i + 1}</span>
              <div className="min-w-0">
                <button onClick={() => openProject(item.project.id)} className="block truncate text-left text-[13px] font-bold hover:text-[#0c93e7] dark:hover:text-[#36adf6]">
                  {item.project.name.replace(/,.*$/, "")} <span className="font-normal text-muted-foreground">· {item.project.psId}</span>
                </button>
                <div className="mt-0.5 text-[11.5px]">
                  <span className={cn("font-bold", item.urgency === 1 ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400")}>{item.reason}</span>
                  {item.reasonDetail && <span className="text-muted-foreground"> — {item.reasonDetail}</span>}
                </div>
              </div>
              <HealthBadge status={item.project.healthStatus} score={item.project.healthScore} />
              <div className="flex gap-1.5">
                <button onClick={() => openProject(item.project.id, "actions")} className="rounded-lg bg-[#0b426e] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#0c93e7]">What to do</button>
                <button onClick={() => askAi(`Why is ${item.project.name.replace(/,.*$/, "")} at risk?`)} className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition hover:bg-muted"><Sparkles className="h-3 w-3 text-[#0c93e7]" /></button>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* main grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* health donut */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-xl border bg-card p-5">
          <SectionTitle icon={GaugeIcon} sub="weights 30 / 25 / 20 / 25">Portfolio health</SectionTitle>
          <div className="relative h-[210px]">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={donut} dataKey="value" innerRadius={62} outerRadius={84} paddingAngle={3} strokeWidth={0}
                  animationDuration={900}>
                  {donut.map(d => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <RTooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e2e8f0" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[30px] font-extrabold tabular leading-none">{stats.avgHealth}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">avg health</span>
              <span className="mt-1 text-[10px] tabular text-muted-foreground">{stats.avgProgress}% avg progress</span>
            </div>
          </div>
          <div className="mt-2 space-y-1.5">
            {donut.map(d => (
              <div key={d.name} className="flex items-center gap-2 text-[11.5px]">
                <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                <span className="font-medium">{d.name}</span>
                <span className="ml-auto tabular font-semibold">{d.value}</span>
                <span className="w-10 text-right tabular text-muted-foreground">{stats.totalProjects ? Math.round(d.value / stats.totalProjects * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* budget gauge + sector bars */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="rounded-xl border bg-card p-5">
          <SectionTitle icon={IndianRupee} sub={`${inr(stats.totalSpent)} of ${inr(stats.totalBudget)}`}>Budget utilisation</SectionTitle>
          <div className="flex items-center gap-4">
            <MiniGauge value={budgetUtil} size={96} label="utilised" thresholds={[thresholds.budgetWarnPct, thresholds.budgetCriticalPct]} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 dark:border-amber-500/25 dark:bg-amber-500/10">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Overrun watchlist</div>
                <div className="text-[12.5px] font-semibold text-amber-800 dark:text-amber-200">{stats.projectedOverruns} projects projected above +{thresholds.budgetWarnPct}%</div>
                <button onClick={() => navigate("analytics")} className="mt-0.5 flex items-center gap-1 text-[10.5px] font-bold text-amber-700 hover:underline dark:text-amber-300">Analyse budget bands <ArrowRight className="h-3 w-3" /></button>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Thresholds: <strong>&gt;{thresholds.budgetWarnPct}%</strong> WARNING · <strong>&gt;{thresholds.budgetCriticalPct}%</strong> CRITICAL escalation
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sanctioned by sector (₹ Cr)</div>
            <div className="h-[118px]">
              <ResponsiveContainer>
                <BarChart data={sectorData} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="sector" width={82} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <RTooltip formatter={(v: number) => [`${Math.round(v / 100)} Cr · ${sectorData.find(s => s.budget === v)?.count ?? ""} projects`, "Sanction"] as [string, string]} contentStyle={{ borderRadius: 8, fontSize: 11.5 }} />
                  <Bar dataKey="budget" radius={[0, 4, 4, 0]} animationDuration={800}>
                    {sectorData.map(s => <Cell key={s.sector} fill={SECTOR_COLORS[s.sector] ?? "#0c93e7"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        {/* critical alerts */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-xl border bg-card p-5">
          <SectionTitle icon={ShieldAlert} sub={`${stats.alertsUnread} unread · ${stats.criticalAlerts} critical`}>Risk-ranked alerts</SectionTitle>
          <div className="custom-scrollbar max-h-[300px] space-y-2 overflow-y-auto pr-1">
            {criticalAlerts.length === 0 && <EmptyState icon={Bell} title="No critical alerts" body="You are all caught up — the portfolio heartbeat is green." />}
            {criticalAlerts.map(a => (
              <button key={a.id} onClick={() => openProject(a.project.id)} className="block w-full rounded-lg border p-3 text-left transition hover:border-[#0c93e7]/40 hover:shadow-sm">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", a.severity === "CRITICAL" ? "bg-[#ef4444]" : a.severity === "HIGH" ? "bg-[#f97316]" : a.severity === "MEDIUM" ? "bg-[#f59e0b]" : "bg-[#0c93e7]")} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: a.severity === "CRITICAL" ? "var(--critical-text)" : a.severity === "HIGH" ? "var(--sev-high-text)" : "var(--atrisk-text)" }}>{a.severity}</span>
                  <span className="ml-auto text-[9.5px] tabular text-muted-foreground">{relTime(a.createdAt)}</span>
                </div>
                <div className="mt-1 text-[12.5px] font-semibold leading-snug">{a.title}</div>
                <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{a.project.name.replace(/,.*$/, "")} · {a.recommendedDeadline}</div>
              </button>
            ))}
          </div>
          <button onClick={() => navigate("alerts")} className="mt-2.5 w-full rounded-lg border py-2 text-[12px] font-semibold transition hover:bg-muted">Open Alerts Centre ({stats.alertsUnread} unread)</button>
        </motion.div>
      </div>

      {/* AI chips + exceptions strip */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="rounded-xl border bg-gradient-to-r from-[#072b49] to-[#0b426e] p-4 text-white">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-[12px] font-bold"><BrainCircuit className="h-4 w-4 text-[#7cc8fb]" />Ask Assure Intelligence</div>
          <div className="flex flex-wrap gap-2">
            {["Why is Bharatmala P-4 at risk?", "Which projects need my attention today?", "Show budget overrun forecasts", "Compare the at-risk projects"].map(q => (
              <button key={q} onClick={() => askAi(q)} className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11.5px] font-medium backdrop-blur transition hover:bg-white/20">{q}</button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ranking + trend */}
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="rounded-xl border bg-card p-5">
          <SectionTitle icon={TrendingUp} sub="worst first · click to drill" sub2="">Project ranking</SectionTitle>
          <div className="custom-scrollbar max-h-[330px] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-1 py-2 text-left font-semibold">Project</th>
                  <th className="px-1 py-2 text-center font-semibold">Health</th>
                  <th className="hidden px-1 py-2 text-center font-semibold sm:table-cell">Progress</th>
                  <th className="hidden px-1 py-2 text-right font-semibold sm:table-cell">Spent</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map(p => (
                  <tr key={p.id} onClick={() => openProject(p.id)} className="cursor-pointer border-b transition hover:bg-muted/50">
                    <td className="max-w-[230px] px-1 py-2">
                      <div className="truncate font-semibold">{p.name.replace(/,.*$/, "")}</div>
                      <div className="text-[10px] text-muted-foreground">{p.state} · {p.sector}</div>
                    </td>
                    <td className="px-1 py-2 text-center"><HealthBadge status={p.healthStatus} /><div className="mt-0.5 text-[10px] tabular text-muted-foreground">{p.healthScore}/100</div></td>
                    <td className="hidden px-1 py-2 sm:table-cell"><ProgressBar value={p.progress} className="w-16" /><div className="mt-0.5 text-center text-[10px] tabular text-muted-foreground">{p.progress}%</div></td>
                    <td className="hidden px-1 py-2 text-right sm:table-cell"><div className="tabular font-semibold">{inr(p.spentBudget)}</div><div className="text-[10px] text-muted-foreground">of {inr(p.totalBudget)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="rounded-xl border bg-card p-5">
          <SectionTitle icon={GaugeIcon} sub="cumulative expenditure · ₹ Cr (last 12 months)">Portfolio burn trend</SectionTitle>
          <div className="h-[330px]">
            <ResponsiveContainer>
              <ComposedChart data={burnTrend} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="burnFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0c93e7" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#0c93e7" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <RTooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")} Cr`, "Cumulative spend"]} contentStyle={{ borderRadius: 8, fontSize: 11.5 }} />
                <Area type="monotone" dataKey="cumulative" stroke="#0c93e7" strokeWidth={2.2} fill="url(#burnFill)" animationDuration={900} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* exceptions detail strip */}
      {exceptions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="rounded-xl border bg-card p-5">
          <SectionTitle icon={AlertTriangle} sub="the exception story, worst first">Projects requiring attention</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {exceptions.map(p => (
              <div key={p.id} className="rounded-xl border p-4 transition hover:border-[#0c93e7]/40">
                <div className="flex items-start gap-3">
                  <HealthRing score={p.healthScore} size={64} />
                  <div className="min-w-0 flex-1">
                    <button onClick={() => openProject(p.id)} className="block truncate text-left text-[13px] font-bold hover:text-[#0c93e7]">{p.name.replace(/,.*$/, "")}</button>
                    <div className="text-[10.5px] text-muted-foreground">{p.psId} · {p.district}, {p.state}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <HealthBadge status={p.healthStatus} />
                      {p.prediction && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular">{Math.round(p.prediction.probability * 100)}% delay risk</span>}
                      {p.projectedBudget > p.totalBudget * 1.1 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">+{(((p.projectedBudget - p.totalBudget) / p.totalBudget) * 100).toFixed(1)}% overrun</span>}
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                  {[["SCH", p.scheduleScore], ["BUD", p.budgetScore], ["RES", p.resourceScore], ["MIL", p.milestoneScore]].map(([l, v]) => (
                    <div key={l as string} className="rounded-lg bg-muted/60 py-1.5">
                      <div className="text-[9px] font-bold text-muted-foreground">{l}</div>
                      <div className="text-[13px] font-bold tabular">{Math.round(v as number)}</div>
                    </div>
                  ))}
                </div>
                {p.prediction && (
                  <div className="mt-2.5 rounded-lg bg-muted/40 px-2.5 py-2 text-[10.5px] leading-snug text-muted-foreground">
                    <strong>Model:</strong> {Math.round(p.prediction.probability * 100)}% delay · {p.prediction.estimatedDays}-day slip (CI {p.prediction.ciLower}–{p.prediction.ciUpper}) · top factor: {p.prediction.factors[0]?.label}
                  </div>
                )}
                <div className="mt-2.5 flex gap-2">
                  <button onClick={() => openProject(p.id)} className="flex-1 rounded-lg border py-1.5 text-[11.5px] font-semibold transition hover:bg-muted">Drill in</button>
                  <button onClick={() => askAi(`Why is ${p.name.replace(/,.*$/, "")} at risk?`)} className="flex items-center gap-1 rounded-lg bg-[#0b426e] px-2.5 py-1.5 text-[11.5px] font-semibold text-white transition hover:bg-[#0c93e7]"><Sparkles className="h-3 w-3" />Why?</button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
