"use client";
import React from "react";
import { useAdminStore } from "@/store/admin-store";
import { ArrowRight, Building2, IndianRupee, Activity, Users, ShieldCheck } from "lucide-react";

export function DemoShowcase() {
  const { snapshot, users } = useAdminStore();
  return (
    <div className="space-y-4">
      {/* Hero banner */}
      <div className="rounded-xl border border-[#072b49] bg-gradient-to-r from-[#072b49] to-[#0b426e] p-6 text-white">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-extrabold">ProjectAssure Host Control</h2>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold">v21 · SIH 2026</span>
        </div>
        <p className="mt-1 text-sm text-white/80">
          One pane of glass for India&apos;s infrastructure portfolio — the intelligence cockpit for the Chief Programme Officer.
          Live user sync, automatic alerts, email integration, budget tracking and a secure project vault.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full bg-white/10 px-3 py-1">Live webhook sync</span>
          <span className="rounded-full bg-white/10 px-3 py-1">Automatic alerts → email</span>
          <span className="rounded-full bg-white/10 px-3 py-1">Per-user budget caps</span>
          <span className="rounded-full bg-white/10 px-3 py-1">Secure project vault</span>
          <span className="rounded-full bg-white/10 px-3 py-1">Tamper-evident audit log</span>
        </div>
      </div>

      {/* Snapshot grid */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users tracked" value={users.length} icon={Users} />
        <StatCard label="Active projects" value={snapshot?.totalProjects ?? 0} icon={Building2} />
        <StatCard label="Sanctioned" value={`₹${((snapshot?.totalSanctionedL ?? 0) / 100).toFixed(0)} Cr`} icon={IndianRupee} />
        <StatCard label="Portfolio health" value={snapshot?.avgHealth.toFixed(0) ?? "—"} icon={Activity} />
      </div>

      {/* Risky project cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {snapshot?.topRisky.slice(0, 4).map((p) => (
          <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#0c93e7]" />
              <span className="font-mono text-[10px] text-slate-500">{p.psId}</span>
            </div>
            <div className="mt-1.5 text-xs font-bold">{p.name}</div>
            <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <IndianRupee className="h-3 w-3" />₹{(p.totalBudgetL / 100).toFixed(0)} Cr
              </span>
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                {p.healthScore}
              </span>
            </div>
            <a
              href="https://project-assure.vercel.app"
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-[#0c93e7] hover:underline"
            >
              Try in main app <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <ShieldCheck className="h-4 w-4 text-[#0c93e7]" /> Try the main prototype
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          The main ProjectAssure prototype is live at one web address. Demo personas, seeded projects, real intelligence + email.
          Sign-ups on the main app appear in this host-control within seconds (via the webhook).
        </p>
        <a
          href="https://project-assure.vercel.app"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#0b426e] to-[#0c93e7] px-5 py-2.5 text-sm font-bold text-white"
        >
          Open main prototype <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ElementType }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e0effe]">
          <Icon className="h-4 w-4 text-[#0c93e7]" />
        </div>
        <span className="text-[10px] font-bold uppercase text-slate-500">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-extrabold tabular text-slate-900">{value}</div>
    </div>
  );
}
