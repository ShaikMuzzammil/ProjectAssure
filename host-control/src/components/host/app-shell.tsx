"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard, FileCheck, Wallet, Bell, Users, BrainCircuit,
  Plug, Globe, ScrollText, RefreshCw, ExternalLink, CircleDot,
} from "lucide-react";
import { useAdminStore } from "@/store/admin-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, timeAgo } from "@/lib/utils";
import type { HostViewId } from "@/lib/host/types";

const NAV: { id: HostViewId; label: string; icon: any; group: "control" | "ops" | "system" }[] = [
  { id: "dashboard", label: "Mission Control", icon: LayoutDashboard, group: "control" },
  { id: "approvals", label: "Approval Centre", icon: FileCheck, group: "control" },
  { id: "budget-risk", label: "Budget Risk", icon: Wallet, group: "control" },
  { id: "alerts", label: "Alerts Feed", icon: Bell, group: "control" },
  { id: "users", label: "Users & Tenants", icon: Users, group: "ops" },
  { id: "intelligence", label: "Intelligence Console", icon: BrainCircuit, group: "ops" },
  { id: "integrations", label: "Integrations", icon: Plug, group: "system" },
  { id: "audit", label: "Audit Trail", icon: ScrollText, group: "system" },
  { id: "demo", label: "Demo Showcase", icon: Globe, group: "system" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentView, setView, snapshot, integration, lastSyncAt, syncActive, admin } = useAdminStore();

  // ─── Sync polling (every 5s) ──────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        useAdminStore.getState().setSyncActive(true);
        const res = await fetch("/api/admin/sync", { cache: "no-store" });
        if (!active) return;
        const json = await res.json();
        useAdminStore.getState().hydrate(json);
      } catch {
        /* silent — UI keeps last known state */
      } finally {
        if (active) useAdminStore.getState().setSyncActive(false);
      }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => { active = false; clearInterval(t); };
  }, []);

  const pendingApprovals = snapshot?.pendingApprovals ?? 0;
  const openAlerts = snapshot?.openAlerts ?? 0;

  const handleForceResync = async () => {
    try {
      await fetch("/api/admin/sync", { cache: "no-store" });
      const res = await fetch("/api/admin/sync", { cache: "no-store" });
      const json = await res.json();
      useAdminStore.getState().hydrate(json);
    } catch { /* ignore */ }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* ─── Sidebar ───────────────────────────────────────────────────── */}
      <aside className="host-sidebar host-sidebar-mesh fixed inset-y-0 left-0 z-30 hidden w-64 flex-col text-slate-100 lg:flex">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="flex size-9 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
            <CircleDot className="size-5 text-brand-300" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">ProjectAssure</div>
            <div className="text-[10px] uppercase tracking-widest text-brand-300">Host Control</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-1">
          {(["control", "ops", "system"] as const).map(group => (
            <div key={group} className="space-y-1">
              <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-widest text-brand-300/70">
                {group === "control" ? "Control" : group === "ops" ? "Operations" : "System"}
              </div>
              {NAV.filter(n => n.group === group).map(n => {
                const active = currentView === n.id;
                const Icon = n.icon;
                const count =
                  n.id === "approvals" ? pendingApprovals :
                  n.id === "alerts" ? openAlerts : 0;
                return (
                  <button
                    key={n.id}
                    onClick={() => setView(n.id)}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                      active
                        ? "bg-white/10 text-white shadow-inner"
                        : "text-brand-100/80 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", active ? "text-brand-300" : "text-brand-200/60 group-hover:text-brand-300")} />
                    <span className="flex-1 text-left">{n.label}</span>
                    {count > 0 && (
                      <Badge variant="secondary" className="bg-rose-500/20 text-rose-100 border-rose-400/30 px-1.5 py-0 text-[10px]">
                        {count}
                      </Badge>
                    )}
                  </button>
                );
              })}
              {group !== "system" && <div className="my-2 h-px bg-white/5" />}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 text-[10px] text-brand-200/60">
            <span className={cn("size-2 rounded-full", syncActive ? "bg-emerald-400 live-pulse" : "bg-emerald-500/60")} />
            <span>{syncActive ? "Syncing portfolio…" : `Last sync ${timeAgo(lastSyncAt)}`}</span>
          </div>
        </div>
      </aside>

      {/* ─── Main content area ──────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <CircleDot className="size-5 text-primary" />
            <span className="text-sm font-semibold">Host Control</span>
          </div>
          <div className="hidden lg:flex items-center gap-2">
            <h1 className="text-sm font-semibold text-foreground">
              {NAV.find(n => n.id === currentView)?.label ?? "Mission Control"}
            </h1>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              {snapshot ? `${snapshot.totalProjects} projects · ₹${(snapshot.totalSanctionedL / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr sanctioned` : "Loading…"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={handleForceResync} className="gap-1.5">
                  <RefreshCw className={cn("size-3.5", syncActive && "animate-spin")} />
                  <span className="hidden sm:inline">Force resync</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Immediately pull a fresh portfolio snapshot</TooltipContent>
            </Tooltip>

            {integration?.mainProjectUrl && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    asChild
                    className="gap-1.5 text-muted-foreground"
                  >
                    <a href={integration.mainProjectUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3.5" />
                      <span className="hidden sm:inline">Main project</span>
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open the main ProjectAssure prototype in a new tab</TooltipContent>
              </Tooltip>
            )}

            <Separator orientation="vertical" className="h-6" />

            <div className="flex items-center gap-2">
              <Avatar className="size-7 border">
                <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                  {admin?.avatarInitials ?? "AK"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block leading-tight">
                <div className="text-xs font-medium">{admin?.name ?? "Arun Kulkarni"}</div>
                <div className="text-[10px] text-muted-foreground">{admin?.designation ?? "Chief Programme Officer"}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile nav */}
        <nav className="lg:hidden flex items-center gap-1 overflow-x-auto border-b px-2 py-2 custom-scrollbar">
          {NAV.map(n => {
            const Icon = n.icon;
            const active = currentView === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setView(n.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                )}
              >
                <Icon className="size-3.5" />
                <span>{n.label.split(" ")[0]}</span>
              </button>
            );
          })}
        </nav>

        <main className="flex-1 p-4 lg:p-6">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        </main>

        <footer className="border-t bg-background/95 px-4 py-3 text-[11px] text-muted-foreground lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              ProjectAssure Host Control · SIH 2026 · SIH26103 · Team NEXGEN · Amrita Vishwa Vidyapeetham Chennai
            </span>
            <span className="hidden md:inline">
              {integration?.mainProjectUrl && `Main project: ${integration.mainProjectUrl}`}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
