"use client";

// Mission Dashboard — every number comes from the LIVE mirrored snapshot.
// Nothing is hardcoded; empty states are honest.

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  IndianRupee,
  LayoutDashboard,
  LogIn,
  Radio,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Button, Card, CardHead, Dot, EmptyState, Progress, severityTone } from "./ui";
import { relTime, fmtDateTime, healthBand } from "@/lib/host/format";
import type { HostStateResponse, SyncEvent, SyncProject } from "@/lib/host/types";
import type { ViewProps } from "./view-props";

export function DashboardView({ state, refresh }: ViewProps) {
  const stats = state.mirror.stats;
  const pending = state.approvals.filter((a) => a.status === "pending");

  const bands = useMemo(() => {
    const counts = { critical: 0, atRisk: 0, fair: 0, healthy: 0 };
    for (const p of state.mirror.projects) {
      if (p.health < 40) counts.critical += 1;
      else if (p.health < 60) counts.atRisk += 1;
      else if (p.health < 75) counts.fair += 1;
      else counts.healthy += 1;
    }
    return [
      { band: "Critical <40", count: counts.critical, fill: "#e11d48" },
      { band: "At Risk 40-59", count: counts.atRisk, fill: "#f59e0b" },
      { band: "Fair 60-74", count: counts.fair, fill: "#fbbf24" },
      { band: "Healthy 75+", count: counts.healthy, fill: "#10b981" },
    ];
  }, [state.mirror.projects]);

  const atRisk = useMemo(
    () =>
      [...state.mirror.projects]
        .sort((a, b) => a.health - b.health || b.delayRisk - a.delayRisk)
        .slice(0, 6) as SyncProject[],
    [state.mirror.projects],
  );

  const feed = useMemo(() => {
    const events: (SyncEvent & { _kind: "event" | "login" })[] = state.mirror.events.slice(0, 14).map((e) => ({ ...e, _kind: "event" as const }));
    const logins = state.mirror.loginFeed.slice(0, 8).map((l) => ({
      id: l.id,
      kind: "login",
      title: `${l.userName} signed in`,
      at: l.at,
      projectId: undefined,
      _kind: "login" as const,
    }));
    return [...events, ...logins].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 18);
  }, [state.mirror.events, state.mirror.loginFeed]);

  const sentEmails = state.outbox.filter((e) => e.status === "SENT").length;
  const simulated = state.outbox.filter((e) => e.status === "SIMULATED").length;

  if (!stats) {
    return (
      <EmptyState
        icon={<Wifi className="h-8 w-8" />}
        title="No snapshot mirrored yet"
        hint="The main app is polled every 5 seconds server-side. Open the main ProjectAssure app in a browser and log in — its client pushes the full portfolio snapshot (users, projects, alerts, login feed), and this dashboard fills within seconds."
      >
        <Button variant="outline" size="sm" onClick={() => void refresh(true)} className="mt-2">
          <RefreshCw className="h-3.5 w-3.5" /> Force sync now
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <Kpi label="Users" value={stats.users} sub={`${stats.registeredUsers} registered · ${stats.demoUsers} demo`} icon={<Users className="h-4 w-4" />} />
        <Kpi label="Projects" value={stats.projects} sub={`${stats.activeProjects} active`} icon={<LayoutDashboard className="h-4 w-4" />} />
        <Kpi label="Critical projects" value={stats.criticalProjects} sub="health < 40" icon={<ShieldAlert className="h-4 w-4" />} tone={stats.criticalProjects > 0 ? "red" : "green"} />
        <Kpi label="Open alerts" value={stats.openAlerts} sub="portfolio-wide" icon={<AlertTriangle className="h-4 w-4" />} tone={stats.openAlerts > 0 ? "amber" : "green"} />
        <Kpi label="Sanctioned" value={`₹${stats.budgetTotalCr} Cr`} sub={`spent ₹${stats.budgetSpentCr} Cr`} icon={<IndianRupee className="h-4 w-4" />} />
        <Kpi
          label="Avg health"
          value={stats.avgHealth}
          sub="portfolio mean"
          icon={<Activity className="h-4 w-4" />}
          tone={stats.avgHealth >= 60 ? "green" : stats.avgHealth >= 40 ? "amber" : "red"}
        />
        <Kpi label="Pending approvals" value={pending.length} sub="derived from real sync data" icon={<ClipboardCheck className="h-4 w-4" />} tone={pending.length > 0 ? "amber" : "green"} />
        <Kpi label="Broadcasts sent" value={state.broadcasts.length} sub="via main sync hub" icon={<Radio className="h-4 w-4" />} />
        <Kpi label="Emails logged" value={state.outbox.length} sub={`${sentEmails} sent · ${simulated} simulated`} icon={<LogIn className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* health distribution */}
        <Card>
          <CardHead title="Health band distribution" subtitle={`${state.mirror.projects.length} mirrored projects`} icon={<TrendingUp className="h-4 w-4" />} />
          <div className="p-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bands} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" strokeOpacity={0.5} />
                  <XAxis dataKey="band" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(12,147,231,0.08)" }}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {bands.map((b) => (
                      <Cell key={b.band} fill={b.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* top at-risk */}
        <Card>
          <CardHead title="Top at-risk projects" subtitle="lowest health first, then delay risk" icon={<ShieldAlert className="h-4 w-4" />} />
          <div className="host-scroll max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {atRisk.length === 0 ? (
              <div className="p-5 text-xs text-slate-500">No projects mirrored yet.</div>
            ) : (
              atRisk.map((p) => {
                const band = healthBand(p.health);
                return (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {p.psId} · {p.name}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <Progress value={p.health} tone={band.tone === "green" ? "green" : band.tone === "amber" ? "amber" : "red"} />
                        <span className="w-8 shrink-0 text-[10px] font-bold text-slate-500">{p.health}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge tone={band.tone}>{band.label}</Badge>
                      <p className="mt-1 text-[10px] text-slate-400">risk {p.delayRisk}%</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* live activity */}
        <Card className="xl:col-span-2">
          <CardHead
            title="Live activity feed"
            subtitle="portfolio events + login feed from the snapshot (newest first)"
            icon={<Activity className="h-4 w-4" />}
            right={<Badge tone="sky"><Dot tone="green" /> auto-refresh 5s</Badge>}
          />
          <div className="host-scroll max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {feed.length === 0 ? (
              <div className="p-5 text-xs text-slate-500 dark:text-slate-400">No events mirrored yet.</div>
            ) : (
              feed.map((f) => (
                <div key={`${f._kind}-${f.id}`} className="flex items-start gap-3 px-5 py-2.5">
                  {f._kind === "login" ? (
                    <LogIn className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0c93e7]" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-slate-700 dark:text-slate-200">{f.title}</p>
                    <p className="text-[10px] text-slate-400">
                      {f.kind} · {relTime(f.at)}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-slate-400">{fmtDateTime(f.at)}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* sync status */}
        <Card>
          <CardHead title="Sync engine status" subtitle="server-side poll of the main app" icon={<Wifi className="h-4 w-4" />} />
          <div className="space-y-3 p-5 text-xs">
            <Row k="Main app URL" v={state.sync.mainUrl} />
            <Row
              k="Main app"
              v={state.sync.mainReachable ? "reachable" : "unreachable"}
              badge={
                state.sync.mainReachable ? (
                  <Badge tone="green"><Dot tone="green" /> REACHABLE</Badge>
                ) : (
                  <Badge tone="amber"><WifiOff className="h-3 w-3" /> OFFLINE — STALE MIRROR</Badge>
                )
              }
            />
            <Row k="Snapshot pushed" v={`${relTime(state.mirror.pushedAt)} (${state.mirror.pushedAt ? "live" : "none"})`} />
            <Row k="Mirrored at" v={relTime(state.mirror.mirroredAt)} />
            <Row k="Hub revision" v={String(state.sync.revision)} />
            <Row k="Commands queued on main" v={String(state.sync.commandCount)} />
            <Row k="Host polls" v={`${state.sync.pollCount} (every 5s)`} />
            {state.sync.lastError ? <Row k="Last error" v={state.sync.lastError} tone="error" /> : null}
            <div className="pt-1">
              <Button
                variant="navy"
                size="sm"
                className="w-full"
                onClick={() => {
                  void refresh(true);
                  toast.info("Force sync triggered", { description: "Fetching the main app state right now." });
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Force sync now
              </Button>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                Broadcasts and user alerts are queued on the main sync hub — logged-in main-app browsers receive them within ~20 seconds.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* pending approvals strip */}
      {pending.length > 0 ? (
        <Card>
          <CardHead
            title="Approvals waiting for a decision"
            subtitle="derived from real main-app activity — nothing is seeded"
            icon={<ClipboardCheck className="h-4 w-4" />}
            right={<Badge tone={severityTone("warning")}>{pending.length} pending</Badge>}
          />
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {pending.slice(0, 4).map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                <Badge tone={severityTone(a.severity)}>{a.severity}</Badge>
                <p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200">{a.title}</p>
                <span className="shrink-0 text-[10px] text-slate-400">{relTime(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon,
  tone = "navy",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  tone?: "navy" | "green" | "amber" | "red";
}) {
  const tones = {
    navy: "text-[#072b49] dark:text-sky-300",
    green: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-rose-600 dark:text-rose-400",
  } as const;
  return (
    <motion.div whileHover={{ y: -2 }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
        <span className="text-slate-300 dark:text-slate-600">{icon}</span>
      </div>
      <p className={`mt-1.5 text-2xl font-extrabold tabular-nums ${tones[tone]}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">{sub}</p> : null}
    </motion.div>
  );
}

function Row({ k, v, badge, tone }: { k: string; v: string; badge?: React.ReactNode; tone?: "error" }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-slate-500 dark:text-slate-400">{k}</span>
      {badge ?? (
        <span className={`truncate font-medium ${tone === "error" ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-200"}`} title={v}>
          {v}
        </span>
      )}
    </div>
  );
}
