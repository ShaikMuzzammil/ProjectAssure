"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BellOff, CheckCheck, Filter, Mail, Sparkles } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { formatDateTime, timeAgo } from "@/lib/projectassure/format";
import type { AlertSeverity } from "@/lib/projectassure/types";
import { SectionTitle, SeverityBadge } from "../shared/ui-bits";
import { toast } from "sonner";

const SEV_ORDER: AlertSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export function AlertsView() {
  const projects = useAppStore((s) => s.projects);
  const markAlertRead = useAppStore((s) => s.markAlertRead);
  const markAllRead = useAppStore((s) => s.markAllRead);
  const openProject = useAppStore((s) => s.openProject);
  const [sevFilter, setSevFilter] = useState<"ALL" | AlertSeverity>("ALL");
  const [showRead, setShowRead] = useState(true);

  const all = useMemo(() => {
    const sevRank = Object.fromEntries(SEV_ORDER.map((s, i) => [s, i]));
    return projects
      .flatMap((p) => p.alerts.map((a) => ({ ...a, projectName: p.name, projectId: p.id })))
      .filter((a) => (sevFilter === "ALL" || a.severity === sevFilter) && (showRead || !a.isRead))
      .sort((a, b) => sevRank[a.severity as AlertSeverity] - sevRank[b.severity as AlertSeverity] || +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [projects, sevFilter, showRead]);

  const counts = useMemo(() => {
    const flat = projects.flatMap((p) => p.alerts);
    return {
      unread: flat.filter((a) => !a.isRead).length,
      critical: flat.filter((a) => a.severity === "CRITICAL" && !a.isRead).length,
      total: flat.length,
    };
  }, [projects]);

  const simulateAlert = () => {
    toast.error("🔴 Critical milestone slip simulated", {
      description: "WebSocket push delivered · email queued via Gmail SMTP (500/day free tier) · risk-ranked in dashboard",
      action: { label: "Open alerts", onClick: () => setShowRead(true) },
      duration: 6000,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alerts Centre</h1>
          <p className="text-sm text-muted-foreground">{counts.unread} unread of {counts.total} · {counts.critical} critical · multi-channel: in-app + email + banner</p>
        </div>
        <div className="flex gap-2">
          <button onClick={simulateAlert} className="inline-flex items-center gap-1.5 rounded-md border border-[#f59e0b]/60 bg-[#fef3c7] px-3 py-2 text-sm font-semibold text-[#b45309] transition-colors hover:bg-[#fde68a] dark:bg-amber-500/10 dark:text-amber-300">
            <Sparkles className="h-4 w-4" /> Simulate critical slip
          </button>
          <button onClick={() => { markAllRead(); toast.success("All alerts marked read"); }} className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium transition-colors hover:bg-muted">
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        </div>
      </div>

      {/* filter row */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3 shadow-sm">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {(["ALL", ...SEV_ORDER] as const).map((s) => (
          <button key={s} onClick={() => setSevFilter(s)} className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${sevFilter === s ? "bg-[#0c93e7] text-white" : "border border-input text-muted-foreground hover:bg-muted"}`}>
            {s === "ALL" ? "All" : s}
          </button>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={showRead} onChange={(e) => setShowRead(e.target.checked)} className="rounded" />
          show read
        </label>
      </div>

      <div className="space-y-3">
        {all.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            className={`rounded-lg border p-4 shadow-sm transition-colors ${a.isRead ? "border-border bg-card opacity-75" : "border-[#bae0fd] bg-[#f0f7ff]/50 dark:bg-[#064f85]/10"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={a.severity as AlertSeverity} />
                <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{a.type}</span>
                <button onClick={() => openProject(a.projectId)} className="text-sm font-semibold hover:text-[#0c93e7] hover:underline">{a.projectName}</button>
              </div>
              <span className="text-[11px] text-muted-foreground">{formatDateTime(a.createdAt)} · {timeAgo(a.createdAt)}</span>
            </div>
            <p className="mt-2 font-medium">{a.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{a.description}</p>
            <div className="mt-3 grid gap-2 md:grid-cols-[1.6fr_1fr]">
              <div className="rounded-md border border-[#bae0fd]/70 bg-white/70 p-2.5 text-xs dark:bg-white/5">
                <p className="flex items-center gap-1 font-semibold text-[#015ca0] dark:text-sky-300"><Sparkles className="h-3 w-3" />AI recommended action</p>
                <p className="mt-1">{a.recommendedAction}</p>
                <p className="mt-1 text-muted-foreground">Owner: {a.recommendedOwner} · deadline {a.recommendedDeadline}</p>
              </div>
              <div className="flex items-center justify-end gap-2">
                {!a.isRead && (
                  <button onClick={() => markAlertRead(a.projectId, a.id)} className="rounded-md border border-input px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted">Mark read</button>
                )}
                <button onClick={() => openProject(a.projectId)} className="rounded-md bg-[#0c93e7] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0b426e]">Open project</button>
                <button onClick={() => toast.success("Email forwarded to review committee")} className="rounded-md border border-input p-1.5 text-muted-foreground transition-colors hover:bg-muted" title="Forward via email"><Mail className="h-4 w-4" /></button>
              </div>
            </div>
          </motion.div>
        ))}
        {all.length === 0 && (
          <div className="rounded-lg border border-dashed border-border py-16 text-center">
            <BellOff className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium">Nothing here</p>
            <p className="text-sm text-muted-foreground">No alerts match the current filter — the portfolio is calm.</p>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground shadow-sm">
        <SectionTitle title="Alert rules in force" />
        <ul className="mt-2 grid gap-1.5 md:grid-cols-2">
          <li>• Projected overrun &gt;10% → <strong>WARNING</strong>; &gt;20% → <strong>CRITICAL</strong> with escalation</li>
          <li>• Burn velocity &gt;+30% for 2 months → <strong>EARLY_WARNING</strong></li>
          <li>• Delay probability crossing 70% → <strong>HIGH email alert</strong> via Gmail SMTP</li>
          <li>• Risk-level change (Green→Amber→Red) → <strong>RISK_LEVEL_CHANGE</strong>; repeat only if probability moves &gt;15 pts</li>
          <li>• Red-flagged projects always require human-officer verification (rule R10)</li>
          <li>• Critical/High → email + in-app · Medium → in-app only · Low → digest</li>
        </ul>
      </div>
    </div>
  );
}
