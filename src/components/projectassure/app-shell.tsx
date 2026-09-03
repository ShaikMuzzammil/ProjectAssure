"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3, Bell, BrainCircuit, Command, FileText, FolderKanban, LayoutDashboard,
  LogOut, Menu, Moon, Search, Settings, ShieldCheck, Sun, X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAppStore, type ViewId } from "@/store/app-store";
import { timeAgo } from "@/lib/projectassure/format";
import { SeverityBadge } from "./shared/ui-bits";
import { AiChatPanel } from "./shared/ai-chat-panel";
import { LoginView } from "./views/login-view";
import { DashboardView } from "./views/dashboard-view";
import { ProjectsView } from "./views/projects-view";
import { ProjectDetailView } from "./views/project-detail-view";
import { AnalyticsView } from "./views/analytics-view";
import { AiAssistantView } from "./views/ai-assistant-view";
import { AlertsView } from "./views/alerts-view";
import { ReportsView } from "./views/reports-view";
import { SettingsView } from "./views/settings-view";

const NAV: { id: ViewId; label: string; icon: React.ElementType; hint: string }[] = [
  { id: "dashboard", label: "Command Centre", icon: LayoutDashboard, hint: "Portfolio pulse" },
  { id: "projects", label: "Projects", icon: FolderKanban, hint: "All 30 projects" },
  { id: "analytics", label: "Analytics", icon: BarChart3, hint: "Deep dive" },
  { id: "ai-assistant", label: "AI Assistant", icon: BrainCircuit, hint: "Ask anything" },
  { id: "alerts", label: "Alerts", icon: Bell, hint: "Risk-ranked" },
  { id: "reports", label: "Reports & Docs", icon: FileText, hint: "Paper to platform" },
  { id: "settings", label: "Administration", icon: Settings, hint: "RBAC & thresholds" },
];

export function AppShell() {
  const user = useAppStore((s) => s.user);
  if (!user) return <LoginView />;
  return <Shell />;
}

function Shell() {
  const view = useAppStore((s) => s.view);
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user)!;
  const logout = useAppStore((s) => s.logout);
  const projects = useAppStore((s) => s.projects);
  const askAi = useAppStore((s) => s.askAi);
  const setAiOpen = useAppStore((s) => s.setAiOpen);
  const paletteOpen = useAppStore((s) => s.paletteOpen);
  const setPaletteOpen = useAppStore((s) => s.setPaletteOpen);
  const { resolvedTheme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  // keyboard shortcuts: palette (Ctrl/Cmd+K) and AI panel ("/")
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(true); }
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); setAiOpen(true); }
      if (e.key === "Escape") { setPaletteOpen(false); setBellOpen(false); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [setPaletteOpen, setAiOpen]);

  const unread = useMemo(() => projects.flatMap((p) => p.alerts).filter((a) => !a.isRead), [projects]);
  const unreadCount = unread.length;

  return (
    <div className="flex min-h-screen bg-background">
      {/* sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-sidebar transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0c93e7] to-[#0b426e] text-white shadow"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <p className="text-sm font-bold tracking-tight">ProjectAssure</p>
            <p className="text-[10px] text-muted-foreground">MoSPI · SIH 2026</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted lg:hidden"><X className="h-4 w-4" /></button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3 custom-scrollbar">
          {NAV.map((n) => {
            const active = view === n.id || (n.id === "projects" && view === "project-detail");
            return (
              <button
                key={n.id}
                onClick={() => { navigate(n.id); setSidebarOpen(false); }}
                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${active ? "bg-[#f0f7ff] text-[#015ca0] shadow-sm dark:bg-[#064f85]/30 dark:text-sky-300" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                <n.icon className={`h-4.5 w-4.5 ${active ? "text-[#0c93e7]" : ""}`} />
                <span className="flex-1 text-left">{n.label}</span>
                {n.id === "alerts" && unreadCount > 0 && (
                  <span className="rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold text-white">{unreadCount}</span>
                )}
                {active && <span className="h-1.5 w-1.5 rounded-full bg-[#0c93e7]" />}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="rounded-xl bg-gradient-to-br from-[#f0f7ff] to-[#e0effe]/60 p-3.5 dark:from-[#064f85]/20 dark:to-transparent">
            <p className="flex items-center gap-1.5 text-xs font-bold text-[#015ca0] dark:text-sky-300"><BrainCircuit className="h-3.5 w-3.5" />Assure AI</p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">18-feature model · 6-hour scoring runs · ₹0 infra cost</p>
            <button onClick={() => askAi("Which projects need my attention today?")} className="mt-2 w-full rounded-md bg-[#0c93e7] py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#0b426e]">Ask AI now</button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* main */}
      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        {/* topbar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur sm:px-6">
          <button onClick={() => setSidebarOpen(true)} className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"><Menu className="h-5 w-5" /></button>
          <button onClick={() => setPaletteOpen(true)} className="flex flex-1 items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted sm:max-w-md">
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search projects, jump to…</span>
            <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold sm:inline">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            {/* notifications */}
            <div className="relative">
              <button onClick={() => setBellOpen(!bellOpen)} className="relative rounded-md p-2 text-muted-foreground hover:bg-muted">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[9px] font-bold text-white">{unreadCount}</span>}
              </button>
              <AnimatePresence>
                {bellOpen && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute right-0 top-12 z-30 w-80 rounded-xl border border-border bg-card p-2 shadow-xl">
                    <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notifications · {unreadCount} unread</p>
                    <div className="max-h-80 space-y-1 overflow-y-auto custom-scrollbar">
                      {unread.slice(0, 6).map((a) => (
                        <button key={a.id} onClick={() => { setBellOpen(false); useAppStore.getState().openProject(a.projectId); }} className="block w-full rounded-lg p-2.5 text-left hover:bg-muted/60">
                          <div className="flex items-center justify-between gap-2"><SeverityBadge severity={a.severity} /><span className="text-[10px] text-muted-foreground">{timeAgo(a.createdAt)}</span></div>
                          <p className="mt-1 line-clamp-2 text-xs font-medium">{a.title}</p>
                        </button>
                      ))}
                      {unread.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">You&rsquo;re all caught up.</p>}
                    </div>
                    <button onClick={() => { setBellOpen(false); navigate("alerts"); }} className="mt-1 w-full rounded-lg border border-border py-2 text-xs font-semibold text-[#0c93e7] hover:bg-muted">Open Alerts Centre</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* theme */}
            <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="rounded-md p-2 text-muted-foreground hover:bg-muted" title="Toggle theme">
              <Sun className="h-5 w-5 hidden dark:block" />
              <Moon className="h-5 w-5 dark:hidden" />
            </button>
            {/* profile */}
            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card py-1.5 pl-1.5 pr-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#0c93e7] to-[#0b426e] text-[10px] font-bold text-white">{user.avatarInitials}</span>
              <div className="hidden text-left sm:block">
                <p className="text-xs font-semibold leading-tight">{user.name}</p>
                <p className="text-[10px] leading-tight text-muted-foreground">{user.role.replace("_", " ")}</p>
              </div>
              <button onClick={logout} className="text-muted-foreground transition-colors hover:text-[#dc2626]" title="Sign out"><LogOut className="h-4 w-4" /></button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-7xl">
            {view === "dashboard" && <DashboardView />}
            {view === "projects" && <ProjectsView />}
            {view === "project-detail" && <ProjectDetailView />}
            {view === "analytics" && <AnalyticsView />}
            {view === "ai-assistant" && <AiAssistantView />}
            {view === "alerts" && <AlertsView />}
            {view === "reports" && <ReportsView />}
            {view === "settings" && <SettingsView />}
          </div>
        </main>

        <footer className="border-t border-border px-6 py-4 text-center text-[11px] text-muted-foreground">
          <p><strong>ProjectAssure</strong> — AI-Powered Predictive Project Monitoring · SIH 2026 · Problem SIH26103 · Theme: Smart Automation · Org: MoSPI · Team NEXGEN</p>
          <p className="mt-0.5">Prototype demo — 30 seeded projects, deterministic simulated ML/AI, all client-side. Production architecture: 3 Vercel apps + Neon + Upstash, total cost ₹0.</p>
        </footer>
      </div>

      <AiChatPanel />
      <CommandPalette />
    </div>
  );
}

/* ── command palette (Ctrl/Cmd+K) ──────────────────────── */
function CommandPalette() {
  const open = useAppStore((s) => s.paletteOpen);
  const setOpen = useAppStore((s) => s.setPaletteOpen);
  if (!open) return null;
  return <PaletteInner onClose={() => setOpen(false)} />;
}

function PaletteInner({ onClose }: { onClose: () => void }) {
  const projects = useAppStore((s) => s.projects);
  const navigate = useAppStore((s) => s.navigate);
  const openProject = useAppStore((s) => s.openProject);
  const askAi = useAppStore((s) => s.askAi);
  const [q, setQ] = useState("");

  const actions = useMemo(() => [
    ...NAV.map((n) => ({ label: n.label, hint: n.hint, run: () => navigate(n.id), icon: "➜" })),
    { label: "Ask AI: attention needed", hint: "Assure AI · exception set", run: () => askAi("Which projects need my attention today?"), icon: "🤖" },
    { label: "Upload monitoring report", hint: "Reports & Docs", run: () => navigate("reports"), icon: "📄" },
  ], [navigate, askAi]);

  const projectHits = useMemo(() =>
    q ? projects.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.district.toLowerCase().includes(q.toLowerCase())).slice(0, 5) : projects.filter((p) => p.healthStatus !== "HEALTHY").slice(0, 3)
  , [projects, q]);

  const actionHits = useMemo(() => actions.filter((a) => !q || a.label.toLowerCase().includes(q.toLowerCase())), [actions, q]);

  return (
    <div className="fixed inset-0 z-60 flex items-start justify-center bg-black/40 p-4 pt-[12vh]" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Command className="h-4 w-4 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects or actions…" className="w-full bg-transparent py-3.5 text-sm outline-none" />
          <kbd className="rounded border border-border bg-muted px-1.5 text-[10px]">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2 custom-scrollbar">
          {actionHits.length > 0 && <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</p>}
          {actionHits.map((a) => (
            <button key={a.label} onClick={() => { a.run(); onClose(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted">
              <span>{a.icon}</span><span className="font-medium">{a.label}</span><span className="ml-auto text-xs text-muted-foreground">{a.hint}</span>
            </button>
          ))}
          {projectHits.length > 0 && <p className="px-2 py-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Projects</p>}
          {projectHits.map((p) => (
            <button key={p.id} onClick={() => { openProject(p.id); onClose(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.healthStatus === "HEALTHY" ? "#22c55e" : p.healthStatus === "AT_RISK" ? "#f59e0b" : "#ef4444" }} />
              <span className="truncate font-medium">{p.name}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{p.district} · {Math.round(p.healthScore)}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
