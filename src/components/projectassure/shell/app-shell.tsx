"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { useApp, ROUTE_TITLES } from "@/store/app-store";
import { VIEWS_BY_ROLE, can } from "@/lib/projectassure/permissions";
import type { ViewId, PortalId } from "@/lib/projectassure/types";
import { inr, relTime } from "@/lib/projectassure/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  LayoutDashboard, FolderKanban, LineChart, BrainCircuit, Bell, ShieldAlert, FileText, Mail,
  Settings2, ChevronDown, Search, Sun, Moon, LogOut, Command, FlaskConical, Database,
  Menu, X, Activity, Sparkles, Gauge, Zap, PanelRightClose, GitCompareArrows,
  ClipboardList, BookOpenCheck, Workflow,
  IndianRupee, PieChart, Scale, ShoppingCart, FileEdit, Building2,
} from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import AiChatPanel from "../shared/ai-chat-panel";
import OnboardingTour from "../shared/onboarding-tour";
import GovHeader from "../shared/gov-header";

import DashboardView from "../views/dashboard-view";
import ProjectsView from "../views/projects-view";
import ProjectDetailView from "../views/project-detail-view";
import AnalyticsView from "../views/analytics-view";
import AiAssistantView from "../views/ai-assistant-view";
import ModelLabView from "../views/model-lab-view";
import VectorStoreView from "../views/vector-store-view";
import AlertsView from "../views/alerts-view";
import InterventionsView from "../views/interventions-view";
import CompareView from "../views/compare-view";
import HelpView from "../views/help-view";
import WorkflowView from "../views/workflow-view";
import ReportsView from "../views/reports-view";
import EmailCenterView from "../views/email-center-view";
import AdminView from "../views/admin-view";
// v5: Simple Monitoring Suite — one-concept-per-page screens for teammates
import MonitorView from "../views/monitor-view";
import CostBenchmarkView from "../views/cost-benchmark-view";
import BudgetVarianceView from "../views/budget-variance-view";
import ProgressMismatchView from "../views/progress-mismatch-view";
import RiskScoreView from "../views/risk-score-view";
import ProcurementView from "../views/procurement-view";
import ChangeOrdersView from "../views/change-orders-view";
import AuthorityReviewView from "../views/authority-review-view";
import ProjectSearchView from "../views/project-search-view";

// v6 COMPACT NAV — one flat list of 7 core features (label: what it does, in one word).
// group "" keeps the sidebar flat; hidden views keep their meta for ⌘K / deep links.
const NAV_META: Record<ViewId, { icon: React.ElementType; label: string; group: string }> = {
  monitor: { icon: LayoutDashboard, label: "Dashboard", group: "" },
  projects: { icon: FolderKanban, label: "Projects", group: "" },
  "ai-assistant": { icon: BrainCircuit, label: "Assure Intelligence", group: "" },
  "model-lab": { icon: FlaskConical, label: "Prediction Engine", group: "" },
  reports: { icon: FileText, label: "Reports & Exports", group: "" },
  "email-center": { icon: Mail, label: "Email Centre", group: "" },
  help: { icon: BookOpenCheck, label: "Help & Guide", group: "" },
  admin: { icon: Settings2, label: "Administration", group: "" },
  // hidden from the sidebar — reachable via links, bell, ⌘K and project cards
  dashboard: { icon: Gauge, label: "Command Centre", group: "_hidden" },
  "project-detail": { icon: Gauge, label: "Project Detail", group: "_hidden" },
  analytics: { icon: LineChart, label: "Analytics", group: "_hidden" },
  compare: { icon: GitCompareArrows, label: "Compare Projects", group: "_hidden" },
  alerts: { icon: ShieldAlert, label: "Early Warnings", group: "_hidden" },
  interventions: { icon: ClipboardList, label: "Interventions", group: "_hidden" },
  workflow: { icon: Workflow, label: "Workflow Guide", group: "_hidden" },
  "vector-store": { icon: Database, label: "Vector Store", group: "_hidden" },
  notifications: { icon: Bell, label: "Notifications", group: "_hidden" },
  audit: { icon: Activity, label: "Audit Trail", group: "_hidden" },
  "risk-score": { icon: ShieldAlert, label: "Risk Scores", group: "_hidden" },
  "budget-variance": { icon: PieChart, label: "Budget Variance", group: "_hidden" },
  "cost-benchmark": { icon: IndianRupee, label: "Cost Benchmark", group: "_hidden" },
  "progress-mismatch": { icon: Scale, label: "Progress Mismatch", group: "_hidden" },
  procurement: { icon: ShoppingCart, label: "Procurement", group: "_hidden" },
  "change-orders": { icon: FileEdit, label: "Change Orders", group: "_hidden" },
  "authority-review": { icon: Building2, label: "Authority Review", group: "_hidden" },
  search: { icon: Search, label: "Project Search", group: "_hidden" },
};

export default function AppShell({ portal }: { portal: PortalId }) {
  const user = useApp(s => s.user)!;
  const route = useApp(s => s.route);
  const view = route.view;
  const navigate = useApp(s => s.navigate);
  const logout = useApp(s => s.logout);
  const askAi = useApp(s => s.askAi);
  const setAiOpen = useApp(s => s.setAiOpen);
  const aiOpen = useApp(s => s.aiOpen);
  const notifications = useApp(s => s.notifications);
  const liveEvents = useApp(s => s.liveEvents);
  const stats = useApp(s => s.stats);
  const [mobileNav, setMobileNav] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  const visibleViews = VIEWS_BY_ROLE[user.role].filter(v => v !== "project-detail");

  const unread = notifications.filter(n => !n.isRead).length;

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(p => !p); }
      if (e.key === "/" && !typing) { e.preventDefault(); setAiOpen(true); }
      if (e.key === "Escape") { setPaletteOpen(false); setBellOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setAiOpen]);

  const renderView = () => {
    switch (view) {
      case "dashboard": return <DashboardView />;
      case "projects": return <ProjectsView />;
      case "project-detail": return <ProjectDetailView />;
      case "analytics": return <AnalyticsView />;
      case "ai-assistant": return <AiAssistantView />;
      case "model-lab": return <ModelLabView />;
      case "vector-store": return <VectorStoreView />;
      case "alerts": return <AlertsView />;
      case "interventions": return <InterventionsView />;
      case "compare": return <CompareView />;
      case "help": return <HelpView />;
      case "workflow": return <WorkflowView />;
      case "reports": return <ReportsView />;
      case "email-center": return <EmailCenterView />;
      case "admin": return <AdminView />;
      case "notifications": return <NotificationsView />;
      case "audit": return <AuditTrailView />;
      // v5: Simple Monitoring Suite
      case "monitor": return <MonitorView />;
      case "cost-benchmark": return <CostBenchmarkView />;
      case "budget-variance": return <BudgetVarianceView />;
      case "progress-mismatch": return <ProgressMismatchView />;
      case "risk-score": return <RiskScoreView />;
      case "procurement": return <ProcurementView />;
      case "change-orders": return <ChangeOrdersView />;
      case "authority-review": return <AuthorityReviewView />;
      case "search": return <ProjectSearchView />;
      default: return <DashboardView />;
    }
  };

  const isAnalyticsPortal = portal === "analytics";
  const isAiPortal = portal === "ai";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen bg-background">
        {/* ─── Sidebar ─────────────────────────────────────────── */}
        <AnimatePresence>
          {mobileNav && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileNav(false)} />
          )}
        </AnimatePresence>
        <aside className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[240px] shrink-0 flex-col border-r bg-card transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          mobileNav ? "translate-x-0" : "-translate-x-full",
        )}>
          <div className="flex h-14 items-center gap-2.5 border-b px-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0c93e7] to-[#0b426e] text-white shadow-sm">
              <ShieldAlert className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold leading-none tracking-tight">ProjectAssure</div>
              <div className="mt-0.5 text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground">
                {isAnalyticsPortal ? "Analytics Portal" : isAiPortal ? "Intelligence Workbench" : "SIH26103 · Portfolio"}
              </div>
            </div>
            <button className="lg:hidden" onClick={() => setMobileNav(false)}><X className="h-4 w-4" /></button>
          </div>

          <nav className="custom-scrollbar flex-1 overflow-y-auto px-2.5 py-3">
            {/* v6: ONE flat feature list — 7 items, no groups, nothing to be confused by */}
            <div className="mb-1 px-2.5 text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/70">Features</div>
            {visibleViews.map(v => {
              const meta = NAV_META[v];
              if (!meta) return null;
              const active = view === v || (v === "projects" && view === "project-detail");
              return (
                <button key={v} onClick={() => { navigate(v); setMobileNav(false); }}
                  className={cn("group relative mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                    active ? "bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                  {active && <motion.div layoutId="nav-pill" className="absolute left-0 h-5 w-0.5 rounded-full bg-[#0c93e7]" />}
                  <meta.icon className={cn("h-4 w-4 shrink-0", active && "text-[#0c93e7] dark:text-[#36adf6]")} />
                  <span className="truncate">{meta.label}</span>
                </button>
              );
            })}

            {/* live feed */}
            <div className="mb-3 rounded-lg border bg-muted/30 p-2.5">
              <div className="mb-1.5 flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground">
                <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>
                Live portfolio feed
              </div>
              <div className="custom-scrollbar max-h-28 space-y-1.5 overflow-y-auto">
                {liveEvents.length === 0 && <div className="text-[10.5px] text-muted-foreground">Listening for portfolio events…</div>}
                {liveEvents.slice(0, 6).map(ev => (
                  <div key={ev.id} className="text-[10.5px] leading-snug text-muted-foreground">
                    <span className="tabular text-[9.5px] text-muted-foreground">{relTime(ev.at)}</span>{" "}
                    <span className="font-medium text-foreground/80">{ev.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </nav>

          <div className="border-t p-2.5">
            <button onClick={() => { setAiOpen(true); }}
              className="mb-2 flex w-full items-center gap-2 rounded-lg bg-gradient-to-r from-[#0b426e] to-[#0c93e7] px-3 py-2.5 text-left text-white shadow-sm transition hover:shadow-md">
              <Sparkles className="h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <div className="text-[12px] font-semibold leading-tight">Ask Assure Intelligence</div>
                <div className="truncate text-[9.5px] text-white/70">cited · grounded · transparent</div>
              </div>
            </button>
            <div className="px-1.5 text-[9.5px] leading-relaxed text-muted-foreground">
              18-signal model · 6-hourly scoring · ₹0 infra
            </div>
          </div>
        </aside>

        {/* ─── Main ─────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* v8: universal official portal band — same header on every surface */}
          <GovHeader surface="app" />
          {/* topbar */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-md sm:px-4">
            <button className="lg:hidden" onClick={() => setMobileNav(true)}><Menu className="h-5 w-5" /></button>
            <div className="hidden min-w-0 items-center gap-2 sm:flex">
              <span className="truncate text-[13px] font-semibold">{ROUTE_TITLES[view]}</span>
              <span className="rounded-full border px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                {user.role.replace("_", " ")}
              </span>
              {(isAnalyticsPortal || isAiPortal) && (
                <span className="rounded-full bg-[#0c93e7]/10 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-[#015ca0] dark:text-[#7cc8fb]">
                  {isAnalyticsPortal ? "analytics domain" : "ai domain"}
                </span>
              )}
            </div>

            <button onClick={() => setPaletteOpen(true)}
              className="ml-auto flex h-8.5 items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-muted-foreground transition hover:border-[#0c93e7]/40 hover:text-foreground">
              <Search className="h-3.5 w-3.5" />
              <span className="hidden text-[12px] sm:inline">Search or jump to…</span>
              <kbd className="hidden items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 font-mono text-[9.5px] sm:flex"><Command className="h-2.5 w-2.5" />K</kbd>
            </button>

            {/* v6: domain switcher removed from the UI — users never have to think about deployment internals */}

            <ThemeToggle />

            {/* notification bell */}
            <Popover open={bellOpen} onOpenChange={setBellOpen}>
              <PopoverTrigger asChild>
                <button className="relative flex h-8.5 w-8.5 items-center justify-center rounded-lg border bg-muted/40 transition hover:text-foreground">
                  <Bell className="h-4 w-4" />
                  {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[9px] font-bold tabular text-white">{unread > 99 ? "99+" : unread}</span>}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-96 p-0" onOpenAutoFocus={e => e.preventDefault()}>
                <NotifPanel onClose={() => setBellOpen(false)} />
              </PopoverContent>
            </Popover>

            {/* user menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg border bg-muted/40 py-1 pl-1 pr-2 transition hover:text-foreground">
                  <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-[10px] font-bold text-white">{user.avatarInitials}</div>
                  <span className="hidden max-w-[110px] truncate text-[12px] font-medium sm:inline">{user.name}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="text-[13px] font-semibold">{user.name}</div>
                  <div className="text-[10.5px] font-normal text-muted-foreground">{user.email}</div>
                  <div className="mt-1 text-[10.5px] font-normal text-muted-foreground">{user.designation}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.role === "ADMIN" && <DropdownMenuItem onClick={() => navigate("admin")}><Settings2 className="mr-2 h-3.5 w-3.5" />Administration</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => askAi("What should I prioritise this week?")}><BrainCircuit className="mr-2 h-3.5 w-3.5" />Ask Assure Intelligence</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-rose-600 dark:text-rose-400"><LogOut className="mr-2 h-3.5 w-3.5" />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          {/* view host */}
          <main className="min-w-0 flex-1 px-3 py-4 sm:px-5 lg:px-6">
            <AnimatePresence mode="wait">
              <motion.div key={view + (route.projectId ?? "")}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
                {renderView()}
              </motion.div>
            </AnimatePresence>
          </main>

          <footer className="mt-auto border-t px-4 py-3 text-[10.5px] text-muted-foreground">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>ProjectAssure · Smart India Hackathon 2026 · SIH26103 · Team NEXGEN</span>
              <span className="flex items-center gap-2">
                <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-emerald-500" />{stats().totalProjects} projects · {inr(stats().totalBudget)} sanctioned</span>
                <span className="hidden items-center gap-1 sm:flex"><Activity className="h-3 w-3 text-[#0c93e7]" />built-in engine · demo world frozen at 10 Sep 2026</span>
              </span>
            </div>
          </footer>
        </div>

        {/* AI slide-over */}
        <AiChatPanel />
        <OnboardingTour />
        <button onClick={() => setAiOpen(!aiOpen)}
          className="fixed bottom-5 right-5 z-40 flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-[#0b426e] to-[#0c93e7] px-4 text-[13px] font-semibold text-white shadow-lg shadow-[#0c93e7]/30 transition hover:scale-[1.03]">
          {aiOpen ? <PanelRightClose className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          <span className="hidden sm:inline">{aiOpen ? "Close Intelligence" : "Assure Intelligence"}</span>
        </button>

        {/* command palette */}
        <Palette open={paletteOpen} setOpen={setPaletteOpen} />
      </div>
    </TooltipProvider>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- next-themes mounted guard (SSR hydration safety)
  useEffect(() => setMounted(true), []);
  return (
    <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex h-8.5 w-8.5 items-center justify-center rounded-lg border bg-muted/40 transition hover:text-foreground"
      title="Toggle dark / light (audit-grade dark mode)">
      {mounted && resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function NotifPanel({ onClose }: { onClose: () => void }) {
  const notifications = useApp(s => s.notifications);
  const markRead = useApp(s => s.markNotificationRead);
  const markAll = useApp(s => s.markAllNotificationsRead);
  const navigate = useApp(s => s.navigate);
  const grouped = useMemo(() => {
    const now = Date.now();
    const today: typeof notifications = [], week: typeof notifications = [], earlier: typeof notifications = [];
    for (const n of notifications) {
      const age = now - new Date(n.createdAt).getTime();
      if (age < 86400000) today.push(n); else if (age < 7 * 86400000) week.push(n); else earlier.push(n);
    }
    return { today, week, earlier };
  }, [notifications]);

  const row = (n: (typeof notifications)[number]) => (
    <button key={n.id} onClick={() => { markRead(n.id); if (n.linkView) navigate(n.linkView, { projectId: n.linkProjectId }); onClose(); }}
      className={cn("block w-full border-l-2 px-3 py-2 text-left transition hover:bg-muted/60", n.isRead ? "border-transparent" : "border-[#0c93e7] bg-[#0c93e7]/[0.04]")}>
      <div className="flex items-start justify-between gap-2">
        <span className={cn("text-[12px] font-semibold leading-snug", !n.isRead && "text-foreground")}>{n.title}</span>
        <span className="shrink-0 text-[9.5px] tabular text-muted-foreground">{relTime(n.createdAt)}</span>
      </div>
      <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{n.message}</div>
    </button>
  );

  return (
    <div className="custom-scrollbar max-h-[420px] overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-3 py-2 backdrop-blur">
        <span className="text-[12px] font-bold">Notifications</span>
        <button onClick={() => { markAll(); toast.success("All notifications marked read"); }} className="text-[11px] font-semibold text-[#0c93e7] hover:underline">Mark all read</button>
      </div>
      {grouped.today.length > 0 && <div className="px-3 pt-2 pb-0.5 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">Today</div>}
      {grouped.today.map(row)}
      {grouped.week.length > 0 && <div className="px-3 pt-2 pb-0.5 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">This week</div>}
      {grouped.week.map(row)}
      {grouped.earlier.length > 0 && <div className="px-3 pt-2 pb-0.5 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">Earlier</div>}
      {grouped.earlier.slice(0, 5).map(row)}
      {notifications.length === 0 && <div className="px-3 py-8 text-center text-[11.5px] text-muted-foreground">No notifications yet — the portfolio heartbeat will populate this feed.</div>}
    </div>
  );
}

function Palette({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const navigate = useApp(s => s.navigate);
  const projects = useApp(s => s.scoped)();
  const askAi = useApp(s => s.askAi);
  const goPage = useApp(s => s.goPage);
  const setTheme = useTheme().setTheme;
  const resolved = useTheme().resolvedTheme;
  const user = useApp(s => s.user)!;
  const visible = VIEWS_BY_ROLE[user.role].filter(v => v !== "project-detail");

  const flagged = projects.filter(p => p.healthStatus !== "HEALTHY").slice(0, 4);

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/45 p-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}>
          <motion.div initial={{ scale: 0.97, y: -8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: -8 }} transition={{ duration: 0.16 }}
            onClick={e => e.stopPropagation()} className="w-full max-w-xl">
            <CommandPrimitive loop className="overflow-hidden rounded-xl border bg-card shadow-2xl">
              <div className="flex items-center gap-2.5 border-b px-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <CommandPrimitive.Input autoFocus placeholder="Search projects, jump to screens, run actions…"
                  className="h-11 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground" />
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">ESC</kbd>
              </div>
              <CommandPrimitive.List className="custom-scrollbar max-h-[360px] overflow-y-auto p-2">
                <CommandPrimitive.Empty className="px-3 py-8 text-center text-[12px] text-muted-foreground">No results — try “Bharatmala” or “alerts”.</CommandPrimitive.Empty>

                <CommandPrimitive.Group heading="Jump to" className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[9.5px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground">
                  {visible.map(v => {
                    const meta = NAV_META[v];
                    return (
                      <CommandPrimitive.Item key={v} value={`go ${meta.label}`} onSelect={() => { navigate(v); setOpen(false); }}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] data-[selected=true]:bg-[#e0effe] data-[selected=true]:text-[#015ca0] dark:data-[selected=true]:bg-[#0c93e7]/15 dark:data-[selected=true]:text-[#7cc8fb]">
                        <meta.icon className="h-4 w-4" />{meta.label}
                      </CommandPrimitive.Item>
                    );
                  })}
                </CommandPrimitive.Group>

                <CommandPrimitive.Group heading="Flagged projects" className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[9.5px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground">
                  {flagged.map(p => (
                    <CommandPrimitive.Item key={p.id} value={p.name} onSelect={() => { useApp.getState().openProject?.(p.id); navigate("project-detail", { projectId: p.id }); setOpen(false); }}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] data-[selected=true]:bg-[#e0effe] dark:data-[selected=true]:bg-[#0c93e7]/15">
                      <span className="h-2 w-2 rounded-full" style={{ background: p.healthStatus === "CRITICAL" ? "#ef4444" : "#f59e0b" }} />
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="text-[10px] tabular text-muted-foreground">health {p.healthScore}</span>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>

                <CommandPrimitive.Group heading="Actions" className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[9.5px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground">
                  <CommandPrimitive.Item value="ask ai" onSelect={() => { setOpen(false); askAi("Which projects need my attention today?"); }}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] data-[selected=true]:bg-[#e0effe] dark:data-[selected=true]:bg-[#0c93e7]/15">
                    <Sparkles className="h-4 w-4 text-[#0c93e7]" />Ask Assure Intelligence: what needs my attention?
                  </CommandPrimitive.Item>
                  <CommandPrimitive.Item value="upload report" onSelect={() => { navigate("reports"); setOpen(false); }}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] data-[selected=true]:bg-[#e0effe] dark:data-[selected=true]:bg-[#0c93e7]/15">
                    <FileText className="h-4 w-4" />Upload a field report (paper → platform)
                  </CommandPrimitive.Item>
                  <CommandPrimitive.Item value="toggle theme" onSelect={() => { setTheme(resolved === "dark" ? "light" : "dark"); setOpen(false); }}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] data-[selected=true]:bg-[#e0effe] dark:data-[selected=true]:bg-[#0c93e7]/15">
                    {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}Toggle dark mode
                  </CommandPrimitive.Item>
                </CommandPrimitive.Group>
              </CommandPrimitive.List>
            </CommandPrimitive>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


// ─── Notifications (full-page) & Audit trail (standalone) ──────────────────
function NotificationsView() {
  const notifications = useApp(s => s.notifications);
  const markRead = useApp(s => s.markNotificationRead);
  const markAll = useApp(s => s.markAllNotificationsRead);
  const navigate = useApp(s => s.navigate);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const list = notifications.filter(n => filter === "ALL" || !n.isRead);
  return (
    <div className="mx-auto max-w-[820px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Notifications</h1>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">Every alert, prediction, document and email event — generated by backend rules, never random.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 rounded-lg border bg-card p-1">
            {(["ALL", "UNREAD"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={cn("rounded-md px-3 py-1.5 text-[11.5px] font-semibold", filter === f ? "bg-foreground text-background" : "text-muted-foreground")}>{f}</button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => { markAll(); toast.success("All marked read"); }}>Mark all read</Button>
        </div>
      </div>
      <div className="space-y-2">
        {list.length === 0 && <div className="rounded-xl border border-dashed bg-card p-8 text-center text-[12px] text-muted-foreground">Nothing here — the portfolio heartbeat will populate this feed within 40 seconds.</div>}
        {list.map(n => (
          <button key={n.id} onClick={() => { markRead(n.id); if (n.linkView) navigate(n.linkView, { projectId: n.linkProjectId }); }}
            className={cn("block w-full rounded-xl border bg-card p-3.5 text-left transition hover:border-[#0c93e7]/40", !n.isRead && "border-l-[3px] border-l-[#0c93e7]")}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-[13px] font-bold">{n.title}</span>
              <span className="shrink-0 text-[10px] tabular text-muted-foreground">{relTime(n.createdAt)}</span>
            </div>
            <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{n.message}</div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold">{n.type}</span>
              {!n.isRead && <span className="rounded-full bg-[#0c93e7]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#015ca0] dark:text-[#7cc8fb]">unread</span>}
              {n.linkView && <span className="text-[9.5px] text-muted-foreground">opens {n.linkView.replace(/-/g, " ")}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function AuditTrailView() {
  const audit = useApp(s => s.globalAudit);
  const [q, setQ] = useState("");
  const [action, setAction] = useState<"ALL" | "LOGIN" | "CREATE" | "UPDATE" | "EXPORT" | "EMAIL_SEND" | "PREDICTION_RUN">("ALL");
  const list = audit.filter(e => (action === "ALL" || e.action === action) && (!q || (e.details + e.userName + e.entity).toLowerCase().includes(q.toLowerCase()))).slice(0, 120);
  return (
    <div className="mx-auto max-w-[1000px] space-y-4">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight">Audit Trail</h1>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">Append-only record of every action — who, what, when, before/after. {audit.length} entries retained.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search audit entries…" className="h-9 flex-1 min-w-[180px] rounded-lg border bg-background px-3 text-[12.5px] outline-none focus:border-[#0c93e7]" />
        <div className="flex flex-wrap gap-1">
          {(["ALL", "LOGIN", "CREATE", "UPDATE", "EXPORT", "EMAIL_SEND", "PREDICTION_RUN"] as const).map(a => (
            <button key={a} onClick={() => setAction(a)} className={cn("rounded-full px-2.5 py-1.5 text-[10.5px] font-semibold", action === a ? "bg-foreground text-background" : "border text-muted-foreground hover:bg-muted")}>{a.replace("_", " ")}</button>
          ))}
        </div>
      </div>
      <div className="custom-scrollbar max-h-[560px] space-y-1.5 overflow-y-auto rounded-xl border bg-card p-3">
        {list.map(e => (
          <div key={e.id} className="rounded-lg border-l-2 border-l-[#0c93e7]/50 bg-muted/25 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-foreground px-1.5 py-0.5 font-mono text-[9px] font-bold text-background">{e.action}</span>
              <span className="text-[11.5px] font-semibold">{e.entity}</span>
              <span className="text-[10.5px] text-muted-foreground">{e.userName} · {e.userRole.replace("_", " ")}</span>
              <span className="ml-auto text-[9.5px] tabular text-muted-foreground">{new Date(e.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{e.details}</div>
          </div>
        ))}
        {list.length === 0 && <div className="p-6 text-center text-[12px] text-muted-foreground">No entries match this filter.</div>}
      </div>
    </div>
  );
}
