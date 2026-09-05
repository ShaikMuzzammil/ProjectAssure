"use client";

import React, { useMemo, useState } from "react";
import type { Project, Task, Milestone } from "@/lib/projectassure/types";
import { MS_COLORS, TASK_COLUMN_COLORS } from "./ui-bits";
import { shortDate, daysBetween } from "@/lib/projectassure/format";
import { cn } from "@/lib/utils";
import { ZoomIn, ZoomOut } from "lucide-react";

const DAY = 86400000;
const MS_IN = { day: 1, week: 0.35, month: 0.14 } as const;

export default function GanttTimeline({ project }: { project: Project }) {
  type ZoomLevel = "day" | "week" | "month";
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [hover, setHover] = useState<Task | null>(null);

  const tasks = useMemo(() => [...project.tasks].sort((a, b) => new Date(a.plannedStart).getTime() - new Date(b.plannedStart).getTime() || a.name.localeCompare(b.name)), [project.tasks]);
  const milestones = useMemo(() => [...project.milestones].sort((a, b) => a.order - b.order), [project.milestones]);

  const bounds = useMemo(() => {
    const times = [...tasks.flatMap(t => [new Date(t.plannedStart).getTime(), new Date(t.plannedEnd).getTime()]), ...milestones.map(m => new Date(m.plannedDate).getTime())];
    if (!times.length) return { min: Date.now() - 30 * DAY, max: Date.now() + 90 * DAY };
    const min = Math.min(...times) - 15 * DAY, max = Math.max(...times) + 15 * DAY;
    return { min, max: Math.max(max, min + 60 * DAY) };
  }, [tasks, milestones]);

  const now = new Date("2026-09-10T09:00:00+05:30").getTime();
  const span = bounds.max - bounds.min;
  const px = (t: number) => ((t - bounds.min) / span) * 100;
  const totalDays = Math.round(span / DAY);
  const labelW = 178;

  const ticks = useMemo(() => {
    const out: { left: number; label: string }[] = [];
    const stepDays = Math.max(7, Math.round(totalDays / (zoom === "day" ? 24 : zoom === "week" ? 12 : 8)));
    const start = Math.ceil((bounds.min - now) / DAY) * DAY + now;
    for (let t = start; t <= bounds.max; t += stepDays * DAY) {
      const d = new Date(t);
      out.push({ left: px(t), label: zoom === "day" ? `${d.getDate()} ${d.toLocaleString("en", { month: "short" })}` : d.toLocaleString("en", { month: "short", year: "2-digit" }) });
    }
    return out;
  }, [bounds, zoom, totalDays, now]);

  // critical path: tasks on critical milestones OR dependency chains into them
  const criticalTaskIds = useMemo(() => {
    const critMs = new Set(milestones.filter(m => m.isCritical).map(m => m.id));
    const set = new Set(tasks.filter(t => critMs.has(t.milestoneId)).map(t => t.id));
    let grew = true;
    while (grew) { // pull in upstream dependencies
      grew = false;
      for (const t of tasks) if (!set.has(t.id) && t.dependsOn.some(d => set.has(d))) { set.add(t.id); grew = true; }
    }
    return set;
  }, [tasks, milestones]);

  const taskById = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);
  const todayLeft = px(Math.min(Math.max(now, bounds.min), bounds.max));

  const scale = MS_IN[zoom];
  const rowH = 26;

  const depLines = useMemo(() => {
    const idx = new Map(tasks.map((t, i) => [t.id, i]));
    const lines: { from: Task; to: Task }[] = [];
    for (const t of tasks) for (const d of t.dependsOn) { const dep = taskById.get(d); if (dep) lines.push({ from: dep, to: t }); }
    return lines;
  }, [tasks, taskById]);

  if (!tasks.length) return <div className="rounded-xl border border-dashed p-8 text-center text-[12.5px] text-muted-foreground">No tasks yet — add milestones & tasks to populate the Gantt.</div>;

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11.5px] text-muted-foreground">
          {tasks.length} tasks · {depLines.length} dependency edges · {criticalTaskIds.size} on critical path (diamond milestones)
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setZoom(z => (z === "month" ? "week" : z === "week" ? "day" : "day"))} className="flex items-center gap-1 rounded-md border px-2 py-1 text-[10.5px] font-semibold hover:bg-muted"><ZoomIn className="h-3 w-3" />Zoom</button>
          <button onClick={() => setZoom(z => (z === "day" ? "week" : z === "week" ? "month" : "month"))} className="flex items-center gap-1 rounded-md border px-2 py-1 text-[10.5px] font-semibold hover:bg-muted"><ZoomOut className="h-3 w-3" />Out</button>
        </div>
      </div>
      <div className="custom-scrollbar overflow-x-auto rounded-xl border bg-card">
        <div className="min-w-[680px]">
          {/* header ticks */}
          <div className="flex border-b bg-muted/40">
            <div className="shrink-0 border-r" style={{ width: labelW }} />
            <div className="relative h-7 flex-1">
              {ticks.map((t, i) => (
                <div key={i} className="absolute top-0 h-full border-l border-border/60 pl-1 text-[9px] font-medium tabular text-muted-foreground" style={{ left: `${t.left}%` }}>{t.label}</div>
              ))}
            </div>
          </div>
          {/* rows */}
          <div className="relative" style={{ minHeight: tasks.length * rowH + 34 }}>
            {/* today line */}
            <div className="absolute top-0 z-10 h-full" style={{ left: `calc(${labelW}px + ${todayLeft}% * (100% - ${labelW}px) / 100)` }}>
              <div className="h-full w-px bg-[#0c93e7]/70" />
              <div className="absolute -top-0 -left-4 rounded bg-[#0c93e7] px-1 py-px text-[8px] font-bold text-white">TODAY</div>
            </div>
            {tasks.map((t, i) => {
              const left = px(new Date(t.plannedStart).getTime());
              const width = Math.max(0.8, px(new Date(t.plannedEnd).getTime()) - left);
              const color = TASK_COLUMN_COLORS[t.status];
              const crit = criticalTaskIds.has(t.id);
              return (
                <div key={t.id} className="flex border-b border-border/40 hover:bg-muted/20" style={{ height: rowH }}>
                  <div className="flex shrink-0 items-center gap-1.5 overflow-hidden border-r px-2" style={{ width: labelW }}>
                    {crit && <span className="text-[9px] text-[#ef4444]">◆</span>}
                    <span className="truncate text-[10.5px] font-medium" title={t.name}>{t.name}</span>
                  </div>
                  <div className="relative flex-1" onMouseEnter={() => setHover(t)} onMouseLeave={() => setHover(null)}>
                    <div className="absolute top-1/2 h-px w-full bg-border/30" />
                    <div
                      className={cn("absolute top-1/2 h-[9px] -translate-y-1/2 rounded-[3px] cursor-pointer transition-shadow", hover?.id === t.id && "shadow-md")}
                      style={{ left: `${left}%`, width: `${width * scale < 0.6 ? 0.6 : width * scale}%`, background: color, outline: crit ? "1.5px solid #ef4444" : "none", outlineOffset: 1 }}
                    >
                      {width > 6 && <div className="h-full rounded-[3px] bg-white/25" style={{ width: `${t.progress}%` }} />}
                    </div>
                    <span className="absolute top-1/2 -translate-y-1/2 rounded px-1 text-[8.5px] tabular font-semibold" style={{ left: `calc(${left}% + ${(width * scale < 0.6 ? 0.6 : width * scale)}% + 4px)`, color }}>{t.progress}%</span>
                    {hover?.id === t.id && (
                      <div className="absolute z-20 w-52 rounded-lg border bg-popover p-2.5 text-[10.5px] shadow-xl" style={{ left: `min(${left}%, 55%)`, top: 26 }}>
                        <div className="font-bold">{t.name}</div>
                        <div className="mt-1 space-y-0.5 text-muted-foreground">
                          <div>Status: <strong style={{ color }}>{t.status.replace("_", " ")}</strong></div>
                          <div>Planned: {shortDate(t.plannedStart)} → {shortDate(t.plannedEnd)} ({daysBetween(t.plannedStart, t.plannedEnd)}d)</div>
                          <div>Assignee: {t.assignee}</div>
                          <div>Progress: {t.progress}% · {crit ? "critical path" : "has float"}</div>
                          {t.dependsOn.length > 0 && <div>Depends on: {t.dependsOn.map(d => taskById.get(d)?.name.split("—")[0]).join(", ")}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {/* dependency edges */}
            <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full" style={{ paddingLeft: labelW }}>
              {depLines.map(({ from, to }, i) => {
                const fi = tasks.findIndex(x => x.id === from.id), ti = tasks.findIndex(x => x.id === to.id);
                if (fi < 0 || ti < 0) return null;
                const x1 = (px(new Date(from.plannedEnd).getTime()) / 100) * (100) * scale, y1 = fi * rowH + rowH / 2;
                const x2 = (px(new Date(to.plannedStart).getTime()) / 100) * scale, y2 = ti * rowH + rowH / 2;
                if (x1 > x2) return null; // don't render weird back edges
                return <line key={i} x1={`${x1}%`} y1={y1} x2={`${x2}%`} y2={y2} stroke="#94a3b8" strokeWidth={1} strokeDasharray="2 2" opacity={0.6} />;
              })}
            </svg>
            {/* milestone diamonds */}
            <div className="absolute bottom-0 left-0 flex h-8 items-center gap-2 border-t bg-muted/30 px-2 text-[9px] font-semibold text-muted-foreground" style={{ width: labelW }}>
              <span className="text-[#ef4444]">◆</span> milestone flags →
            </div>
            <div className="absolute bottom-0 left-0 h-8 w-full border-t bg-muted/20">
              {milestones.map(m => {
                const left = px(new Date(m.plannedDate).getTime()) * scale;
                return (
                  <div key={m.id} className="absolute bottom-1 -translate-x-1/2" style={{ left: `calc(${labelW}px + ${left}% )` }} title={`${m.name} · ${shortDate(m.plannedDate)}`}>
                    <div className="h-3 w-3 rotate-45 rounded-[2px]" style={{ background: MS_COLORS[m.status], border: m.isCritical ? "1.5px solid #ef4444" : "1px solid #ffffff88" }} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-medium text-muted-foreground">
        {[["Completed", "#22c55e"], ["In progress", "#0c93e7"], ["Blocked", "#ef4444"], ["Not started", "#94a3b8"], ["Critical path", "#ef4444"]].map(([l, c]) => (
          <span key={l} className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm" style={{ background: c }} />{l}</span>
        ))}
        <span className="ml-auto">Dashed lines = dependencies (finish-to-start)</span>
      </div>
    </div>
  );
}
