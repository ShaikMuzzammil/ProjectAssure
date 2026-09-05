"use client";
import React, { useEffect } from "react";
import { useAdminStore } from "@/store/admin-store";
import { cn } from "@/lib/utils";
import { ShieldAlert, Activity, Gavel, IndianRupee, Radio, Users, BrainCircuit, Plug, Globe, ScrollText, Menu, X, RefreshCw } from "lucide-react";
import type { HostViewId } from "@/lib/host/types";
import { toast } from "sonner";

const NAV: { id: HostViewId; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Mission Dashboard", icon: Activity },
  { id: "approvals", label: "Approval Centre", icon: Gavel },
  { id: "budget-risk", label: "Budget Risk", icon: IndianRupee },
  { id: "alerts", label: "Alerts Aggregation", icon: Radio },
  { id: "users", label: "User Management", icon: Users },
  { id: "intelligence", label: "Intelligence Console", icon: BrainCircuit },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "demo", label: "Demo Showcase", icon: Globe },
  { id: "audit", label: "Audit Trail", icon: ScrollText },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentView, setView, lastSyncAt, hydrate } = useAdminStore();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Poll sync every 5 seconds
  useEffect(() => {
    const poll = async () => {
      try { const res = await fetch("/api/admin/sync", { cache: "no-store" }); const json = await res.json(); hydrate(json); } catch {}
    };
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [hydrate]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-40 w-60 border-r border-slate-200 bg-[#072b49] text-white transition-transform md:relative md:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10"><ShieldAlert className="h-5 w-5 text-[#7cc8fb]" /></div>
          <div><div className="text-sm font-bold">ProjectAssure</div><div className="text-[9px] text-white/60">Host Control</div></div>
          <button onClick={() => setMobileOpen(false)} className="ml-auto md:hidden"><X className="h-4 w-4" /></button>
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          {NAV.map(n => (
            <button key={n.id} onClick={() => { setView(n.id); setMobileOpen(false); }}
              className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition", currentView === n.id ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/8 hover:text-white")}>
              <n.icon className="h-4 w-4" />{n.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto p-3 border-t border-white/10">
          <div className="text-[9px] text-white/50">SIH 2026 · SIH26103</div>
          <div className="text-[9px] text-white/50">Team NEXGEN · Amrita Vishwa Vidyapeetham</div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4">
          <button onClick={() => setMobileOpen(true)} className="md:hidden"><Menu className="h-5 w-5" /></button>
          <h1 className="text-sm font-bold text-slate-900">{NAV.find(n => n.id === currentView)?.label ?? "Dashboard"}</h1>
          <div className="ml-auto flex items-center gap-2">
            {lastSyncAt && <span className="text-[10px] text-slate-500">Last sync: {new Date(lastSyncAt).toLocaleTimeString("en-IN")}</span>}
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />LIVE</span>
            <button onClick={async () => { try { const r = await fetch("/api/admin/sync"); hydrate(await r.json()); toast.success("Synced"); } catch {} }} className="rounded-md border p-1.5 hover:bg-slate-50"><RefreshCw className="h-3.5 w-3.5" /></button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4">{children}</main>
      </div>
    </div>
  );
}
