"use client";

// v22 · Real-Time Tracking Dashboard
// ───────────────────────────────────────────────────────────────────────────
// Live milestone feed · interactive Gantt · automated status bars ·
// predictive delay alerts. Each milestone auto-updates from the live events
// stream (app-store.applyNextEvent) and the page re-renders every 5s with
// the freshest portfolio state.

import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "@/store/app-store";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, CalendarClock, CheckCircle2, Clock, Gauge,
  MapPin, PlayCircle, Timer, TrendingUp, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { shortDate, daysBetween, inrCompact } from "@/lib/projectassure/format";
import type { Project, Milestone } from "@/lib/projectassure/types";

const REFRESH_MS = 5000;

export default function TrackingView() {
  const projects = useApp(s => s.scoped());
  const user = useApp(s => s.user)!;
  const applyNextEvent = useApp(s => s.applyNextEvent);
  const liveEventsEnabled = useApp(s => s.liveEventsEnabled);
  const navigate = useApp(s => s.navigate);
  const [tick, setTick] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Real-time clock: re-render every 5s + apply next live event
  useEffect(() => {
    const t = setInterval(() => {
      setTick(x => x + 1);
      if (liveEventsEnabled) applyNextEvent();
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [liveEventsEnabled, applyNextEvent]);

  // Pick the project with the highest delay probability for the hero card
  const heroProject = useMemo(() => {
    if (!projects.length) return null;
    return [...projects].sort((a, b) =>
      (b.prediction?.probability ?? 0) - (a.prediction?.probability ?? 0)
    )[0];
  }, [projects, tick]);

  const selected = selectedId ? projects.find(p => p.id === selectedId) : heroProject;

  // Portfolio progress bands
  const bands = useMemo(() => {
    const total = projects.length;
    const done = projects.filter(p => p.status === "COMPLETED").length;
    const active = projects.filter(p => p.status === "ACTIVE").length;
    const onHold = projects.filter(p => p.status === "ON_HOLD").length;
    const planning = projects.filter(p => p.status === "PLANNING").length;
    const delayed = projects.filter(p => (p.prediction?.probability ?? 0) > 0.6).length;
    return { total, done, active, onHold, planning, delayed };
  }, [projects, tick]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#0c93e7]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Real-time tracking · live feed every {REFRESH_MS / 1000}s
          </div>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight sm:text-[26px]">Portfolio Tracking Dashboard</h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Automated milestone updates · geo-tagged photo verification · predictive delay alerts.
            Updated {new Date().toLocaleString("en-IN")}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg border bg-card px-3 py-1.5 text-[11px]">
            <span className="font-bold text-emerald-600">{bands.active}</span>
            <span className="text-muted-foreground"> active · </span>
            <span className="font-bold text-amber-600">{bands.delayed}</span>
            <span className="text-muted-foreground"> at-risk · </span>
            <span className="font-bold text-violet-600">{bands.done}</span>
            <span className="text-muted-foreground"> done</span>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <Kpi icon={Activity} label="Tracked projects" value={bands.total} tone="text-[#0c93e7]" />
        <Kpi icon={Clock} label="Active now" value={bands.active} tone="text-emerald-600" />
        <Kpi icon={AlertTriangle} label="At-risk (>60% delay)" value={bands.delayed} tone="text-amber-600" />
        <Kpi icon={Timer} label="On hold" value={bands.onHold} tone="text-rose-500" />
        <Kpi icon={CheckCircle2} label="Completed" value={bands.done} tone="text-violet-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        {/* LEFT — Gantt + milestone feed for the selected project */}
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Now tracking</div>
              <div className="truncate text-[15px] font-bold tracking-tight">{selected?.name ?? "—"}</div>
              <div className="text-[11px] text-muted-foreground">
                {selected?.state} · {selected?.district} · {(selected?.budgetL ?? 0) >= 1000 ? `₹${(selected!.budgetL / 1000).toFixed(1)}K Cr` : `₹${selected?.budgetL} L`}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Health</div>
              <div className={cn(
                "text-[22px] font-extrabold tabular leading-none",
                (selected?.health?.score ?? 0) >= 75 ? "text-emerald-600"
                  : (selected?.health?.score ?? 0) >= 50 ? "text-amber-600"
                  : "text-rose-600",
              )}>{selected?.health?.score.toFixed(0) ?? "—"}</div>
            </div>
          </div>

          {/* Milestone status bars — interactive */}
          <div className="space-y-2.5">
            {(selected?.milestones ?? []).slice(0, 8).map((m, i) => (
              <MilestoneBar key={m.id} m={m} index={i} />
            ))}
            {!selected?.milestones?.length && (
              <div className="rounded-lg border border-dashed p-6 text-center text-[12px] text-muted-foreground">
                No milestones yet.
              </div>
            )}
          </div>

          {/* Gantt-style mini timeline */}
          {selected && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-[11px]">
                <div className="font-bold uppercase tracking-widest text-muted-foreground">Schedule timeline</div>
                <button onClick={() => navigate("project-detail", { projectId: selected.id })}
                  className="font-semibold text-[#0c93e7] hover:underline">Open detail →</button>
              </div>
              <MiniGantt project={selected} />
            </div>
          )}
        </div>

        {/* RIGHT — Live milestone feed + delayed projects list */}
        <div className="space-y-4">
          {/* Live feed */}
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                <Zap className="h-3.5 w-3.5 text-amber-500" /> Live milestone feed
              </div>
              <span className="text-[10px] text-muted-foreground">refresh #{tick}</span>
            </div>
            <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
              {projects.slice(0, 6).map(p => {
                const last = p.milestones.filter(m => m.actualDate).slice(-1)[0] ?? p.milestones[0];
                if (!last) return null;
                const slip = last.actualDate ? daysBetween(last.plannedDate, last.actualDate) : 0;
                return (
                  <button key={p.id} onClick={() => setSelectedId(p.id)}
                    className={cn("flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition",
                      selected?.id === p.id ? "border-[#0c93e7] bg-[#e0effe]/50 dark:bg-[#0c93e7]/10" : "hover:bg-muted")}>
                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold",
                      last.status === "COMPLETED" ? "bg-emerald-500/15 text-emerald-600"
                        : last.status === "DELAYED" ? "bg-amber-500/15 text-amber-600"
                        : last.status === "IN_PROGRESS" ? "bg-sky-500/15 text-sky-600"
                        : "bg-muted text-muted-foreground")}>
                      {last.status === "COMPLETED" ? "✓" : last.status === "DELAYED" ? "!" : "·"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-semibold">{last.name}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{p.name.slice(0, 48)}{p.name.length > 48 ? "…" : ""}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-bold tabular">{slip > 0 ? `+${slip}d` : slip < 0 ? `${slip}d` : "on time"}</div>
                      <div className="text-[9.5px] text-muted-foreground">{shortDate(last.actualDate ?? last.plannedDate)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* At-risk projects list with predictive alerts */}
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Predictive delay alerts
            </div>
            <div className="space-y-2">
              {projects
                .filter(p => (p.prediction?.probability ?? 0) > 0.5)
                .sort((a, b) => (b.prediction?.probability ?? 0) - (a.prediction?.probability ?? 0))
                .slice(0, 5)
                .map(p => (
                  <button key={p.id} onClick={() => { setSelectedId(p.id); navigate("project-detail", { projectId: p.id }); }}
                    className="block w-full rounded-lg border bg-gradient-to-r from-amber-50/50 to-rose-50/30 p-3 text-left transition hover:border-amber-400/60 dark:from-amber-500/5 dark:to-rose-500/5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-[12.5px] font-bold">{p.psId} · {p.name.slice(0, 38)}{p.name.length > 38 ? "…" : ""}</div>
                      <div className="shrink-0 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                        {Math.round((p.prediction?.probability ?? 0) * 100)}%
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[10.5px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />Est. slip +{p.prediction?.estimatedDays ?? 0}d</span>
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{p.state}</span>
                      <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" />{inrCompact(p.budgetL * 1e5)}</span>
                    </div>
                    {p.prediction?.factors?.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {p.prediction.factors.slice(0, 3).map(f => (
                          <span key={f.label} className="rounded bg-amber-100/60 px-1.5 py-0.5 text-[9.5px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{f.label}</span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              {projects.filter(p => (p.prediction?.probability ?? 0) > 0.5).length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-center text-[11.5px] text-muted-foreground">
                  No projects above the 50% delay threshold right now.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Kpi({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-xl border bg-card p-3.5">
      <div className="flex items-center justify-between">
        <Icon className={cn("h-4 w-4", tone)} />
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      </div>
      <div className={cn("mt-1.5 text-[24px] font-extrabold tabular leading-none", tone)}>{value}</div>
    </div>
  );
}

function MilestoneBar({ m, index }: { m: Milestone; index: number }) {
  const progress = m.progress;
  const status = m.status;
  const tone =
    status === "COMPLETED" ? "bg-emerald-500"
    : status === "DELAYED" ? "bg-amber-500"
    : status === "IN_PROGRESS" ? "bg-[#0c93e7]"
    : "bg-muted-foreground/40";
  const slip = m.actualDate ? daysBetween(m.plannedDate, m.actualDate) : 0;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="group">
      <div className="mb-1 flex items-center justify-between gap-2 text-[11.5px]">
        <div className="flex items-center gap-1.5 truncate">
          {m.isCritical && <span className="rounded bg-rose-500/15 px-1 text-[9px] font-bold text-rose-600">CRIT</span>}
          <span className="truncate font-semibold">{m.name}</span>
        </div>
        <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
          <span>{shortDate(m.plannedDate)}</span>
          {slip > 0 && <span className="font-bold text-amber-600">+{slip}d</span>}
          {slip < 0 && <span className="font-bold text-emerald-600">{slip}d</span>}
          <span className="font-bold tabular">{progress}%</span>
        </div>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
          className={cn("h-full rounded-full", tone)} />
        {m.isCritical && (
          <div className="absolute right-0 top-0 h-full w-1 bg-rose-500" />
        )}
      </div>
    </motion.div>
  );
}

function MiniGantt({ project }: { project: Project }) {
  const tasks = [...project.tasks].slice(0, 6);
  if (!tasks.length) return <div className="rounded-lg border border-dashed p-4 text-center text-[11px] text-muted-foreground">No tasks scheduled.</div>;
  const times = tasks.flatMap(t => [new Date(t.plannedStart).getTime(), new Date(t.plannedEnd).getTime()]);
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = Math.max(max - min, 7 * 86400000);
  const px = (t: number) => ((t - min) / span) * 100;
  return (
    <div className="space-y-1.5">
      {tasks.map(t => {
        const start = new Date(t.plannedStart).getTime();
        const end = new Date(t.plannedEnd).getTime();
        const width = Math.max(((end - start) / span) * 100, 2);
        const tone = t.status === "COMPLETED" ? "bg-emerald-500/80"
          : t.status === "DELAYED" ? "bg-amber-500/80"
          : t.status === "IN_PROGRESS" ? "bg-[#0c93e7]/80"
          : "bg-muted-foreground/50";
        return (
          <div key={t.id} className="flex items-center gap-2">
            <div className="w-32 truncate text-[10.5px] text-muted-foreground">{t.name}</div>
            <div className="relative h-4 flex-1 rounded bg-muted/40">
              <div className={cn("absolute top-0.5 h-3 rounded", tone)}
                style={{ left: `${px(start)}%`, width: `${width}%` }} />
              {t.status === "IN_PROGRESS" && (
                <PlayCircle className="absolute top-1/2 h-3 w-3 -translate-y-1/2 text-[#0c93e7]"
                  style={{ left: `calc(${px(start) + width / 2}% - 6px)` }} />
              )}
            </div>
            <div className="w-12 text-right text-[10px] tabular text-muted-foreground">{t.progress}%</div>
          </div>
        );
      })}
    </div>
  );
}
