"use client";
import React, { useEffect } from "react";
import { useAdminStore } from "@/store/admin-store";
import { cn } from "@/lib/utils";
import {
  ShieldAlert,
  Activity,
  Gavel,
  IndianRupee,
  Radio,
  Users,
  BrainCircuit,
  Plug,
  Globe,
  ScrollText,
  Menu,
  X,
  RefreshCw,
  Mail,
  Vault,
} from "lucide-react";
import type { HostViewId } from "@/lib/host/types";
import { toast } from "sonner";
import { motion } from "framer-motion";

// v21: 11 nav items — adds Email Centre, Project Vault, Security & Audit
const NAV: { id: HostViewId; label: string; icon: React.ElementType; group?: string }[] = [
  { id: "dashboard", label: "Mission Dashboard", icon: Activity, group: "Overview" },
  { id: "users", label: "User Management", icon: Users, group: "Overview" },
  { id: "approvals", label: "Approval Centre", icon: Gavel, group: "Operations" },
  { id: "budget-risk", label: "Budget Risk", icon: IndianRupee, group: "Operations" },
  { id: "alerts", label: "Alerts Aggregation", icon: Radio, group: "Operations" },
  { id: "email-centre", label: "Email Centre", icon: Mail, group: "Operations" },
  { id: "project-vault", label: "Project Vault", icon: Vault, group: "Security" },
  { id: "security-audit", label: "Security & Audit", icon: ScrollText, group: "Security" },
  { id: "intelligence", label: "Intelligence Console", icon: BrainCircuit, group: "Intelligence" },
  { id: "integrations", label: "Integrations", icon: Plug, group: "System" },
  { id: "demo", label: "Demo Showcase", icon: Globe, group: "System" },
];

const GROUPS = ["Overview", "Operations", "Security", "Intelligence", "System"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentView, setView, lastSyncAt, hydrate, forceSync, users, alerts } = useAdminStore();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);

  // Poll sync every 5 seconds (v17 behaviour preserved)
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/admin/sync", { cache: "no-store" });
        const json = await res.json();
        hydrate(json);
      } catch {
        /* swallow — best-effort poll */
      }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [hydrate]);

  const doForceSync = async () => {
    setSyncing(true);
    try {
      await forceSync();
      toast.success("Force sync complete", {
        description: `${users.length} users · ${alerts.length} alerts in view`,
      });
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const openAlerts = alerts.filter((a) => !a.isRead).length;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/10 bg-[#072b49] text-white transition-transform md:relative md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#0c93e7] to-[#7cc8fb]">
            <ShieldAlert className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold leading-tight">ProjectAssure</div>
            <div className="text-[9px] uppercase tracking-wider text-white/60">Host Control · v21</div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="ml-auto rounded-md p-1 hover:bg-white/10 md:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {GROUPS.map((group) => {
            const items = NAV.filter((n) => n.group === group);
            if (!items.length) return null;
            return (
              <div key={group} className="mb-3">
                <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-white/40">{group}</div>
                {items.map((n) => {
                  const active = currentView === n.id;
                  return (
                    <button
                      key={n.id}
                      onClick={() => {
                        setView(n.id);
                        setMobileOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition",
                        active ? "bg-white/15 text-white shadow-inner" : "text-white/70 hover:bg-white/8 hover:text-white",
                      )}
                    >
                      <n.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{n.label}</span>
                      {n.id === "alerts" && openAlerts > 0 && (
                        <span className="ml-auto rounded-full bg-rose-500 px-1.5 text-[9px] font-bold text-white">{openAlerts}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="text-[9px] text-white/50">SIH 2026 · SIH26103</div>
          <div className="text-[9px] text-white/50">Team NEXGEN · Amrita Vishwa Vidyapeetham</div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
          <button onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 hover:bg-slate-100 md:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-slate-900">
              {NAV.find((n) => n.id === currentView)?.label ?? "Dashboard"}
            </h1>
            <p className="hidden text-[10px] text-slate-500 sm:block">
              {NAV.find((n) => n.id === currentView)?.group ?? "Overview"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {lastSyncAt && (
              <span className="hidden text-[10px] text-slate-500 sm:inline">
                Last sync: {new Date(lastSyncAt).toLocaleTimeString("en-IN")}
              </span>
            )}
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              LIVE
            </span>
            <button
              onClick={doForceSync}
              disabled={syncing}
              title="Force sync now"
              className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            </button>
          </div>
        </header>
        <motion.main
          key={currentView}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-y-auto p-4 md:p-6"
        >
          {children}
        </motion.main>
      </div>

      {/* Mobile sidebar backdrop */}
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />}
    </div>
  );
}
