"use client";

import { motion } from "framer-motion";
import type { HealthStatus } from "@/lib/projectassure/types";

/* ── colour helpers ─────────────────────────────────────── */
export const HEALTH_COLORS: Record<HealthStatus, string> = {
  HEALTHY: "#22c55e",
  AT_RISK: "#f59e0b",
  CRITICAL: "#ef4444",
};
export const HEALTH_TEXT: Record<HealthStatus, string> = {
  HEALTHY: "text-[#15803d]",
  AT_RISK: "text-[#b45309]",
  CRITICAL: "text-[#b91c1c]",
};
export const HEALTH_BG: Record<HealthStatus, string> = {
  HEALTHY: "bg-[#dcfce7] dark:bg-[#22c55e]/15",
  AT_RISK: "bg-[#fef3c7] dark:bg-[#f59e0b]/15",
  CRITICAL: "bg-[#fee2e2] dark:bg-[#ef4444]/15",
};

export function healthOf(score: number): HealthStatus {
  return score >= 75 ? "HEALTHY" : score >= 50 ? "AT_RISK" : "CRITICAL";
}

/* ── animated health ring (SVG donut) ───────────────────── */
export function HealthRing({
  score,
  size = 80,
  stroke = 8,
  showLabel = true,
  animate = true,
}: {
  score: number;
  size?: number;
  stroke?: number;
  showLabel?: boolean;
  animate?: boolean;
}) {
  const status = healthOf(score);
  const color = HEALTH_COLORS[status];
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, score)) / 100);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} className="dark:opacity-20" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={animate ? { strokeDashoffset: c } : false}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-bold tabular-nums leading-none" style={{ fontSize: size * 0.28, color }}>
            {Math.round(score)}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── health badge ───────────────────────────────────────── */
export function HealthBadge({ status, score, className = "" }: { status: HealthStatus; score?: number; className?: string }) {
  const label = status === "HEALTHY" ? "Healthy" : status === "AT_RISK" ? "At Risk" : "Critical";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${HEALTH_BG[status]} ${HEALTH_TEXT[status]} ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: HEALTH_COLORS[status] }} />
      {label}{score !== undefined ? ` · ${Math.round(score)}` : ""}
    </span>
  );
}

/* ── severity badge ─────────────────────────────────────── */
const SEV_MAP = {
  CRITICAL: { bg: "bg-[#fee2e2] dark:bg-[#ef4444]/15", text: "text-[#b91c1c] dark:text-red-300", dot: "#ef4444" },
  HIGH: { bg: "bg-[#ffedd5] dark:bg-[#f97316]/15", text: "text-[#c2410c] dark:text-orange-300", dot: "#f97316" },
  MEDIUM: { bg: "bg-[#fef3c7] dark:bg-[#f59e0b]/15", text: "text-[#b45309] dark:text-amber-300", dot: "#f59e0b" },
  LOW: { bg: "bg-[#e0effe] dark:bg-[#0c93e7]/15", text: "text-[#015ca0] dark:text-sky-300", dot: "#0c93e7" },
};
export function SeverityBadge({ severity }: { severity: keyof typeof SEV_MAP }) {
  const s = SEV_MAP[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
      {severity}
    </span>
  );
}

/* ── status badge ───────────────────────────────────────── */
const STATUS_MAP: Record<string, string> = {
  ACTIVE: "bg-[#dcfce7] text-[#15803d] dark:bg-green-500/15 dark:text-green-300",
  PLANNING: "bg-[#e0effe] text-[#015ca0] dark:bg-sky-500/15 dark:text-sky-300",
  ON_HOLD: "bg-[#fef3c7] text-[#b45309] dark:bg-amber-500/15 dark:text-amber-300",
  COMPLETED: "bg-[#bae0fd] text-[#064f85] dark:bg-blue-500/15 dark:text-blue-300",
  CANCELLED: "bg-[#f1f5f9] text-[#64748b] dark:bg-slate-500/15 dark:text-slate-300",
};
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_MAP[status] ?? STATUS_MAP.PLANNING}`}>
      {status.replace("_", "-")}
    </span>
  );
}

/* ── KPI stat card ──────────────────────────────────────── */
export function StatCard({
  label, value, sub, icon, tone = "brand", delay = 0, onClick, delta,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  tone?: "brand" | "green" | "amber" | "red";
  delay?: number;
  onClick?: () => void;
  delta?: string;
}) {
  const tones = {
    brand: "from-[#0c93e7]/10 to-transparent text-[#0c93e7]",
    green: "from-[#22c55e]/10 to-transparent text-[#16a34a]",
    amber: "from-[#f59e0b]/10 to-transparent text-[#d97706]",
    red: "from-[#ef4444]/10 to-transparent text-[#dc2626]",
  };
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${tones[tone]} opacity-60`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          <span className={`rounded-md p-1.5 ${tones[tone].split(" ").pop()}`}>{icon}</span>
        </div>
        <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        {delta && <p className="mt-1 text-xs font-medium text-[#16a34a]">{delta}</p>}
      </div>
    </motion.button>
  );
}

/* ── progress bar ───────────────────────────────────────── */
export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  const color = value >= 75 ? "#22c55e" : value >= 50 ? "#0c93e7" : value >= 25 ? "#f59e0b" : "#ef4444";
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-muted ${className}`}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

/* ── section header ─────────────────────────────────────── */
export function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
