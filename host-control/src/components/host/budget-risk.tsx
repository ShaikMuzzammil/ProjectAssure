"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet, TrendingDown, AlertOctagon, Settings2, Save,
  BarChart3, ArrowDownRight, ArrowUpRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, LineChart, Line, Legend, Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAdminStore } from "@/store/admin-store";
import { fmtINR, deptCode, deptName, cn } from "@/lib/utils";
import { buildDeptBudgetRows, BUDGET_FORECAST } from "@/lib/host/seed";
import type { BudgetThresholds } from "@/lib/host/types";

export function BudgetRisk() {
  const { projects, thresholds, snapshot, setThresholds, hydrate } = useAdminStore();
  const [draftT, setDraftT] = useState<BudgetThresholds>(thresholds);

  const deptRows = useMemo(() => buildDeptBudgetRows(projects), [projects]);

  const utilisation = snapshot ? (snapshot.totalSpentL / snapshot.totalSanctionedL) * 100 : 0;
  const projectedUtil = snapshot ? (snapshot.totalProjectedL / snapshot.totalSanctionedL) * 100 : 0;
  const variance = snapshot?.portfolioVariancePct ?? 0;

  // Histogram of variance buckets
  const buckets = useMemo(() => {
    const ranges = [
      { label: "≤ -10%", min: -Infinity, max: -10, color: "#0c93e7" },
      { label: "-10% to -5%", min: -10, max: -5, color: "#36adf6" },
      { label: "±5%", min: -5, max: 5, color: "#22c55e" },
      { label: "+5% to +10%", min: 5, max: 10, color: "#fbbf24" },
      { label: "+10% to +25%", min: 10, max: 25, color: "#f59e0b" },
      { label: "> +25%", min: 25, max: Infinity, color: "#ef4444" },
    ];
    return ranges.map(r => ({
      range: r.label,
      count: projects.filter(p => p.variancePct >= r.min && p.variancePct < r.max).length,
      color: r.color,
    }));
  }, [projects]);

  const save = async () => {
    setThresholds(draftT);
    toast.success("Thresholds updated", {
      description: `AMBER ${draftT.amberPct}% · RED ${draftT.redPct}% · WARN ${draftT.warnPct}%`,
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Budget Risk Management</h2>
        <p className="text-sm text-muted-foreground">
          Org-wide budget utilisation, variance distribution, top 5 overruns and configurable thresholds.
        </p>
      </div>

      {/* ─── Headline tiles ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-5 space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Wallet className="size-3" /> Sanctioned
            </div>
            <div className="text-xl font-semibold tabular">{fmtINR(snapshot?.totalSanctionedL ?? 0, { unit: "crore" })}</div>
            <div className="text-[11px] text-muted-foreground">{projects.length} projects · 5 departments</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <BarChart3 className="size-3" /> Spent so far
            </div>
            <div className="text-xl font-semibold tabular">{fmtINR(snapshot?.totalSpentL ?? 0, { unit: "crore" })}</div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              {utilisation.toFixed(1)}% burn
              <span className={cn("inline-flex items-center", utilisation > 60 ? "text-amber-600" : "text-emerald-600")}>
                {utilisation > 60 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <TrendingDown className="size-3" /> Projected outturn
            </div>
            <div className="text-xl font-semibold tabular">{fmtINR(snapshot?.totalProjectedL ?? 0, { unit: "crore" })}</div>
            <div className="text-[11px] text-muted-foreground">{projectedUtil.toFixed(1)}% of sanctioned · at current burn</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <AlertOctagon className="size-3" /> Portfolio variance
            </div>
            <div className={cn("text-xl font-semibold tabular", variance > 5 ? "text-rose-600" : variance > 0 ? "text-amber-600" : "text-emerald-600")}>
              {variance >= 0 ? "+" : ""}{variance.toFixed(2)}%
            </div>
            <div className="text-[11px] text-muted-foreground">vs proportional spend at this stage</div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Charts row ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Utilisation gauge */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Org-wide Utilisation Gauge</CardTitle>
            <CardDescription>Spent against sanctioned — coloured by threshold</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-4xl font-bold tabular">{utilisation.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">of sanctioned spent</div>
              </div>
              <div className="text-right space-y-0.5">
                <div className="text-xs text-muted-foreground">Thresholds (AMBER {thresholds.amberPct}% · RED {thresholds.redPct}%)</div>
                <Badge variant="outline" className={cn(
                  utilisation > thresholds.redPct ? "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-500/15 dark:text-rose-300" :
                  utilisation > thresholds.amberPct ? "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-300" :
                  "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300"
                )}>
                  {utilisation > thresholds.redPct ? "RED · over budget" :
                   utilisation > thresholds.amberPct ? "AMBER · watch" :
                   "GREEN · within budget"}
                </Badge>
              </div>
            </div>
            <div className="mt-4 relative h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn("absolute inset-y-0 left-0 transition-all", utilisation > thresholds.redPct ? "bg-rose-500" : utilisation > thresholds.amberPct ? "bg-amber-500" : "bg-emerald-500")}
                style={{ width: `${Math.min(100, utilisation)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
              <span>0%</span>
              <span>WARN {thresholds.warnPct}%</span>
              <span>AMBER {thresholds.amberPct}%</span>
              <span>RED {thresholds.redPct}%</span>
              <span>100%</span>
            </div>
          </CardContent>
        </Card>

        {/* Variance histogram */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Variance Histogram</CardTitle>
            <CardDescription>Distribution of project variance vs proportional spend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="range" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <RTooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {buckets.map((b, i) => <Cell key={i} fill={b.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Forecast chart + Threshold config ──────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Forecast vs Actual — Monthly Burn (₹ Lakh)</CardTitle>
            <CardDescription>Org-wide monthly spend + projection through Dec 2026</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={BUDGET_FORECAST} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <RTooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => fmtINR(Number(v))}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="actual" name="Actual" stroke="#0c93e7" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="size-4" /> Threshold Config
            </CardTitle>
            <CardDescription>Editable % thresholds for variance alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="amber" className="text-xs flex items-center justify-between">
                <span>AMBER threshold</span>
                <span className="text-amber-700">{draftT.amberPct}%</span>
              </Label>
              <Input id="amber" type="number" min={0} max={100} value={draftT.amberPct} onChange={(e) => setDraftT(s => ({ ...s, amberPct: parseFloat(e.target.value || "0") }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="red" className="text-xs flex items-center justify-between">
                <span>RED threshold</span>
                <span className="text-rose-700">{draftT.redPct}%</span>
              </Label>
              <Input id="red" type="number" min={0} max={100} value={draftT.redPct} onChange={(e) => setDraftT(s => ({ ...s, redPct: parseFloat(e.target.value || "0") }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="warn" className="text-xs flex items-center justify-between">
                <span>WARN threshold (advisory)</span>
                <span className="text-brand-700">{draftT.warnPct}%</span>
              </Label>
              <Input id="warn" type="number" min={0} max={100} value={draftT.warnPct} onChange={(e) => setDraftT(s => ({ ...s, warnPct: parseFloat(e.target.value || "0") }))} />
            </div>
            <Separator />
            <Button onClick={save} className="w-full gap-1.5">
              <Save className="size-4" /> Save thresholds
            </Button>
            <div className="text-[10px] text-muted-foreground">
              Changes apply immediately to all budget-variance alerts across the portfolio.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Top 5 worst overruns ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 5 Worst Budget Overruns</CardTitle>
          <CardDescription>Sorted by variance vs proportional spend</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {snapshot?.topOverruns.map((p, i) => {
            const over = p.variancePct > thresholds.redPct;
            const amber = p.variancePct > thresholds.amberPct && !over;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <span>{p.projectManager}</span><span>·</span><span>{deptCode(p.departmentId)}</span>
                  </div>
                </div>
                <div className="hidden sm:block text-right text-xs">
                  <div className="tabular font-semibold">{fmtINR(p.totalBudgetL, { unit: "crore" })}</div>
                  <div className="text-muted-foreground">sanctioned</div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className={cn(
                    over ? "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-500/15 dark:text-rose-300" :
                    amber ? "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-300" :
                    "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300"
                  )}>
                    {p.variancePct >= 0 ? "+" : ""}{p.variancePct.toFixed(1)}%
                  </Badge>
                  <div className="text-[10px] text-muted-foreground tabular mt-1">{fmtINR(p.spentBudgetL, { unit: "lakh" })} spent</div>
                </div>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>

      {/* ─── Per-department table ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-Department Breakdown</CardTitle>
          <CardDescription>Sanctioned, spent, projected and variance by department</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Department</th>
                  <th className="py-2 px-3 font-medium text-right tabular">Sanctioned</th>
                  <th className="py-2 px-3 font-medium text-right tabular">Spent</th>
                  <th className="py-2 px-3 font-medium text-right tabular">Projected</th>
                  <th className="py-2 px-3 font-medium text-center">Projects</th>
                  <th className="py-2 px-3 font-medium text-center">Critical</th>
                  <th className="py-2 pl-3 font-medium text-right tabular">Variance</th>
                </tr>
              </thead>
              <tbody>
                {deptRows.map(r => (
                  <tr key={r.deptId} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium">{deptCode(r.deptId)}</div>
                      <div className="text-[10px] text-muted-foreground">{deptName(r.deptId).split(" & ")[0]}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular">{fmtINR(r.sanctionedL, { unit: "crore" })}</td>
                    <td className="py-2.5 px-3 text-right tabular">{fmtINR(r.spentL, { unit: "crore" })}</td>
                    <td className="py-2.5 px-3 text-right tabular text-muted-foreground">{fmtINR(r.projectedL, { unit: "crore" })}</td>
                    <td className="py-2.5 px-3 text-center tabular">{r.projects}</td>
                    <td className="py-2.5 px-3 text-center">
                      {r.critical > 0 ? <Badge variant="outline" className="border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-500/15 dark:text-rose-300 text-[10px]">{r.critical}</Badge> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <span className={cn(
                        "tabular font-medium",
                        r.variancePct > thresholds.redPct ? "text-rose-600" :
                        r.variancePct > thresholds.amberPct ? "text-amber-600" :
                        "text-emerald-600"
                      )}>
                        {r.variancePct >= 0 ? "+" : ""}{r.variancePct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
