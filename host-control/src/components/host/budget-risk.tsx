"use client";
import React from "react";
import { useAdminStore } from "@/store/admin-store";
import { cn } from "@/lib/utils";
import { TrendingUp, AlertTriangle } from "lucide-react";

export function BudgetRisk() {
  const { snapshot, projects } = useAdminStore();
  if (!snapshot) return <div className="py-20 text-center text-sm text-slate-400">Loading budget data…</div>;
  const stats = [
    { label: "Sanctioned", value: `₹${(snapshot.totalSanctionedL / 100).toFixed(0)} Cr`, tone: "text-slate-900" },
    { label: "Spent so far", value: `₹${(snapshot.totalSpentL / 100).toFixed(0)} Cr`, tone: "text-[#0c93e7]", sub: `${(snapshot.totalSpentL / snapshot.totalSanctionedL * 100).toFixed(1)}% utilised` },
    { label: "Projected outturn", value: `₹${(snapshot.totalProjectedL / 100).toFixed(0)} Cr`, tone: snapshot.portfolioVariancePct > 0 ? "text-rose-600" : "text-emerald-600", sub: `${snapshot.portfolioVariancePct > 0 ? "+" : ""}${snapshot.portfolioVariancePct.toFixed(1)}% variance` },
    { label: "Over budget", value: projects.filter(p => p.variancePct > 10).length, tone: "text-rose-600", sub: "projects > 10% warn" },
  ];
  return (
    <div className="space-y-4">
      <div><h2 className="text-lg font-bold">Budget Risk Management</h2><p className="text-xs text-slate-500">Organisation-wide budget utilisation, variance and top overruns.</p></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[10px] font-bold uppercase text-slate-500">{s.label}</div>
            <div className={cn("mt-1 text-xl font-extrabold tabular", s.tone)}>{s.value}</div>
            {s.sub && <div className="mt-0.5 text-[10px] text-slate-500">{s.sub}</div>}
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold"><TrendingUp className="h-4 w-4 text-[#0c93e7]" />Top 5 Budget Overruns</h3>
        <div className="mt-3 space-y-2">
          {snapshot.topOverruns.map(p => (
            <div key={p.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0"><div className="truncate text-xs font-bold">{p.name}</div><div className="font-mono text-[9px] text-slate-500">{p.psId} · sanctioned ₹{(p.totalBudgetL / 100).toFixed(0)} Cr → projected ₹{(p.projectedBudgetL / 100).toFixed(0)} Cr</div></div>
                <div className={cn("text-base font-bold tabular", p.variancePct > 20 ? "text-rose-600" : p.variancePct > 10 ? "text-amber-600" : "text-emerald-600")}>{p.variancePct > 0 ? "+" : ""}{p.variancePct.toFixed(1)}%</div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={cn("h-full rounded-full", p.variancePct > 20 ? "bg-rose-500" : p.variancePct > 10 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${Math.min(Math.abs(p.variancePct), 100)}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
