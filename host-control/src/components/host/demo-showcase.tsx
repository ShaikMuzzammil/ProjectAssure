"use client";
import React from "react";
import { useAdminStore } from "@/store/admin-store";
import { ArrowRight, Building2, IndianRupee, Activity, Users } from "lucide-react";

export function DemoShowcase() {
  const { snapshot } = useAdminStore();
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#072b49] bg-gradient-to-r from-[#072b49] to-[#0b426e] p-6 text-white">
        <h2 className="text-xl font-extrabold">ProjectAssure Control Plane</h2>
        <p className="mt-1 text-sm text-white/80">One pane of glass for India&apos;s infrastructure portfolio — the intelligence cockpit for the Chief Programme Officer.</p>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
          <span className="rounded-full bg-white/10 px-3 py-1">1,800+ projects tracked</span>
          <span className="rounded-full bg-white/10 px-3 py-1">18 risk signals</span>
          <span className="rounded-full bg-white/10 px-3 py-1">&lt;60s report → dashboard</span>
          <span className="rounded-full bg-white/10 px-3 py-1">30-60 day early warnings</span>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {snapshot?.topRisky.slice(0, 4).map(p => (
          <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-[#0c93e7]" /><span className="font-mono text-[10px] text-slate-500">{p.psId}</span></div>
            <div className="mt-1.5 text-xs font-bold">{p.name}</div>
            <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500"><span className="flex items-center gap-1"><IndianRupee className="h-3 w-3" />₹{(p.totalBudgetL / 100).toFixed(0)} Cr</span><span className="flex items-center gap-1"><Activity className="h-3 w-3" />{p.healthScore}</span></div>
            <a href="https://project-assure.vercel.app" target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-[#0c93e7] hover:underline">Try in main app <ArrowRight className="h-3 w-3" /></a>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Users className="h-4 w-4 text-[#0c93e7]" />Try the main prototype</h3>
        <p className="mt-1 text-xs text-slate-500">The main ProjectAssure prototype is live at one web address. 4 demo personas, 30 seeded projects, real intelligence + email. Sign in as &quot;overseer&quot; to explore.</p>
        <a href="https://project-assure.vercel.app" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#0b426e] to-[#0c93e7] px-5 py-2.5 text-sm font-bold text-white">Open main prototype <ArrowRight className="h-4 w-4" /></a>
      </div>
    </div>
  );
}
