"use client";
import React from "react";
import { useAdminStore } from "@/store/admin-store";
import { cn } from "@/lib/utils";
import { FlaskConical, IndianRupee, ShieldAlert, Gavel, Activity } from "lucide-react";
import { relTime } from "@/lib/host/format";

export function MissionDashboard() {
  const { snapshot, projects, audit } = useAdminStore();
  if (!snapshot) return <div className="py-20 text-center text-sm text-slate-400">Loading portfolio…</div>;
  const kpis = [
    { label: "Total Projects", value: snapshot.totalProjects, icon: FlaskConical, tone: "text-[#0c93e7]" },
    { label: "Total Sanctioned", value: `₹${(snapshot.totalSanctionedL / 100).toFixed(0)} Cr`, icon: IndianRupee, tone: "text-emerald-600" },
    { label: "Open Alerts", value: snapshot.openAlerts, icon: ShieldAlert, tone: "text-rose-600" },
    { label: "Pending Approvals", value: snapshot.pendingApprovals, icon: Gavel, tone: "text-amber-600" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <k.icon className={cn("h-5 w-5", k.tone)} />
            <div className={cn("mt-2 text-2xl font-extrabold tabular", k.tone)}>{k.value}</div>
            <div className="mt-1 text-[11px] text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Activity className="h-4 w-4 text-[#0c93e7]" />Portfolio Health & Top 5 At-Risk</h3>
          <div className="mt-3 flex gap-2">
            <div className="flex-1 rounded-lg border border-emerald-500/30 bg-emerald-50 p-3 text-center"><div className="text-xl font-bold text-emerald-600">{snapshot.healthBand.healthy}</div><div className="text-[9px] font-bold text-emerald-700">GREEN ≥75</div></div>
            <div className="flex-1 rounded-lg border border-amber-500/30 bg-amber-50 p-3 text-center"><div className="text-xl font-bold text-amber-600">{snapshot.healthBand.atRisk}</div><div className="text-[9px] font-bold text-amber-700">AMBER 50-74</div></div>
            <div className="flex-1 rounded-lg border border-rose-500/30 bg-rose-50 p-3 text-center"><div className="text-xl font-bold text-rose-600">{snapshot.healthBand.critical}</div><div className="text-[9px] font-bold text-rose-700">RED &lt;50</div></div>
          </div>
          <div className="mt-4 space-y-1.5">
            {snapshot.topRisky.map(p => (
              <div key={p.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className={cn("h-2 w-2 rounded-full", p.healthStatus === "CRITICAL" ? "bg-rose-500" : p.healthStatus === "AT_RISK" ? "bg-amber-500" : "bg-emerald-500")} />
                <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-bold">{p.name}</div><div className="font-mono text-[9px] text-slate-500">{p.psId}</div></div>
                <div className="text-sm font-bold tabular">{p.healthScore}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Activity className="h-4 w-4 text-[#0c93e7]" />Live Activity Feed</h3>
          <div className="mt-3 max-h-[300px] space-y-1.5 overflow-y-auto">
            {audit.slice(0, 8).map(ev => (
              <div key={ev.id} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#0c93e7]/10 text-[9px] font-bold text-[#015ca0]">{ev.action[0]}</div>
                <div className="min-w-0 flex-1"><div className="truncate text-[10px] font-semibold">{ev.action}</div><div className="truncate text-[9px] text-slate-500">{ev.entityType} · {relTime(ev.at)}</div></div>
              </div>
            ))}
            {audit.length === 0 && <div className="py-8 text-center text-[11px] text-slate-400">No events yet</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
