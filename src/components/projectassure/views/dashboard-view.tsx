"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, ArrowRight, BellRing, CircleDollarSign, Download,
  FolderKanban, Gauge, ShieldCheck, TrendingUp,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, PolarAngleAxis, RadialBar, RadialBarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useAppStore } from "@/store/app-store";
import { computePortfolioStats } from "@/lib/projectassure/engine";
import { formatIndian, formatLakhs, timeAgo } from "@/lib/projectassure/format";
import { HealthBadge, HealthRing, ProgressBar, SectionTitle, SeverityBadge, StatCard, StatusBadge } from "../shared/ui-bits";
import { CHART_COLORS, SECTOR_COLORS } from "../shared/colors";
import { toast } from "sonner";

type SortKey = "healthScore" | "progress" | "totalBudget" | "name";

export function DashboardView() {
  const projects = useAppStore((s) => s.projects);
  const openProject = useAppStore((s) => s.openProject);
  const navigate = useAppStore((s) => s.navigate);
  const askAi = useAppStore((s) => s.askAi);
  const [sortKey, setSortKey] = useState<SortKey>("healthScore");

  const stats = useMemo(() => computePortfolioStats(projects), [projects]);
  const [updated] = useState(() => new Date().toISOString());

  const healthData = [
    { name: "Healthy", value: stats.healthy, color: "#22c55e" },
    { name: "At Risk", value: stats.atRisk, color: "#f59e0b" },
    { name: "Critical", value: stats.critical, color: "#ef4444" },
  ];

  const budgetPct = Math.round((stats.totalSpent / stats.totalBudget) * 100);
  const gaugeData = [{ name: "budget", value: budgetPct, fill: "#0c93e7" }];

  const sectorData = useMemo(() => {
    const map = new Map<string, { sector: string; projects: number; budget: number; health: number }>();
    projects.forEach((p) => {
      const cur = map.get(p.sector) ?? { sector: p.sector, projects: 0, budget: 0, health: 0 };
      cur.projects += 1; cur.budget += p.totalBudget; cur.health += p.healthScore;
      map.set(p.sector, cur);
    });
    return [...map.values()].map((v) => ({ ...v, avgHealth: Math.round(v.health / v.projects) })).sort((a, b) => b.budget - a.budget);
  }, [projects]);

  const sorted = useMemo(() => {
    const arr = [...projects];
    arr.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      return (b[sortKey] as number) - (a[sortKey] as number);
    });
    return arr.slice(0, 8);
  }, [projects, sortKey]);

  const topAlerts = useMemo(() => {
    const sevRank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return projects
      .flatMap((p) => p.alerts.filter((a) => !a.isRead).map((a) => ({ ...a, projectName: p.name })))
      .sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 5);
  }, [projects]);

  const flagged = projects.filter((p) => p.healthStatus !== "HEALTHY");

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[#22c55e]" />
            Live portfolio · updated {timeAgo(updated)}
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Command Centre</h1>
          <p className="text-sm text-muted-foreground">Every project on one screen — predicted, not just reported.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { exportCsv(projects); toast.success("Portfolio CSV exported"); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            onClick={() => askAi("Which projects need my attention today?")}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0c93e7] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0b426e] active:scale-[0.98]"
          >
            <ShieldCheck className="h-4 w-4" /> Ask Assure AI
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total Projects" value={stats.totalProjects} sub={`${stats.active} active · ${formatLakhs(stats.totalBudget, { compact: true })} sanctioned`} icon={<FolderKanban className="h-4 w-4" />} tone="brand" delay={0} onClick={() => navigate("projects")} />
        <StatCard label="On Track" value={stats.healthy} sub={`${Math.round((stats.healthy / stats.totalProjects) * 100)}% of portfolio green`} icon={<Activity className="h-4 w-4" />} tone="green" delay={0.05} />
        <StatCard label="At Risk" value={stats.atRisk} sub="AI predicts 30-60 days early warning" icon={<AlertTriangle className="h-4 w-4" />} tone="amber" delay={0.1} onClick={() => openProject(flagged.find((p) => p.healthStatus === "AT_RISK")?.id ?? "")} />
        <StatCard label="Critical" value={stats.critical} sub={`${stats.criticalAlerts} critical alerts unread`} icon={<BellRing className="h-4 w-4" />} tone="red" delay={0.15} onClick={() => openProject(flagged.find((p) => p.healthStatus === "CRITICAL")?.id ?? "")} />
      </div>

      {/* row 2: donut + gauge + alerts */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* health donut */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <SectionTitle title="Health Distribution" sub="0-100 composite · 30/25/20/25 weights" />
          <div className="mt-2 flex items-center gap-4">
            <div className="relative h-[150px] w-[150px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={healthData} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={3} strokeWidth={0} startAngle={90} endAngle={-270}>
                    {healthData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tabular-nums">{stats.avgHealth}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">avg health</span>
              </div>
            </div>
            <div className="flex-1 space-y-2.5">
              {healthData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />{d.name}
                  </span>
                  <span className="font-semibold tabular-nums">{d.value}</span>
                </div>
              ))}
              <div className="border-t border-border pt-2 text-xs text-muted-foreground">Green ≥75 · Amber 50-74 · Red &lt;50</div>
            </div>
          </div>
        </motion.div>

        {/* budget gauge */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <SectionTitle title="Budget Utilisation" sub="Portfolio spend vs sanction" />
          <div className="relative mt-2 h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="66%" outerRadius="100%" data={gaugeData} startAngle={210} endAngle={-30} domain={[0, 100]}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background={{ fill: "#e2e8f0" }} dataKey="value" cornerRadius={10} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-4">
              <span className="flex items-center gap-1 text-2xl font-bold tabular-nums"><Gauge className="h-4 w-4 text-[#0c93e7]" />{budgetPct}%</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{formatLakhs(stats.totalSpent, { compact: true })} of {formatLakhs(stats.totalBudget, { compact: true })}</span>
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between rounded-md bg-[#fef3c7] px-3 py-2 text-xs text-[#b45309] dark:bg-amber-500/10 dark:text-amber-300">
            <span className="inline-flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />{stats.projectedOverruns} project{stats.projectedOverruns === 1 ? "" : "s"} project{stats.projectedOverruns === 1 ? "s" : ""} &gt;10% overrun</span>
            <button onClick={() => navigate("analytics")} className="font-semibold underline-offset-2 hover:underline">Analyse</button>
          </div>
        </motion.div>

        {/* critical alerts */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <SectionTitle title="Critical Alerts" sub="Risk-ranked · worst first" right={<button onClick={() => navigate("alerts")} className="text-xs font-semibold text-[#0c93e7] hover:underline">View all <ArrowRight className="inline h-3 w-3" /></button>} />
          <div className="mt-3 max-h-[190px] space-y-2.5 overflow-y-auto pr-1 custom-scrollbar">
            {topAlerts.map((a) => (
              <button key={a.id} onClick={() => openProject(a.projectId)} className="block w-full rounded-lg border border-border p-2.5 text-left transition-colors hover:bg-muted/60">
                <div className="flex items-center justify-between gap-2">
                  <SeverityBadge severity={a.severity} />
                  <span className="text-[10px] text-muted-foreground">{timeAgo(a.createdAt)}</span>
                </div>
                <p className="mt-1.5 line-clamp-1 text-xs font-semibold">{a.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">{a.projectName}</p>
              </button>
            ))}
            {topAlerts.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">All clear — no unread alerts.</p>}
          </div>
        </motion.div>
      </div>

      {/* row 3: sector chart + ranking table */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <SectionTitle title="Budget by Sector" sub="Sanctioned outlay · avg health" />
          <div className="mt-4 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="sector" width={90} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number, k) => (k === "budget" ? [formatLakhs(v, { compact: true }), "Sanctioned"] : [v, k])}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                <Bar dataKey="budget" radius={[0, 4, 4, 0]} barSize={16}>
                  {sectorData.map((d, i) => <Cell key={i} fill={SECTOR_COLORS[d.sector] ?? CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <SectionTitle
            title="Project Ranking"
            sub="Sort by any dimension · click to drill down"
            right={
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="rounded-md border border-input bg-background px-2 py-1.5 text-xs font-medium">
                <option value="healthScore">Health score</option>
                <option value="progress">Progress</option>
                <option value="totalBudget">Budget</option>
                <option value="name">Name (A-Z)</option>
              </select>
            }
          />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 font-medium">Project</th>
                  <th className="pb-2 font-medium">Health</th>
                  <th className="pb-2 font-medium">Progress</th>
                  <th className="pb-2 hidden font-medium sm:table-cell">Budget</th>
                  <th className="pb-2 hidden font-medium md:table-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.id} onClick={() => openProject(p.id)} className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                    <td className="max-w-[220px] py-2.5 pr-2">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{p.district}, {p.state} · {p.sector}</p>
                    </td>
                    <td className="py-2.5 pr-2"><HealthRing score={p.healthScore} size={38} stroke={5} /></td>
                    <td className="w-24 py-2.5 pr-2">
                      <span className="text-xs font-medium tabular-nums">{p.progress}%</span>
                      <ProgressBar value={p.progress} className="mt-1" />
                    </td>
                    <td className="hidden py-2.5 pr-2 text-xs tabular-nums sm:table-cell">
                      <span className="font-medium">{formatLakhs(p.totalBudget, { compact: true })}</span>
                      <span className="block text-[10px] text-muted-foreground">{Math.round((p.spentBudget / p.totalBudget) * 100)}% spent</span>
                    </td>
                    <td className="hidden py-2.5 md:table-cell"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* AI strip */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="overflow-hidden rounded-xl border border-[#bae0fd] bg-gradient-to-r from-[#f0f7ff] via-white to-[#f0f7ff] p-5 dark:border-[#064f85] dark:from-[#064f85]/20 dark:via-transparent dark:to-[#064f85]/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0c93e7]/10 text-[#0c93e7]"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <p className="font-semibold">Assure AI has flagged {flagged.length} projects needing review today</p>
              <p className="text-sm text-muted-foreground">Delay model ran on 18 features across the portfolio · next scoring run in 6h · precision ≥80% on top decile</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {flagged.map((p) => (
              <button key={p.id} onClick={() => askAi(`Why is ${p.name} at risk?`)} className="rounded-full border border-[#bae0fd] bg-white px-3 py-1.5 text-xs font-medium text-[#015ca0] transition-colors hover:bg-[#e0effe] dark:border-[#064f85] dark:bg-transparent dark:text-sky-300 dark:hover:bg-[#064f85]/40">
                Why is {p.name.split(" ").slice(0, 2).join(" ")} at risk?
              </button>
            ))}
            <button onClick={() => navigate("ai-assistant")} className="rounded-full bg-[#0c93e7] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0b426e]">Open AI Assistant <ArrowRight className="ml-1 inline h-3 w-3" /></button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function exportCsv(projects: ReturnType<typeof useAppStore.getState>["projects"]) {
  const header = "PS ID,Project,Sector,State,Status,Health Score,Health Status,Schedule,Budget Dim,Resources,Milestones,Progress,Total Budget (L),Spent (L),Projected (L)\n";
  const rows = projects.map((p) =>
    [p.psId, `"${p.name}"`, p.sector, p.state, p.status, p.healthScore, p.healthStatus, p.scheduleScore, p.budgetScore, p.resourceScore, p.milestoneScore, p.progress, p.totalBudget, p.spentBudget, p.projectedBudget].join(",")
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `projectassure-portfolio-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}
