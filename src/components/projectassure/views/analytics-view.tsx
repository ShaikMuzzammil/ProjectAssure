"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Download, FileSpreadsheet } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, Scatter,
  ScatterChart, Tooltip, XAxis, YAxis, ZAxis, ResponsiveContainer,
} from "recharts";
import { useAppStore } from "@/store/app-store";
import { DEPARTMENTS } from "@/lib/projectassure/engine";
import { formatLakhs, monthLabel } from "@/lib/projectassure/format";
import { HealthBadge, SectionTitle } from "../shared/ui-bits";
import { SECTOR_COLORS } from "../shared/colors";
import { toast } from "sonner";

const TABS = ["Portfolio", "Budget", "Trends", "Exports"] as const;

export function AnalyticsView() {
  const projects = useAppStore((s) => s.projects);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Portfolio");

  /* dept bars */
  const deptData = useMemo(() => DEPARTMENTS.map((d) => {
    const set = projects.filter((p) => p.departmentId === d.id);
    return {
      dept: d.code,
      projects: set.length,
      budget: set.reduce((s, p) => s + p.totalBudget, 0),
      spent: set.reduce((s, p) => s + p.spentBudget, 0),
      avgHealth: set.length ? Math.round(set.reduce((s, p) => s + p.healthScore, 0) / set.length) : 0,
    };
  }), [projects]);

  /* scatter: budget util vs health */
  const scatter = useMemo(() => projects.filter((p) => p.status === "ACTIVE").map((p) => ({
    x: Math.round((p.spentBudget / p.totalBudget) * 100),
    y: p.healthScore,
    z: p.totalBudget,
    name: p.name,
    sector: p.sector,
  })), [projects]);

  /* trends: cumulative portfolio burn by month */
  const trendData = useMemo(() => {
    const map = new Map<string, { planned: number; actual: number }>();
    projects.forEach((p) => p.budgetRecords.forEach((r) => {
      const key = monthLabel(r.month, r.year);
      const cur = map.get(key) ?? { planned: 0, actual: 0 };
      cur.planned += r.planned; cur.actual += r.spent;
      map.set(key, cur);
    }));
    let cp = 0, ca = 0;
    return [...map.entries()].map(([month, v]) => {
      cp += v.planned; ca += v.actual;
      return { month, planned: Math.round(cp), actual: Math.round(ca) };
    });
  }, [projects]);

  const overruns = useMemo(() => projects
    .filter((p) => p.projectedBudget > p.totalBudget * 1.05)
    .sort((a, b) => (b.projectedBudget - b.totalBudget) / b.totalBudget - (a.projectedBudget - a.totalBudget) / a.totalBudget)
    .map((p) => ({ ...p, overrunPct: Math.round(((p.projectedBudget - p.totalBudget) / p.totalBudget) * 1000) / 10 })), [projects]);

  const bottom10 = useMemo(() => [...projects].sort((a, b) => a.healthScore - b.healthScore).slice(0, 10), [projects]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics Domain</h1>
          <p className="text-sm text-muted-foreground">In production this runs on <span className="font-mono text-xs">analytics.projectassure.vercel.app</span> — same SSO, same data plane</p>
        </div>
        <button onClick={() => { toast.success("Analytics snapshot exported"); }} className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium transition-colors hover:bg-muted">
          <Download className="h-4 w-4" /> Export PDF/Excel
        </button>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium transition-colors ${tab === t ? "border-b-2 border-[#0c93e7] text-[#0c93e7]" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "Portfolio" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Department portfolio" sub="Project count & sanctioned outlay">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={deptData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dept" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v: number) => `${Math.round(v / 100)}Cr`} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number, k: string) => (k === "budget" ? [formatLakhs(v, { compact: true }), "Sanctioned"] : [v, k])} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="l" dataKey="projects" fill="#0c93e7" radius={[4, 4, 0, 0]} name="Projects" barSize={22} />
                <Bar yAxisId="r" dataKey="budget" fill="#0b426e" radius={[4, 4, 0, 0]} name="Budget (L)" barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Budget utilisation vs health" sub="Bubble size = sanctioned outlay · active projects">
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" dataKey="x" name="Budget utilised %" unit="%" tick={{ fontSize: 10, fill: "#64748b" }} domain={[0, 100]} />
                <YAxis type="number" dataKey="y" name="Health" domain={[0, 100]} tick={{ fontSize: 10, fill: "#64748b" }} />
                <ZAxis type="number" dataKey="z" range={[30, 320]} />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-border bg-card p-2.5 text-xs shadow-lg">
                        <p className="font-semibold">{d.name}</p>
                        <p className="text-muted-foreground">{d.sector} · utilised {d.x}% · health {d.y}</p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="5 4" />
                <ReferenceLine y={75} stroke="#22c55e" strokeDasharray="5 4" />
                <Scatter data={scatter}>
                  {scatter.map((d, i) => <Cell key={i} fill={SECTOR_COLORS[d.sector] ?? "#0c93e7"} fillOpacity={0.65} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Bottom 10 by health" sub="Review queue for the weekly meeting" className="xl:col-span-2">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 font-medium">#</th><th className="pb-2 font-medium">Project</th><th className="pb-2 font-medium">Sector</th><th className="pb-2 font-medium">State</th><th className="pb-2 font-medium">Health</th><th className="pb-2 font-medium">Progress</th><th className="pb-2 font-medium">Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {bottom10.map((p, i) => (
                    <tr key={p.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="max-w-[240px] truncate py-2 font-medium">{p.name}</td>
                      <td className="py-2 text-xs">{p.sector}</td>
                      <td className="py-2 text-xs">{p.state}</td>
                      <td className="py-2"><HealthBadge status={p.healthStatus} score={p.healthScore} /></td>
                      <td className="py-2 text-xs tabular-nums">{p.progress}%</td>
                      <td className="py-2 text-xs tabular-nums">{formatLakhs(p.totalBudget, { compact: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>
      )}

      {tab === "Budget" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Allocation vs utilisation" sub="By department (₹ lakh)">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={deptData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v: number) => `${Math.round(v / 100)}Cr`} />
                <YAxis type="category" dataKey="dept" width={70} tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number, k: string) => [formatLakhs(v, { compact: true }), k === "budget" ? "Allocation" : "Utilised"]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="budget" fill="#0b426e" radius={[0, 4, 4, 0]} barSize={14} />
                <Bar dataKey="spent" fill="#0c93e7" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Overrun watchlist" sub="Prophet-style projected overrun % (>5% shown)" >
            <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
              {overruns.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.state} · {formatLakhs(p.totalBudget, { compact: true })} sanctioned</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${p.overrunPct > 20 ? "bg-[#fee2e2] text-[#b91c1c]" : p.overrunPct > 10 ? "bg-[#ffedd5] text-[#c2410c]" : "bg-[#fef3c7] text-[#b45309]"}`}>
                    +{p.overrunPct}%
                  </span>
                </div>
              ))}
              {overruns.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No projected overruns — portfolio within tolerance.</p>}
            </div>
          </ChartCard>
        </div>
      )}

      {tab === "Trends" && (
        <ChartCard title="Portfolio burn: planned vs actual (cumulative)" sub="12-month rolling health index in production · here: burn trend from 540 budget records">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} interval={Math.max(0, Math.floor(trendData.length / 12))} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v: number) => `${Math.round(v / 100)}Cr`} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number, k: string) => [formatLakhs(v, { compact: true }), k === "planned" ? "Planned (cum)" : "Actual (cum)"]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="planned" stroke="#0b426e" strokeWidth={2.5} dot={false} name="Planned (cum)" />
              <Line type="monotone" dataKey="actual" stroke="#22c55e" strokeWidth={2.5} dot={false} name="Actual (cum)" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {tab === "Exports" && (
        <div className="grid gap-4 md:grid-cols-2">
          <ChartCard title="Report builder" sub="One-click formatted exports for review meetings">
            <div className="space-y-3">
              {[
                { t: "Weekly Portfolio Summary", d: "Health deltas, new alerts, top-10 movers" },
                { t: "Executive Status Report", d: "Full portfolio · print-ready A4 · parliamentary format" },
                { t: "Risk Deep-Dive Pack", d: "Flagged projects with factor waterfalls & CI bands" },
              ].map((r) => (
                <div key={r.t} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div><p className="text-sm font-semibold">{r.t}</p><p className="text-xs text-muted-foreground">{r.d}</p></div>
                  <button onClick={() => toast.success(`${r.t} generated (demo)`)} className="shrink-0 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted">Generate</button>
                </div>
              ))}
            </div>
          </ChartCard>
          <ChartCard title="Export history" sub="Every export is audit-logged">
            <div className="space-y-2 text-xs">
              {projects.slice(0, 5).flatMap((p) => p.auditTrail).filter((e) => e.action === "EXPORT").slice(0, 6).map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                  <span className="flex items-center gap-2"><FileSpreadsheet className="h-3.5 w-3.5 text-[#16a34a]" />{e.details}</span>
                  <span className="text-muted-foreground">{e.userName}</span>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`rounded-lg border border-border bg-card p-5 shadow-sm ${className}`}>
      <SectionTitle title={title} sub={sub} />
      <div className="mt-4">{children}</div>
    </motion.div>
  );
}
