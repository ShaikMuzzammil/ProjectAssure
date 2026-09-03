/* ============================================================
 * ProjectAssure — Simulated ML engine (client-side)
 * Implements md/06_AI_ML_ENGINE.md:
 *  - Health score = 0.30*Schedule + 0.25*Budget + 0.20*Resources + 0.25*Milestones
 *  - 18-feature delay model -> log-odds -> sigmoid probability
 *  - Progress-deficit delay estimator + 90% CI
 *  - Prophet-style budget extrapolation + overrun detection
 * Model badge: "sim:xgboost-v2.1-18f" (prototype calibration)
 * ============================================================ */

import type { BudgetRecord, Milestone, PredictionFactor, PredictionResult, Project, ResourceAllocation, Task } from "./types";

export const MODEL_VERSION = "sim:xgboost-v2.1-18f";
export const HEALTH_WEIGHTS = { schedule: 0.30, budget: 0.25, resources: 0.20, milestones: 0.25 };

export interface MlFeatures {
  task_completion_rate: number;
  milestone_adherence: number;
  days_behind_schedule: number;
  budget_utilisation_rate: number;
  budget_burn_velocity: number;
  budget_velocity_deviation: number;
  critical_milestones_delayed: number;
  total_milestones_delayed: number;
  dependency_chain_health: number;
  resource_utilisation: number;
  resource_bottleneck_count: number;
  days_to_deadline: number;
  project_duration_months: number;
  elapsed_ratio: number;
  progress_vs_elapsed: number;
  weather_seasonality: number;
  procurement_delay_days: number;
  team_size_adequacy: number;
}

export const FEATURE_LABELS: Record<string, string> = {
  task_completion_rate: "Task completion rate",
  milestone_adherence: "Milestone adherence",
  days_behind_schedule: "Days behind schedule",
  budget_utilisation_rate: "Budget utilisation",
  budget_burn_velocity: "Burn velocity (3-mo avg)",
  budget_velocity_deviation: "Velocity deviation",
  critical_milestones_delayed: "Critical milestones delayed",
  total_milestones_delayed: "Milestones delayed",
  dependency_chain_health: "Dependency chain health",
  resource_utilisation: "Resource utilisation",
  resource_bottleneck_count: "Bottlenecked resources",
  days_to_deadline: "Days to deadline",
  project_duration_months: "Duration class",
  elapsed_ratio: "Elapsed timeline ratio",
  progress_vs_elapsed: "Progress vs elapsed",
  weather_seasonality: "Monsoon seasonality",
  procurement_delay_days: "Procurement pending days",
  team_size_adequacy: "Team size adequacy",
};

const DAY = 86400000;
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const NOW = new Date();

/* ── feature extraction (18 features from live data) ────── */
export function extractFeatures(p: Project): MlFeatures {
  const now = Date.now();
  const start = new Date(p.startDate).getTime();
  const target = new Date(p.targetDate).getTime();
  const durationDays = Math.max(30, (target - start) / DAY);
  const elapsed = clamp((now - start) / (durationDays * DAY), 0.02, 1.2);
  const daysToDeadline = Math.round((target - now) / DAY);
  const daysBehind = Math.max(0, Math.round((p.progress / 100 - elapsed) * durationDays));

  const tasks: Task[] = p.tasks;
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
  const taskCompletion = tasks.length ? completedTasks / tasks.length : p.progress / 100;

  const dueMilestones = p.milestones.filter((m) => new Date(m.plannedDate).getTime() <= now);
  const onTime = dueMilestones.filter((m) => m.status === "COMPLETED" || (m.status === "IN_PROGRESS" && m.progress > 50));
  const milestoneAdherence = dueMilestones.length ? onTime.length / dueMilestones.length : 1;
  const delayedMs = p.milestones.filter((m) => m.status === "DELAYED" || m.status === "BLOCKED");
  const criticalDelayed = delayedMs.filter((m) => m.isCritical).length;

  const budgetUtil = p.totalBudget ? p.spentBudget / p.totalBudget : 0;
  const burn3m = avgLast3Burn(p.budgetRecords);
  const planned3m = avgLast3Planned(p.budgetRecords);
  const burnVel = planned3m > 0 ? burn3m / planned3m : 1;

  const resUtil = p.resources.length ? avg(p.resources.map((r) => r.utilised)) / 100 : 0.75;
  const bottlenecks = p.resources.filter((r) => r.utilised > 90).length;

  const monsoon = NOW.getMonth() >= 5 && NOW.getMonth() <= 8 ? 1 : 0;

  const procurementDays = p.status === "ACTIVE" && delayedMs.length > 0 ? Math.round(6 + delayedMs.length * 4 + (p.health === "C" ? 8 : 0)) : clamp(Math.round(randJitter(p.id, "proc") * 6), 0, 12);
  const teamAdequacy = clamp(0.72 + (p.resourceScore / 100) * 0.35, 0.5, 1.05);
  const depHealth = clamp(1 - delayedMs.length * 0.14, 0.05, 1);

  return {
    task_completion_rate: round2(taskCompletion),
    milestone_adherence: round2(milestoneAdherence),
    days_behind_schedule: Math.max(0, daysBehind),
    budget_utilisation_rate: round2(budgetUtil),
    budget_burn_velocity: round2(burn3m),
    budget_velocity_deviation: round2(burnVel - 1),
    critical_milestones_delayed: criticalDelayed,
    total_milestones_delayed: delayedMs.length,
    dependency_chain_health: round2(depHealth),
    resource_utilisation: round2(resUtil),
    resource_bottleneck_count: bottlenecks,
    days_to_deadline: daysToDeadline,
    project_duration_months: Math.round(durationDays / 30),
    elapsed_ratio: round2(elapsed),
    progress_vs_elapsed: round2(elapsed > 0 ? p.progress / 100 / elapsed : 1),
    weather_seasonality: monsoon,
    procurement_delay_days: procurementDays,
    team_size_adequacy: round2(teamAdequacy),
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

function avgLast3Burn(records: BudgetRecord[]): number {
  const last = records.slice(-3);
  return last.length ? avg(last.map((r) => r.spent)) : 0;
}
function avgLast3Planned(records: BudgetRecord[]): number {
  const last = records.slice(-3);
  return last.length ? avg(last.map((r) => r.planned)) : 0;
}
/* deterministic jitter from string id */
function randJitter(id: string, salt: string): number {
  let h = 2166136261;
  const s = id + salt;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}

/* ── pseudo-SHAP contributions ──────────────────────────── */
interface Contribution { feature: keyof MlFeatures; w: number; bad: (v: number) => boolean; fmt: (v: number) => string; why: string; }

const CONTRIBUTIONS: Contribution[] = [
  { feature: "days_behind_schedule", w: 0.030, bad: (v) => v > 10, fmt: (v) => `${v} days behind`, why: "schedule drift is the strongest single predictor in the model" },
  { feature: "progress_vs_elapsed", w: -2.6, bad: (v) => v < 0.9, fmt: (v) => `${v.toFixed(2)} (target ≥ 0.95)`, why: "progress is falling behind the elapsed clock" },
  { feature: "critical_milestones_delayed", w: 0.34, bad: (v) => v > 0, fmt: (v) => `${v} critical milestone(s) delayed`, why: "critical-path blockage freezes downstream work" },
  { feature: "budget_velocity_deviation", w: 1.9, bad: (v) => Math.abs(v) > 0.15, fmt: (v) => `${(v * 100).toFixed(0)}% vs plan`, why: "spending momentum has diverged from plan" },
  { feature: "milestone_adherence", w: -1.7, bad: (v) => v < 0.8, fmt: (v) => `${(v * 100).toFixed(0)}% on-time`, why: "contractual milestone commitments are slipping" },
  { feature: "procurement_delay_days", w: 0.045, bad: (v) => v > 10, fmt: (v) => `${v} days pending`, why: "procurement is the most common hard blocker in public projects" },
  { feature: "weather_seasonality", w: 0.42, bad: (v) => v > 0, fmt: (v) => v ? "Jun-Sep monsoon window" : "off-monsoon", why: "India-specific seasonal interruption factor" },
  { feature: "resource_bottleneck_count", w: 0.22, bad: (v) => v > 0, fmt: (v) => `${v} bottlenecked`, why: "utilisation above 90% predicts queueing delays" },
  { feature: "task_completion_rate", w: -1.35, bad: (v) => v < 0.5, fmt: (v) => `${(v * 100).toFixed(0)}% tasks done`, why: "direct evidence of work actually done" },
  { feature: "dependency_chain_health", w: -1.5, bad: (v) => v < 0.7, fmt: (v) => `${(v * 100).toFixed(0)}% chains healthy`, why: "broken hand-offs freeze downstream tasks" },
  { feature: "team_size_adequacy", w: -1.1, bad: (v) => v < 0.8, fmt: (v) => `${(v * 100).toFixed(0)}% staffed`, why: "understaffing below 80% precedes slippage" },
  { feature: "days_to_deadline", w: -0.0018, bad: (v) => v < 90, fmt: (v) => `${v} days left`, why: "remaining runway interacts with every other factor" },
];

export function computeDelayPrediction(p: Project): PredictionResult {
  const f = extractFeatures(p);
  const atRiskStory = p.healthStatus !== "HEALTHY";

  /* base margin: healthy projects sit deep in negative territory */
  let margin = -2.35 + (100 - p.healthScore) / 55; // range roughly -2.35..-0.9
  const factors: PredictionFactor[] = [];

  for (const c of CONTRIBUTIONS) {
    const v = f[c.feature];
    let contribution = 0;
    if (c.bad(v)) {
      /* magnitude scales with severity of the "badness" */
      contribution = Math.abs(c.w) * (atRiskStory ? 1 : 0.4);
      if (c.feature === "days_behind_schedule") contribution = Math.min(2.2, v * 0.028);
      if (c.feature === "progress_vs_elapsed") contribution = clamp((1 - v) * 7.5, 0, 2.4) * (atRiskStory ? 1 : 0.35);
      if (c.feature === "procurement_delay_days") contribution = Math.min(1.4, v * 0.042) * (atRiskStory ? 1 : 0.3);
      if (c.feature === "milestone_adherence") contribution = clamp((0.95 - v) * 5.2, 0, 1.8) * (atRiskStory ? 1 : 0.3);
      if (c.feature === "budget_velocity_deviation") contribution = clamp(Math.abs(v) * 4.6, 0, 1.5) * (atRiskStory ? 1 : 0.3);
      if (c.feature === "weather_seasonality") contribution = v * 0.42 * (atRiskStory ? 1 : 0.35);
      if (c.feature === "critical_milestones_delayed") contribution = Math.min(1.6, v * 0.55) * (atRiskStory ? 1 : 0.3);
    }
    contribution = Math.round(contribution * 1000) / 1000;
    if (contribution !== 0 || c.feature === "progress_vs_elapsed") {
      factors.push({
        feature: c.feature, label: FEATURE_LABELS[c.feature], value: v,
        contribution, plainLanguage: `${c.fmt(v)} — ${c.why}`,
      });
    }
    margin += contribution;
  }

  /* blend feature-driven sigmoid with a health-score prior
     (calibration: health 58 ≈ 78%, health 75 ≈ 17%, health 90 ≈ 3%) */
  const pModel = sigmoid(margin);
  const pHealth = sigmoid((62 - p.healthScore) / 7);
  const probability = clamp(0.3 * pModel + 0.7 * pHealth, 0.02, 0.985);
  const deficit = Math.max(0, (1 - f.progress_vs_elapsed) * f.days_to_deadline);
  const estimatedDays = Math.round(clamp(deficit, 4, 240) * (0.5 + 0.6 * probability));
  const ciWidth = Math.round(estimatedDays * 0.32 + 6);
  const confidence = round2(clamp(0.62 + (f.progress_vs_elapsed < 1 ? 0.14 : 0.06) + (atRiskStory ? 0.1 : 0.05) - Math.abs(probability - 0.5) * 0.18, 0.5, 0.93));

  factors.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return {
    id: `${p.id}-pred`, projectId: p.id, predictionType: "delay",
    probability: Math.round(probability * 1000) / 1000,
    estimatedDays, ciLower: Math.max(1, estimatedDays - ciWidth), ciUpper: estimatedDays + ciWidth,
    confidence, factors: factors.slice(0, 6), modelVersion: MODEL_VERSION,
    computedAt: new Date().toISOString(),
  };
}

/* ── budget forecast (Prophet-style extrapolation) ──────── */
export interface ForecastPoint { month: string; planned: number; actual: number | null; projected: number | null; upper: number | null; lower: number | null; }

export function computeBudgetForecast(p: Project): { points: ForecastPoint[]; projectedFinal: number; overrunPct: number; months: number; } {
  const recs = p.budgetRecords;
  const totalMonths = Math.max(recs.length + 6, Math.round((new Date(p.targetDate).getTime() - new Date(p.startDate).getTime()) / DAY / 30));
  const plannedPerMonth = p.totalBudget / totalMonths;
  const recent = recs.slice(-4);
  const avgBurn = recent.length ? avg(recent.map((r) => r.spent)) : plannedPerMonth;
  const trend = recent.length >= 2 ? (recent[recent.length - 1].spent - recent[0].spent) / (recent.length - 1) : 0;

  const points: ForecastPoint[] = [];
  const d0 = recs.length ? new Date(recs[0].year, recs[0].month - 1, 1) : new Date();
  let cumActual = recs.reduce((s, r) => s + r.spent, 0);
  let cumPlanned = 0;
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  recs.forEach((r, i) => {
    cumPlanned += r.planned;
    const d = new Date(d0.getTime());
    d.setMonth(d.getMonth() + i);
    points.push({ month: `${M[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, planned: Math.round(cumPlanned), actual: Math.round(cumActual0(points, recs, i)), projected: null, upper: null, lower: null });
  });

  let cumProj = cumActual;
  const monthsAheadN = Math.max(6, totalMonths - recs.length);
  for (let i = 1; i <= monthsAheadN; i++) {
    cumPlanned += plannedPerMonth;
    cumProj += avgBurn + trend * i * 0.35;
    const d = new Date(d0.getTime());
    d.setMonth(d.getMonth() + recs.length + i - 1);
    const spread = 3 + i * 0.9;
    points.push({
      month: `${M[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      planned: Math.round(cumPlanned), actual: null, projected: Math.round(cumProj),
      upper: Math.round(cumProj * (1 + spread / 100)), lower: Math.round(cumProj * (1 - spread / 100)),
    });
  }

  const projectedFinal = Math.round(cumProj);
  const overrunPct = Math.round(((projectedFinal - p.totalBudget) / p.totalBudget) * 1000) / 10;
  return { points, projectedFinal, overrunPct, months: totalMonths };
}

function cumActual0(_points: ForecastPoint[], recs: BudgetRecord[], i: number): number {
  return recs.slice(0, i + 1).reduce((s, r) => s + r.spent, 0);
}

/* ── health score sub-components (doc 06 Part D) ────────── */
export function computeHealth(p: Project): { schedule: number; budget: number; resources: number; milestones: number; total: number } {
  const f = extractFeatures(p);

  const PR = clamp(f.progress_vs_elapsed, 0, 1);
  const TD = clamp(1 - f.days_behind_schedule / 90, 0, 1);
  const schedule = 100 * (0.5 * PR + 0.5 * TD);

  const burnRatio = f.elapsed_ratio > 0 ? f.budget_utilisation_rate / f.elapsed_ratio : 1;
  const BR = clamp(1 - Math.abs(burnRatio - 1) / 0.25, 0, 1);
  const VR = clamp(1 - Math.abs(f.budget_velocity_deviation) / 0.35, 0, 1);
  const overrunPct = Math.max(0, ((p.projectedBudget - p.totalBudget) / p.totalBudget) * 100);
  const OR = clamp(1 - overrunPct / 15, 0, 1);
  const budget = 100 * (0.35 * BR + 0.25 * VR + 0.40 * OR);

  const u = f.resource_utilisation;
  const UB = u > 0.85 ? 1 - Math.max(0, (u - 0.85) / 0.15) : 1 - Math.max(0, (0.6 - u) / 0.6);
  const BN = clamp(1 - f.resource_bottleneck_count / 5, 0, 1);
  const TA = clamp(f.team_size_adequacy, 0, 1);
  const resources = 100 * (0.45 * UB + 0.30 * BN + 0.25 * TA);

  const now = Date.now();
  const due = p.milestones.filter((m) => new Date(m.plannedDate).getTime() <= now);
  const onTime = due.filter((m) => m.status === "COMPLETED");
  const MA = due.length ? onTime.length / due.length : 1;
  const slip = p.milestones.filter((m) => m.status === "DELAYED" || m.status === "BLOCKED").length;
  const SS = clamp(1 - slip / 4, 0, 1);
  const critDelayed = p.milestones.filter((m) => m.isCritical && (m.status === "DELAYED" || m.status === "BLOCKED")).length;
  const CD = clamp(1 - critDelayed / 2, 0, 1);
  const milestones = 100 * (0.45 * MA + 0.35 * SS + 0.20 * CD);

  const total = HEALTH_WEIGHTS.schedule * schedule + HEALTH_WEIGHTS.budget * budget + HEALTH_WEIGHTS.resources * resources + HEALTH_WEIGHTS.milestones * milestones;
  return { schedule: round1(schedule), budget: round1(budget), resources: round1(resources), milestones: round1(milestones), total: round1(total) };
}

const round1 = (v: number) => Math.round(v * 10) / 10;
