"use client";
import React, { useState } from "react";
import { useAdminStore } from "@/store/admin-store";
import { cn } from "@/lib/utils";
import { TrendingUp, IndianRupee, AlertTriangle, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { relTime } from "@/lib/host/format";

export function BudgetRisk() {
  const { snapshot, projects, users } = useAdminStore();
  const [budgetTarget, setBudgetTarget] = useState<{ id: string; name: string } | null>(null);
  const [budgetValue, setBudgetValue] = useState("");

  if (!snapshot) return <div className="py-20 text-center text-sm text-slate-400">Loading budget data…</div>;

  const usersWithBudget = users.filter((u) => u.totalBudgetL > 0);

  const stats = [
    {
      label: "Sanctioned",
      value: `₹${(snapshot.totalSanctionedL / 100).toFixed(0)} Cr`,
      tone: "text-slate-900",
    },
    {
      label: "Spent so far",
      value: `₹${(snapshot.totalSpentL / 100).toFixed(0)} Cr`,
      tone: "text-[#0c93e7]",
      sub: `${((snapshot.totalSpentL / snapshot.totalSanctionedL) * 100).toFixed(1)}% utilised`,
    },
    {
      label: "Projected outturn",
      value: `₹${(snapshot.totalProjectedL / 100).toFixed(0)} Cr`,
      tone: snapshot.portfolioVariancePct > 0 ? "text-rose-600" : "text-emerald-600",
      sub: `${snapshot.portfolioVariancePct > 0 ? "+" : ""}${snapshot.portfolioVariancePct.toFixed(1)}% variance`,
    },
    {
      label: "Over budget",
      value: projects.filter((p) => p.variancePct > 10).length,
      tone: "text-rose-600",
      sub: "projects > 10% warn",
    },
  ];

  // Chart data — per project variance
  const chartData = projects
    .map((p) => ({
      name: p.psId,
      variance: Number(p.variancePct.toFixed(1)),
      sanctioned: Number((p.totalBudgetL / 100).toFixed(0)),
    }))
    .sort((a, b) => b.variance - a.variance);

  const submitBudget = async () => {
    if (!budgetTarget) return;
    const n = Number(budgetValue);
    if (!Number.isFinite(n) || n < 0) return toast.error("Enter a non-negative number");
    await fetch("/api/admin/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: budgetTarget.id, limitL: n, by: "CPO" }),
    });
    toast.success(`Budget cap set for ${budgetTarget.name}`);
    setBudgetTarget(null);
    setBudgetValue("");
    const r = await fetch("/api/admin/sync");
    useAdminStore.getState().hydrate(await r.json());
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Budget Risk Management</h2>
        <p className="text-xs text-slate-500">
          Organisation-wide budget utilisation, variance and top overruns. Set per-user caps to prevent runaway spending.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[10px] font-bold uppercase text-slate-500">{s.label}</div>
            <div className={cn("mt-1 text-xl font-extrabold tabular", s.tone)}>{s.value}</div>
            {s.sub && <div className="mt-0.5 text-[10px] text-slate-500">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Per-user utilisation */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <IndianRupee className="h-4 w-4 text-[#0c93e7]" /> Per-user budget utilisation
        </h3>
        <p className="mt-0.5 text-[10px] text-slate-500">Click "Set cap" to enforce a per-user budget limit (in ₹ lakh).</p>
        <div className="mt-3 space-y-2">
          {usersWithBudget.length === 0 && (
            <div className="py-6 text-center text-[11px] text-slate-400">No users own projects yet</div>
          )}
          {usersWithBudget.map((u) => (
            <div key={u.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold">{u.name}</div>
                  <div className="text-[9px] text-slate-500">
                    ₹{(u.totalBudgetL / 100).toFixed(0)} Cr total · cap {u.budgetLimitL ? `₹${u.budgetLimitL} L` : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-bold tabular",
                      u.budgetUtilisedPct > 80 ? "text-rose-600" : u.budgetUtilisedPct > 60 ? "text-amber-600" : "text-emerald-600",
                    )}
                  >
                    {u.budgetUtilisedPct}%
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setBudgetTarget({ id: u.id, name: u.name });
                      setBudgetValue(u.budgetLimitL ? String(u.budgetLimitL) : "");
                    }}
                  >
                    <Settings2 className="h-3.5 w-3.5" /> Set cap
                  </Button>
                </div>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={cn(
                    "h-full rounded-full",
                    u.budgetUtilisedPct > 80 ? "bg-rose-500" : u.budgetUtilisedPct > 60 ? "bg-amber-500" : "bg-emerald-500",
                  )}
                  style={{ width: `${Math.min(u.budgetUtilisedPct, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Variance chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <TrendingUp className="h-4 w-4 text-[#0c93e7]" /> Portfolio variance by project
        </h3>
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 10 }} unit="%" />
              <RTooltip
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
                formatter={(v: number) => [`${v}%`, "Variance"]}
              />
              <Bar dataKey="variance" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.variance > 20 ? "#f43f5e" : d.variance > 10 ? "#f59e0b" : "#10b981"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top overruns */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <AlertTriangle className="h-4 w-4 text-rose-500" /> Top 5 Budget Overruns
        </h3>
        <div className="mt-3 space-y-2">
          {snapshot.topOverruns.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold">{p.name}</div>
                  <div className="font-mono text-[9px] text-slate-500">
                    {p.psId} · sanctioned ₹{(p.totalBudgetL / 100).toFixed(0)} Cr → projected ₹{(p.projectedBudgetL / 100).toFixed(0)} Cr
                  </div>
                  {p.lastAuditAt && (
                    <div className="text-[9px] text-slate-400">last audited {relTime(p.lastAuditAt)}</div>
                  )}
                </div>
                <div
                  className={cn(
                    "text-base font-bold tabular",
                    p.variancePct > 20 ? "text-rose-600" : p.variancePct > 10 ? "text-amber-600" : "text-emerald-600",
                  )}
                >
                  {p.variancePct > 0 ? "+" : ""}
                  {p.variancePct.toFixed(1)}%
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={cn(
                    "h-full rounded-full",
                    p.variancePct > 20 ? "bg-rose-500" : p.variancePct > 10 ? "bg-amber-500" : "bg-emerald-500",
                  )}
                  style={{ width: `${Math.min(Math.abs(p.variancePct), 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!budgetTarget} onOpenChange={(o) => !o && setBudgetTarget(null)}>
        <DialogHeader>
          <DialogTitle>Set budget cap for {budgetTarget?.name}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-slate-500">
          Enter the cap in ₹ lakh. The user will see a warning when their projects cross this cap.
        </p>
        <div className="mt-3">
          <Input
            type="number"
            placeholder="e.g. 1500 (for ₹15 Cr)"
            value={budgetValue}
            onChange={(e) => setBudgetValue(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setBudgetTarget(null)}>
            Cancel
          </Button>
          <Button onClick={submitBudget} disabled={!budgetValue.trim()}>
            Save cap
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
