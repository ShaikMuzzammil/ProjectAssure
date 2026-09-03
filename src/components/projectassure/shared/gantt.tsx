"use client";

import { useMemo, useState } from "react";
import type { Milestone } from "@/lib/projectassure/types";
import { formatDate } from "@/lib/projectassure/format";
import { MS_COLORS } from "./colors";

const DAY = 86400000;

export function GanttTimeline({ milestones }: { milestones: Milestone[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const { min, max } = useMemo(() => {
    const now = Date.now();
    const starts = milestones.map((m) => new Date(m.plannedDate).getTime());
    const ends = milestones.map((m) => (m.actualDate ? new Date(m.actualDate).getTime() : new Date(m.plannedDate).getTime()));
    const minT = Math.min(...starts, now - 30 * DAY);
    const maxT = Math.max(...ends, now + 30 * DAY);
    return { min: minT - 15 * DAY, max: maxT + 15 * DAY };
  }, [milestones]);

  const span = max - min;
  const nowPct = ((Date.now() - min) / span) * 100;

  /* each milestone bar: planned date → next planned date (or +30d) */
  const bars = milestones.map((m, i) => {
    const start = new Date(m.plannedDate).getTime();
    const next = i < milestones.length - 1 ? new Date(milestones[i + 1].plannedDate).getTime() : start + 30 * DAY;
    const end = Math.max(start + 14 * DAY, m.actualDate ? new Date(m.actualDate).getTime() + 7 * DAY : next);
    const left = ((start - min) / span) * 100;
    const width = Math.max(2.5, ((Math.min(end, max) - start) / span) * 100);
    return { m, left, width };
  });

  return (
    <div className="w-full">
      {/* header: months */}
      <div className="relative mb-2 h-5 border-b border-border">
        {getMonthTicks(min, max).map((t, i) => (
          <div key={i} className="absolute top-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground" style={{ left: `${t.pct}%` }}>
            {t.label}
          </div>
        ))}
      </div>

      <div className="relative space-y-2.5">
        {/* today line */}
        <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: `${nowPct}%` }}>
          <div className="h-full w-px bg-[#0c93e7]/70" />
          <span className="absolute -top-4 -translate-x-1/2 rounded bg-[#0c93e7] px-1.5 py-0.5 text-[9px] font-semibold text-white">TODAY</span>
        </div>

        {bars.map(({ m, left, width }) => {
          const color = MS_COLORS[m.status];
          const isHovered = hovered === m.id;
          return (
            <div key={m.id} className="group relative flex items-center gap-3">
              <div className="w-44 shrink-0 truncate text-xs font-medium sm:w-56" title={m.name}>
                {m.isCritical && <span className="mr-1 text-[10px] font-bold text-[#ef4444]">◆</span>}
                {m.name}
              </div>
              <div className="relative h-6 flex-1 rounded bg-muted/60">
                <div
                  className="absolute top-1 flex h-4 items-center rounded-sm px-1.5 text-[9px] font-semibold text-white shadow-sm transition-transform"
                  style={{ left: `${left}%`, width: `${width}%`, background: color, transform: isHovered ? "scaleY(1.25)" : undefined }}
                  onMouseEnter={() => setHovered(m.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {m.progress}%
                </div>
                {/* planned diamond */}
                <div
                  className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border border-white shadow"
                  style={{ left: `calc(${left}% - 4px)`, background: m.actualDate ? color : "#94a3b8" }}
                />
              </div>
              <div className="w-20 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                {formatDate(m.plannedDate).slice(0, 6)}
              </div>
            </div>
          );
        })}
      </div>

      {/* tooltip */}
      {hovered && (() => {
        const m = milestones.find((x) => x.id === hovered)!;
        return (
          <div className="mt-3 rounded-lg border border-border bg-card p-3 text-xs shadow-lg pa-fade-up">
            <div className="flex items-center justify-between gap-4">
              <span className="font-semibold">{m.name}</span>
              <span className="font-medium" style={{ color: MS_COLORS[m.status] }}>{m.status.replace("_", "-")}</span>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1 text-muted-foreground">
              <span>Planned: {formatDate(m.plannedDate)}</span>
              <span>Actual: {m.actualDate ? formatDate(m.actualDate) : "—"}</span>
              <span>Weight: {m.weight}{m.isCritical ? " (critical path)" : ""}</span>
              <span>Progress: {m.progress}%</span>
            </div>
          </div>
        );
      })()}

      {/* legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        {Object.entries(MS_COLORS).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm" style={{ background: v }} />{k.replace("_", "-").toLowerCase()}
          </span>
        ))}
        <span className="inline-flex items-center gap-1"><span className="text-[#ef4444]">◆</span>critical path</span>
      </div>
    </div>
  );
}

function getMonthTicks(min: number, max: number): { pct: number; label: string }[] {
  const ticks: { pct: number; label: string }[] = [];
  const d = new Date(min);
  d.setDate(1);
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const totalMonths = Math.ceil((max - min) / (30 * DAY));
  const step = Math.max(1, Math.ceil(totalMonths / 9)); // max ~9 ticks
  let k = 0;
  while (d.getTime() <= max) {
    if (d.getTime() >= min && k % step === 0) {
      ticks.push({ pct: ((d.getTime() - min) / (max - min)) * 100, label: totalMonths > 14 ? `${M[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` : M[d.getMonth()] });
    }
    d.setMonth(d.getMonth() + 1);
    k++;
  }
  return ticks;
}
