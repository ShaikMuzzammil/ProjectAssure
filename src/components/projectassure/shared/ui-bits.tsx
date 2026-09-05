"use client";

import React from "react";
import { motion } from "framer-motion";
import type { HealthStatus, AlertSeverity, ProjectStatus, MilestoneStatus, AiAnswer, TaskStatus } from "@/lib/projectassure/types";
import { cn } from "@/lib/utils";

export const HEALTH_COLORS: Record<HealthStatus, string> = { HEALTHY: "#22c55e", AT_RISK: "#f59e0b", CRITICAL: "#ef4444" };
export const HEALTH_TEXT: Record<HealthStatus, string> = { HEALTHY: "#15803d", AT_RISK: "#b45309", CRITICAL: "#b91c1c" };
export const HEALTH_BG: Record<HealthStatus, string> = { HEALTHY: "#dcfce7", AT_RISK: "#fef3c7", CRITICAL: "#fee2e2" };
export const HEALTH_LABEL: Record<HealthStatus, string> = { HEALTHY: "Healthy", AT_RISK: "At Risk", CRITICAL: "Critical" };

export function healthOf(score: number, amber = 75, red = 50): HealthStatus {
  return score >= amber ? "HEALTHY" : score >= red ? "AT_RISK" : "CRITICAL";
}

export function healthColor(score: number): string {
  return HEALTH_COLORS[healthOf(score)];
}

// ─── HealthRing: animated SVG donut ─────────────────────────────────────────
export function HealthRing({ score, size = 80, stroke, showLabel = true, animate = true, label }: { score: number; size?: number; stroke?: number; showLabel?: boolean; animate?: boolean; label?: string }) {
  const color = healthColor(score);
  const st = stroke ?? Math.max(5, Math.round(size * 0.085));
  const r = (size - st) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (1 - score / 100);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-border" strokeWidth={st} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={st} strokeLinecap="round"
          strokeDasharray={c} initial={animate ? { strokeDashoffset: c } : false}
          animate={{ strokeDashoffset: dash }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold tabular leading-none" style={{ color, fontSize: size * 0.26 }}>{Math.round(score)}</span>
        {showLabel && size >= 56 && <span className="mt-0.5 font-medium uppercase tracking-wide text-muted-foreground" style={{ fontSize: Math.max(8, size * 0.09) }}>{label ?? "health"}</span>}
      </div>
    </div>
  );
}

// ─── Badges ─────────────────────────────────────────────────────────────────
// v3: badge colours consume the theme-aware CSS vars from globals.css
// (:root AND .dark) — the old hardcoded hexes broke dark mode.
export function HealthBadge({ status, score, className }: { status: HealthStatus; score?: number; className?: string }) {
  const v = status === "HEALTHY" ? "healthy" : status === "AT_RISK" ? "atrisk" : "critical";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", className)}
      style={{ background: `var(--${v}-soft)`, color: `var(--${v}-text)` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: HEALTH_COLORS[status] }} />
      {HEALTH_LABEL[status]}{score !== undefined && <span className="ml-1 tabular opacity-70">{score}</span>}
    </span>
  );
}

const SEV_MAP: Record<AlertSeverity, { bg: string; text: string; dot: string }> = {
  CRITICAL: { bg: "var(--critical-soft)", text: "var(--critical-text)", dot: "#ef4444" },
  HIGH: { bg: "var(--sev-high-soft)", text: "var(--sev-high-text)", dot: "#f97316" },
  MEDIUM: { bg: "var(--atrisk-soft)", text: "var(--atrisk-text)", dot: "#f59e0b" },
  LOW: { bg: "var(--sev-low-soft)", text: "var(--sev-low-text)", dot: "#0c93e7" },
};

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const m = SEV_MAP[severity];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: m.bg, color: m.text }} >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.dot }} />
      {severity}
    </span>
  );
}

const STATUS_STYLE: Record<ProjectStatus, string> = {
  PLANNING: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  ACTIVE: "bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]",
  ON_HOLD: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  COMPLETED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  CANCELLED: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
};
export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold", STATUS_STYLE[status])}>{status.replace("_", " ")}</span>;
}

export const MS_COLORS: Record<MilestoneStatus, string> = {
  COMPLETED: "#22c55e", IN_PROGRESS: "#0c93e7", DELAYED: "#f59e0b", BLOCKED: "#ef4444", PENDING: "#94a3b8",
};
export function MsBadge({ status }: { status: MilestoneStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold"
      style={{ color: MS_COLORS[status], borderColor: `${MS_COLORS[status]}55`, background: `${MS_COLORS[status]}12` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: MS_COLORS[status] }} />{status}
    </span>
  );
}

export const TASK_COLUMN_COLORS: Record<TaskStatus, string> = {
  NOT_STARTED: "#94a3b8", IN_PROGRESS: "#0c93e7", COMPLETED: "#22c55e", BLOCKED: "#ef4444", CANCELLED: "#64748b",
};

export const SECTOR_COLORS: Record<string, string> = {
  Roads: "#0c93e7", Health: "#22c55e", Education: "#8b5cf6", Urban: "#14b8a6", Water: "#0b426e", Infrastructure: "#f59e0b",
};
export const CHART_COLORS = ["#0c93e7", "#0b426e", "#22c55e", "#f59e0b", "#8b5cf6", "#14b8a6"];

// ─── InfoTip: inline plain-language explainer (understandability layer) ────
// A small “?” chip; hover/tap reveals a plain-language explanation.
// Attach next to any metric label that could confuse a first-time visitor.
export function InfoTip({ label, body, className }: { label: string; body: string; className?: string }) {
  return (
    <span className={cn("group relative inline-flex", className)} tabIndex={0}>
      <span className="flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-muted-foreground/40 text-[8.5px] font-bold text-muted-foreground transition group-hover:border-[#0c93e7] group-hover:text-[#0c93e7] dark:group-hover:text-[#36adf6]">?</span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden w-56 -translate-x-1/2 rounded-lg border bg-popover p-2.5 text-left text-[11px] leading-relaxed text-popover-foreground shadow-xl group-hover:block group-focus-within:block">
        <strong className="block text-[11.5px]">{label}</strong>
        {body}
      </span>
      <span className="sr-only">{label}: {body}</span>
    </span>
  );
}

// ─── StatCard ───────────────────────────────────────────────────────────────
const TONES = {
  brand: { grad: "from-[#0b426e] to-[#0c93e7]", ring: "#0c93e7" },
  green: { grad: "from-emerald-600 to-emerald-400", ring: "#22c55e" },
  amber: { grad: "from-amber-600 to-amber-400", ring: "#f59e0b" },
  red: { grad: "from-rose-600 to-rose-400", ring: "#ef4444" },
  slate: { grad: "from-slate-700 to-slate-500", ring: "#64748b" },
  violet: { grad: "from-violet-600 to-violet-400", ring: "#8b5cf6" },
} as const;

export function StatCard({ title, value, unit, delta, deltaNote, tone = "brand", icon: Icon, onClick, delay = 0, footer }: {
  title: string; value: string | number; unit?: string; delta?: number; deltaNote?: string;
  tone?: keyof typeof TONES; icon?: React.ElementType; onClick?: () => void; delay?: number; footer?: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <motion.button
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={onClick ? { y: -3 } : undefined}
      onClick={onClick} disabled={!onClick}
      className={cn("group relative overflow-hidden rounded-xl border bg-card p-4 text-left shadow-sm transition-all",
        onClick && "cursor-pointer hover:shadow-md hover:shadow-black/5 active:scale-[0.99]")}
    >
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-90", t.grad)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-[26px] font-bold tabular leading-none text-foreground">{value}</span>
            {unit && <span className="text-xs font-medium text-muted-foreground">{unit}</span>}
          </div>
          {delta !== undefined && (
            <div className={cn("mt-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold",
              delta >= 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300")}>
              <svg viewBox="0 0 12 12" className={cn("h-3 w-3", delta < 0 && "rotate-180")} fill="currentColor"><path d="M6 1l5 9H1z" /></svg>
              {Math.abs(delta)} {deltaNote}
            </div>
          )}
          {footer}
        </div>
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: `${t.ring}14`, color: t.ring }}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </motion.button>
  );
}

// ─── ProgressBar ────────────────────────────────────────────────────────────
export function ProgressBar({ value, className, tone }: { value: number; className?: string; tone?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const color = tone ?? (v >= 75 ? "#22c55e" : v >= 50 ? "#0c93e7" : v >= 25 ? "#f59e0b" : "#ef4444");
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <motion.div className="h-full rounded-full" style={{ background: color }}
        initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
    </div>
  );
}

export function SectionTitle({ children, right, icon: Icon, sub, sub2 }: { children: React.ReactNode; right?: React.ReactNode; icon?: React.ElementType; sub?: string; sub2?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {Icon && <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0c93e7]/10 text-[#015ca0] dark:text-[#7cc8fb]"><Icon className="h-4.5 w-4.5" /></div>}
        <div>
          <h3 className="text-[15px] font-bold tracking-tight text-foreground">{children}</h3>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
          {sub2 && <div className="text-[10px] text-muted-foreground/70">{sub2}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}

// ─── Sparkline ──────────────────────────────────────────────────────────────
export function Sparkline({ points, color = "#0c93e7", width = 96, height = 28 }: { points: number[]; color?: string; width?: number; height?: number }) {
  if (points.length < 2) return null;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const path = points.map((p, i) => `${(i / (points.length - 1)) * width},${height - 3 - ((p - min) / span) * (height - 6)}`).join(" L ");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={`M ${path}`} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={height - 3 - ((points[points.length - 1] - min) / span) * (height - 6)} r={2.5} fill={color} />
    </svg>
  );
}

// ─── Markdown subset renderer (for AI answers & emails) ──────────────────────
export function Md({ text, className }: { text: string; className?: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0, key = 0;
  const inline = (s: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let rest = s, idx = 0;
    const rx = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(\d+)\])/g;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(rest))) {
      if (m.index > idx) parts.push(rest.slice(idx, m.index));
      if (m[2]) parts.push(<strong key={key++} className="font-bold text-foreground">{m[2]}</strong>);
      else if (m[3]) parts.push(<em key={key++}>{m[3]}</em>);
      else if (m[4]) parts.push(<code key={key++} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{m[4]}</code>);
      else if (m[5]) parts.push(<sup key={key++} className="rounded bg-[#e0effe] px-1 text-[9px] font-bold text-[#015ca0] dark:bg-[#0c93e7]/20 dark:text-[#7cc8fb]">{m[5]}</sup>);
      idx = m.index + m[0].length;
    }
    if (idx < rest.length) parts.push(rest.slice(idx));
    return parts;
  };
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("|") && line.includes("|", 1) && lines[i + 1]?.match(/^\|[\s:-]+\|/)) {
      const head = line.split("|").slice(1, -1).map(c => c.trim());
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].startsWith("|")) { rows.push(lines[i].split("|").slice(1, -1).map(c => c.trim())); i++; }
      blocks.push(
        <div key={key++} className="my-2 overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead><tr className="bg-muted/60">{head.map((h, hi) => <th key={hi} className="px-2.5 py-1.5 text-left font-semibold">{inline(h)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri} className="border-t">{r.map((c, ci) => <td key={ci} className="px-2.5 py-1.5">{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*[-•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-•]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-•]\s+/, "")); i++; }
      blocks.push(<ul key={key++} className="my-1.5 space-y-1 pl-1">{items.map((it, ii) => <li key={ii} className="flex gap-2 text-[13px] leading-relaxed"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#0c93e7]" />{inline(it)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; }
      blocks.push(<ol key={key++} className="my-1.5 space-y-1">{items.map((it, ii) => <li key={ii} className="flex gap-2 text-[13px] leading-relaxed"><span className="text-[11px] font-bold text-[#015ca0] dark:text-[#7cc8fb]">{ii + 1}.</span>{inline(it)}</li>)}</ol>);
      continue;
    }
    if (/^#{1,3}\s+/.test(line)) {
      blocks.push(<div key={key++} className="mt-2 mb-1 text-[13.5px] font-bold text-foreground">{inline(line.replace(/^#{1,3}\s+/, ""))}</div>);
      i++; continue;
    }
    if (!line.trim()) { i++; continue; }
    blocks.push(<p key={key++} className="my-1 text-[13px] leading-relaxed">{inline(line)}</p>);
    i++;
  }
  return <div className={cn("pa-md", className)}>{blocks}</div>;
}

// ─── Answer body (tool trace + citations + stamp) ───────────────────────────
export function AnswerBody({ answer }: { answer: AiAnswer }) {
  return (
    <div className="space-y-2.5">
      {answer.toolCalls.length > 0 && (
        <div className="rounded-lg border bg-muted/40 px-3 py-2">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 7V4h16v3M9 20h6M12 4v16" strokeLinecap="round" /></svg>
            Tool-call trace · {answer.toolCalls.length} calls
          </div>
          <div className="space-y-1">
            {answer.toolCalls.map((t, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px] leading-snug">
                <span className="mt-px rounded bg-[#e0effe] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]">{t.tool}</span>
                <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px]">{t.args}</span>
                <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 text-[9.5px] tabular text-muted-foreground">{t.durationMs}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <Md text={answer.answer} />
      {answer.citations.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sources</span>
          {answer.citations.map((c, i) => (
            <span key={i} className="inline-flex max-w-full items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[10px] text-muted-foreground" title={c.detail}>
              <span className="rounded-full bg-[#e0effe] px-1 font-bold text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]">{c.n}</span>
              <span className="truncate">{c.label}</span>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 border-t pt-2 text-[10px] text-muted-foreground">
        <span>{answer.dataFreshness}</span>
        <span className="flex items-center gap-2">
          <span className="rounded-full border px-1.5 py-0.5">intent: {answer.intent}</span>
          <span className={cn("rounded-full px-1.5 py-0.5 font-semibold", answer.source === "live-llm" ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300" : "bg-muted")}>
            {answer.source === "live-llm" ? "live intelligence" : "built-in engine"}
          </span>
        </span>
      </div>
    </div>
  );
}

// ─── EmptyState ─────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, body, action }: { icon: React.ElementType; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon className="h-6 w-6" /></div>
      <div className="mt-3 text-sm font-semibold text-foreground">{title}</div>
      {body && <div className="mt-1 max-w-sm text-xs text-muted-foreground">{body}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

// ─── Small gauge for budget utilisation ─────────────────────────────────────
export function MiniGauge({ value, size = 84, label, thresholds = [10, 20] }: { value: number; size?: number; label?: string; thresholds?: [number, number] }) {
  const v = Math.max(0, Math.min(120, value));
  const color = v > 100 + thresholds[1] ? "#ef4444" : v > 100 + thresholds[0] ? "#f59e0b" : "#22c55e";
  const st = 9, r = (size - st) / 2, c = 2 * Math.PI * r;
  const arc = 0.75; // 270°
  const filled = c * arc * Math.min(1, v / 120);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(135deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-border" strokeWidth={st} strokeDasharray={`${c * arc} ${c}`} strokeLinecap="round" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={st} strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`} initial={{ strokeDashoffset: 0 }} animate={{ strokeDashoffset: 0 }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold tabular leading-none" style={{ color, fontSize: size * 0.22 }}>{Math.round(value)}%</span>
        {label && <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}

export function Delta({ v, suffix = "" }: { v: number; suffix?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-semibold tabular", v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
      <svg viewBox="0 0 12 12" className={cn("h-2.5 w-2.5", v < 0 && "rotate-180")} fill="currentColor"><path d="M6 1l5 9H1z" /></svg>
      {Math.abs(v)}{suffix}
    </span>
  );
}

// ─── v4: PipelineStrip ──────────────────────────────────────────────────────
// One-line "how this screen works" strip: DATA → steps → outcome. Renders on
// key screens so first-time visitors understand the flow without reading docs.
export function PipelineStrip({ steps, className }: { steps: { label: string; hint?: string }[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg border bg-muted/30 px-3 py-1.5", className)}>
      <span className="mr-1 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">How this works</span>
      {steps.map((s, i) => (
        <React.Fragment key={s.label}>
          {i > 0 && <span className="text-[10px] text-muted-foreground/60">→</span>}
          <span className="group relative inline-flex items-center gap-1">
            <span className="rounded-md bg-background px-1.5 py-0.5 text-[10.5px] font-semibold text-foreground/85 shadow-sm dark:bg-background/60">
              {s.label}
            </span>
            {s.hint && (
              <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden w-52 -translate-x-1/2 rounded-lg border bg-popover p-2 text-left text-[10.5px] leading-relaxed text-popover-foreground shadow-xl group-hover:block">
                {s.hint}
              </span>
            )}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}
