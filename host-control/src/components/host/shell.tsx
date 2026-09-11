"use client";

// The control-tower shell: navy sidebar + top bar with the live sync pill,
// view switching with subtle transitions, theme toggle, logout.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BrainCircuit,
  ClipboardCheck,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Moon,
  PlugZap,
  Radio,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Sun,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { relTime } from "@/lib/host/format";
import type { HostStateResponse } from "@/lib/host/types";
import { IconButton, Dot } from "./ui";
import { DashboardView } from "./dashboard-view";
import { UsersView } from "./users-view";
import { ProjectsView } from "./projects-view";
import { ApprovalsView } from "./approvals-view";
import { AlertsView } from "./alerts-view";
import { OutboxView } from "./outbox-view";
import { AuditView } from "./audit-view";
import { IntelligenceView } from "./intelligence-view";
import { IntegrationsView } from "./integrations-view";

export type ViewId =
  | "dashboard"
  | "users"
  | "projects"
  | "approvals"
  | "alerts"
  | "outbox"
  | "audit"
  | "intelligence"
  | "integrations";

const NAV: { id: ViewId; label: string; icon: React.ComponentType<{ className?: string }>; title: string }[] = [
  { id: "dashboard", label: "Mission Dashboard", icon: LayoutDashboard, title: "Mission Dashboard" },
  { id: "users", label: "User Management", icon: Users, title: "User Management" },
  { id: "projects", label: "Projects Control", icon: FolderKanban, title: "Projects Control" },
  { id: "approvals", label: "Approvals Centre", icon: ClipboardCheck, title: "Approvals Centre" },
  { id: "alerts", label: "Alerts & Broadcast", icon: Radio, title: "Alerts & Broadcast" },
  { id: "outbox", label: "Email Outbox", icon: Mail, title: "Automated Email Alerts" },
  { id: "audit", label: "Audit Trail", icon: ScrollText, title: "Audit Trail" },
  { id: "intelligence", label: "Intelligence", icon: BrainCircuit, title: "Intelligence Console" },
  { id: "integrations", label: "Integrations", icon: PlugZap, title: "Integrations & Setup" },
];

export interface ShellProps {
  state: HostStateResponse | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  refresh: (force?: boolean) => Promise<void>;
  onLogout: () => void;
}

export function Shell({ state, loading, error, refreshing, refresh, onLogout }: ShellProps) {
  const [view, setView] = useState<ViewId>("dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  const pendingApprovals = state?.approvals.filter((a) => a.status === "pending").length ?? 0;
  const nav = NAV.find((n) => n.id === view) ?? NAV[0];

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* cookie cleared anyway on next load */
    }
    toast("Signed out", { description: "Host session cookie cleared." });
    onLogout();
  }

  const sidebar = (
    <div className="flex h-full w-64 flex-col bg-[#072b49] text-sky-100">
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0c93e7] shadow-md">
          <ShieldCheck className="h-5 w-5 text-white" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">ProjectAssure</p>
          <p className="text-[10px] uppercase tracking-[0.16em] text-sky-300/80">Host Control</p>
        </div>
      </div>
      <div className="mx-4 mb-3 rounded-xl bg-white/5 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-sky-300/70">Signed in as</p>
        <p className="truncate text-xs font-medium text-sky-100">{state?.session.email ?? "…"}</p>
        <p className="text-[10px] text-sky-300/60">Central Programme Office</p>
      </div>
      <nav className="host-scroll flex-1 space-y-1 overflow-y-auto px-3 pb-3" aria-label="Host navigation">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setView(item.id);
                setNavOpen(false);
              }}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors",
                active
                  ? "bg-[#0c93e7] text-white shadow-md"
                  : "text-sky-200/80 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1 truncate">{item.label}</span>
              {item.id === "approvals" && pendingApprovals > 0 ? (
                <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">{pendingApprovals}</span>
              ) : null}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-5 py-3.5">
        <p className="text-[10px] leading-relaxed text-sky-300/60">
          SIH 2026 · SIH26103
          <br />
          Team NEXGEN · v21
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen shrink-0 lg:block">{sidebar}</aside>

      {/* mobile sidebar overlay */}
      <AnimatePresence>
        {navOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
            onClick={() => setNavOpen(false)}
          >
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.2 }}
              className="h-full w-64"
              onClick={(e) => e.stopPropagation()}
            >
              {sidebar}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
          <div className="flex items-center gap-2 px-4 py-3 sm:px-6">
            <IconButton label="Open navigation" className="lg:hidden" onClick={() => setNavOpen(true)}>
              <Menu className="h-5 w-5" />
            </IconButton>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{nav.title}</h2>
              <p className="hidden text-[11px] text-slate-500 dark:text-slate-400 sm:block">
                main app: {state?.sync.mainUrl ?? "—"} · revision {state?.sync.revision ?? 0} · polled {state?.sync.pollCount ?? 0}×
              </p>
            </div>
            <SyncPill state={state} error={error} />
            <IconButton label={refreshing ? "Syncing" : "Force sync now"} onClick={() => void refresh(true)} disabled={refreshing}>
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin text-[#0c93e7]")} />
            </IconButton>
            <IconButton
              label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </IconButton>
            <IconButton label="Sign out" onClick={() => void handleLogout()}>
              <LogOut className="h-4 w-4" />
            </IconButton>
          </div>
        </header>

        {/* content */}
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
              ))}
            </div>
          ) : !state ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Host state unavailable{error ? ` — ${error}` : ""}. Retrying every 5 seconds…
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                {view === "dashboard" ? <DashboardView state={state} refresh={refresh} /> : null}
                {view === "users" ? <UsersView state={state} refresh={refresh} /> : null}
                {view === "projects" ? <ProjectsView state={state} refresh={refresh} /> : null}
                {view === "approvals" ? <ApprovalsView state={state} refresh={refresh} /> : null}
                {view === "alerts" ? <AlertsView state={state} refresh={refresh} /> : null}
                {view === "outbox" ? <OutboxView state={state} refresh={refresh} /> : null}
                {view === "audit" ? <AuditView state={state} refresh={refresh} /> : null}
                {view === "intelligence" ? <IntelligenceView state={state} refresh={refresh} /> : null}
                {view === "integrations" ? <IntegrationsView state={state} refresh={refresh} /> : null}
              </motion.div>
            </AnimatePresence>
          )}
        </main>

        <footer className="mt-auto border-t border-slate-200 bg-white/60 px-4 py-3 text-[10px] text-slate-400 dark:border-slate-800 dark:bg-slate-900/60 sm:px-6">
          ProjectAssure Host Control · master control plane · data mirrored from the main app every 5s · SIH 2026 · Team NEXGEN
        </footer>
      </div>
    </div>
  );
}

function SyncPill({ state, error }: { state: HostStateResponse | null; error: string | null }) {
  if (error) {
    return (
      <span className="hidden items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 sm:inline-flex">
        <WifiOff className="h-3 w-3" aria-hidden /> LINK ERROR
      </span>
    );
  }
  if (!state) return null;
  const { sync } = state;
  if (!sync.mainReachable) {
    return (
      <span
        title={`Main app unreachable — ${sync.lastError ?? "unknown error"}. Serving last mirror (pushed ${relTime(state.mirror.pushedAt)}).`}
        className="hidden items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 sm:inline-flex"
      >
        <WifiOff className="h-3 w-3" aria-hidden /> STALE · {relTime(state.mirror.pushedAt)}
      </span>
    );
  }
  if (sync.mirrorStatus === "empty") {
    return (
      <span
        title="Main app reachable, but no snapshot pushed yet — open the main app in a browser and log in; its client pushes the portfolio snapshot."
        className="hidden items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-bold text-sky-800 dark:bg-sky-500/15 dark:text-sky-300 sm:inline-flex"
      >
        <Dot tone="sky" /> AWAITING PUSH
      </span>
    );
  }
  if (sync.mirrorStatus === "stale") {
    return (
      <span
        title={`Snapshot pushed ${relTime(state.mirror.pushedAt)} — older than 5 minutes. Is a main-app browser still logged in?`}
        className="hidden items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 sm:inline-flex"
      >
        <Dot tone="amber" /> STALE DATA · {relTime(state.mirror.pushedAt)}
      </span>
    );
  }
  return (
    <span
      title={`Live — main reachable, snapshot pushed ${relTime(state.mirror.pushedAt)}, last sync ${relTime(sync.lastSyncAt)}`}
      className="hidden items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 sm:inline-flex"
    >
      <Wifi className="h-3 w-3" aria-hidden /> LIVE · {relTime(state.mirror.pushedAt)}
    </span>
  );
}
