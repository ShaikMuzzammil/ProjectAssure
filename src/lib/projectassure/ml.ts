// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure — ML Engine (deterministic in-browser simulation of the
// production stack: predictive delay engine + cost forecaster +
// factor-attribution explainability). Implements the exact documented formulas.
// ═══════════════════════════════════════════════════════════════════════════
import type { Project, PredictionFactor, PredictionResult, ModelVersion, ThresholdSettings } from "./types";
import { HEALTH_WEIGHTS } from "./types";
import { clamp } from "./format";
import { ANCHOR } from "./doc-corpus";

export const MODEL_VERSION = "AssurePredict 2.3";

export const MODEL_REGISTRY: ModelVersion[] = [
  {
    version: "AssurePredict 2.3",
    trainedAt: "2026-08-24T03:00:00+05:30",
    trainedOn: 5000,
    metrics: { auc: 0.912, accuracy: 0.842, precision: 0.814, recall: 0.831, f1: 0.822, maeDays: 18.4, brier: 0.118, ece: 0.041 },
    status: "champion",
    notes: "18 risk signals, calibrated , Auto-tuned over 50 trials. Current production candidate.",
  },
  {
    version: "AssurePredict 2.2",
    trainedAt: "2026-06-11T03:00:00+05:30",
    trainedOn: 4200,
    metrics: { auc: 0.889, accuracy: 0.821, precision: 0.798, recall: 0.804, f1: 0.801, maeDays: 21.7, brier: 0.134, ece: 0.058 },
    status: "retired",
    notes: "Champion until Aug 2026; retired after drift >0.2 drift trigger on procurement features.",
  },
];

export const FEATURE_LABELS: Record<string, string> = {
  task_completion_rate: "Task completion rate",
  milestone_adherence: "Milestone adherence",
  days_behind_schedule: "Days behind schedule",
  budget_utilisation_rate: "Budget utilisation rate",
  budget_burn_velocity: "Budget burn velocity",
  budget_velocity_deviation: "Burn velocity deviation",
  critical_milestones_delayed: "Critical milestones delayed",
  total_milestones_delayed: "Total milestones delayed",
  dependency_chain_health: "Dependency-chain health",
  resource_utilisation: "Resource utilisation",
  resource_bottleneck_count: "Resource bottlenecks",
  days_to_deadline: "Days to deadline",
  project_duration_months: "Project duration (months)",
  elapsed_ratio: "Elapsed ratio",
  progress_vs_elapsed: "Progress vs elapsed",
  weather_seasonality: "Monsoon seasonality",
  procurement_delay_days: "Procurement pending days",
  team_size_adequacy: "Team size adequacy",
};

export interface MlFeatures {
  task_completion_rate: number; milestone_adherence: number; days_behind_schedule: number;
  budget_utilisation_rate: number; budget_burn_velocity: number; budget_velocity_deviation: number;
  critical_milestones_delayed: number; total_milestones_delayed: number; dependency_chain_health: number;
  resource_utilisation: number; resource_bottleneck_count: number; days_to_deadline: number;
  project_duration_months: number; elapsed_ratio: number; progress_vs_elapsed: number;
  weather_seasonality: number; procurement_delay_days: number; team_size_adequacy: number;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function extractFeatures(p: Project, now: Date = ANCHOR): MlFeatures {
  const start = new Date(p.startDate).getTime();
  const target = new Date(p.targetDate).getTime();
  const nowT = now.getTime();
  const durationDays = Math.max(30, (target - start) / 86400000);
  const elapsed = clamp((nowT - start) / (target - start), 0, 1);
  const daysToDeadline = Math.max(0, Math.round((target - nowT) / 86400000));

  const tasks = p.tasks.filter(t => t.status !== "CANCELLED");
  const doneTasks = tasks.filter(t => t.status === "COMPLETED").length;
  const taskCompletion = tasks.length ? doneTasks / tasks.length : 0;

  const ms = p.milestones;
  const dueMs = ms.filter(m => new Date(m.plannedDate).getTime() <= nowT + 30 * 86400000);
  const onTime = dueMs.filter(m => m.status === "COMPLETED" && (!m.actualDate || new Date(m.actualDate) <= new Date(m.plannedDate))).length;
  const adherence = dueMs.length ? onTime / dueMs.length : 1;
  const delayedMs = ms.filter(m => m.status === "DELAYED" || m.status === "BLOCKED");
  const criticalDelayed = delayedMs.filter(m => m.isCritical).length;

  // dependency chain health: share of tasks whose dependencies completed on time
  const blockedByDeps = tasks.filter(t => t.dependsOn.some(d => {
    const dep = tasks.find(x => x.id === d);
    return dep ? dep.status !== "COMPLETED" : false;
  })).length;
  const depHealth = tasks.length ? clamp(1 - blockedByDeps / tasks.length * 1.6, 0, 1) : 1;

  const spent = p.spentBudget;
  const util = p.totalBudget > 0 ? spent / p.totalBudget : 0;
  const last3 = p.budgetRecords.slice(-3);
  const burnVel = last3.length ? last3.reduce((s, r) => s + r.spent, 0) / last3.length : 0;
  const planVel = last3.length ? last3.reduce((s, r) => s + r.planned, 0) / last3.length : 1;
  const velDev = planVel > 0 ? (burnVel - planVel) / planVel : 0;

  const res = p.resources;
  const utilisation = res.length ? res.reduce((s, r) => s + r.utilised, 0) / res.length / 100 : 0.6;
  const bottlenecks = res.filter(r => r.utilised > 90).length;

  // v4: early-phase neutrality — a project in its first ~1 month (or still
  // before its start date) has no slippage *evidence* yet. Penalising a
  // day-0 project to "At Risk 69" made new projects look broken the moment
  // they were created. Treat no-evidence as neutral, not as failure.
  const earlyPhase = elapsed < 0.04 || p.status === "PLANNING" && elapsed < 0.12;
  const progressVsElapsed = earlyPhase ? 1 : (elapsed > 0 ? p.progress / 100 / elapsed : 1);
  const daysBehind = earlyPhase ? 0 : Math.max(0, Math.round((1 - clamp(progressVsElapsed, 0, 1.5)) * durationDays * elapsed));

  const month = now.getMonth() + 1;
  const monsoon = month >= 6 && month <= 9 ? 1 : 0;
  const procurement = 4 + criticalDelayed * 7 + delayedMs.length * 3 + (p.status === "ON_HOLD" ? 20 : 0);
  const teamAdequacy = clamp(0.72 + p.resourceScore * 0.0035, 0.5, 1.05);

  return {
    task_completion_rate: +taskCompletion.toFixed(3),
    milestone_adherence: +adherence.toFixed(3),
    days_behind_schedule: daysBehind,
    budget_utilisation_rate: +util.toFixed(3),
    budget_burn_velocity: +burnVel.toFixed(1),
    budget_velocity_deviation: +velDev.toFixed(3),
    critical_milestones_delayed: criticalDelayed,
    total_milestones_delayed: delayedMs.length,
    dependency_chain_health: +depHealth.toFixed(3),
    resource_utilisation: +utilisation.toFixed(3),
    resource_bottleneck_count: bottlenecks,
    days_to_deadline: daysToDeadline,
    project_duration_months: p.durationMonths,
    elapsed_ratio: +elapsed.toFixed(3),
    progress_vs_elapsed: +clamp(progressVsElapsed, 0, 1.5).toFixed(3),
    weather_seasonality: monsoon,
    procurement_delay_days: procurement,
    team_size_adequacy: +teamAdequacy.toFixed(3),
  };
}

// ─── Health score — exact documented sub-score formulas ─────────────────────
export interface HealthScores { schedule: number; budget: number; resources: number; milestones: number; overall: number; }

export function computeHealth(p: Project, now: Date = ANCHOR): HealthScores {
  const f = extractFeatures(p, now);
  const progress = p.progress / 100;

  // Schedule = 100 × (0.50·PR + 0.50·TD)
  const PR = Math.min(1, f.progress_vs_elapsed);
  const TD = Math.max(0, 1 - f.days_behind_schedule / 90);
  const schedule = 100 * (0.5 * PR + 0.5 * TD);

  // Budget = 100 × (0.35·BR + 0.25·VR + 0.40·OR)
  const overrunPct = p.totalBudget > 0 ? Math.max(0, (p.projectedBudget - p.totalBudget) / p.totalBudget * 100) : 0;
  // v4: burn-rate neutrality in the first weeks — ₹0 spent with ~0 elapsed is
  // "no evidence yet", not a 0/1 burn mismatch (new projects scored BUDGET 40).
  const burnRatio = f.elapsed_ratio > 0.04 ? f.budget_utilisation_rate / f.elapsed_ratio : 1;
  const BR = Math.max(0, 1 - Math.abs(burnRatio - 1) / 0.25);
  const VR = Math.max(0, 1 - Math.abs(f.budget_velocity_deviation) / 0.35);
  const OR = Math.max(0, 1 - overrunPct / 15);
  const budget = 100 * (0.35 * BR + 0.25 * VR + 0.4 * OR);

  // Resources = 100 × (0.45·UB + 0.30·BN + 0.25·TA)
  const UB = f.resource_utilisation > 0.85
    ? 1 - Math.max(0, (f.resource_utilisation - 0.85) / 0.15)
    : 1 - Math.max(0, (0.6 - f.resource_utilisation) / 0.6);
  const BN = Math.max(0, 1 - f.resource_bottleneck_count / 5);
  const TA = Math.min(1, f.team_size_adequacy);
  const resources = 100 * (0.45 * UB + 0.3 * BN + 0.25 * TA);

  // Milestones = 100 × (0.45·MA + 0.35·SS + 0.20·CD)
  const MA = f.milestone_adherence;
  const SS = Math.max(0, 1 - f.total_milestones_delayed / 4);
  const CD = Math.max(0, 1 - f.critical_milestones_delayed / 2);
  const milestones = 100 * (0.45 * MA + 0.35 * SS + 0.2 * CD);

  const overall =
    HEALTH_WEIGHTS.schedule * schedule +
    HEALTH_WEIGHTS.budget * budget +
    HEALTH_WEIGHTS.resources * resources +
    HEALTH_WEIGHTS.milestones * milestones;

  return {
    schedule: clamp(schedule, 0, 100), budget: clamp(budget, 0, 100),
    resources: clamp(resources, 0, 100), milestones: clamp(milestones, 0, 100),
    overall: clamp(overall, 0, 100),
  };
}

export function healthBand(score: number, t: ThresholdSettings): "HEALTHY" | "AT_RISK" | "CRITICAL" {
  if (score >= t.amberAt) return "HEALTHY";
  if (score >= t.redAt) return "AT_RISK";
  return "CRITICAL";
}

// ─── Delay prediction (XGBoost surrogate: base + Σ factor-style log-odds) ──────
interface FactorSpec {
  feature: keyof MlFeatures;
  weight: number;
  bad: (v: number) => boolean;
  scale: (v: number) => number;
  cap: number;
  fmt: (v: number) => string;
  why: string;
}

const FACTOR_SPECS: FactorSpec[] = [
  { feature: "days_behind_schedule", weight: 0.032, bad: v => v > 5, scale: v => Math.min(2.4, v * 0.028), cap: 2.4, fmt: v => `${v} days behind`, why: "Schedule gap compounds: catching up needs 30%+ higher output, rarely achieved on infrastructure works." },
  { feature: "progress_vs_elapsed", weight: 0.9, bad: v => v < 0.92, scale: v => clamp((1 - v) * 7.5, 0, 2.4), cap: 2.4, fmt: v => `${Math.round(v * 100)}% of expected pace`, why: "Physical progress is trailing elapsed time — the single most reliable leading indicator of a missed date." },
  { feature: "procurement_delay_days", weight: 0.045, bad: v => v > 10, scale: v => Math.min(1.4, v * 0.042), cap: 1.4, fmt: v => `${v} days pending`, why: "Material/indents pending beyond lead time lock downstream activity sequences." },
  { feature: "milestone_adherence", weight: 0.9, bad: v => v < 0.95, scale: v => clamp((0.95 - v) * 5.2, 0, 1.8), cap: 1.8, fmt: v => `${Math.round(v * 100)}% on time`, why: "Missed milestones deplete float and push the critical path even when overall progress looks close to plan." },
  { feature: "budget_velocity_deviation", weight: 0.4, bad: v => Math.abs(v) > 0.12, scale: v => clamp(Math.abs(v) * 4.6, 0, 1.5), cap: 1.5, fmt: v => `${v > 0 ? "+" : ""}${Math.round(v * 100)}% vs plan`, why: "Burn running ahead of physical achievement is the classic signature of schedule-driven cost overruns." },
  { feature: "critical_milestones_delayed", weight: 0.55, bad: v => v >= 1, scale: v => Math.min(1.6, v * 0.55), cap: 1.6, fmt: v => `${v} critical`, why: "Critical-path milestones have zero float — every day lost moves the end date directly." },
  { feature: "weather_seasonality", weight: 0.42, bad: v => v === 1, scale: v => v * 0.42, cap: 0.42, fmt: v => (v ? "monsoon active" : "clear season"), why: "Jun–Sep rainfall halts earthwork and concrete pours; historical loss is 8–14 working days per month." },
  { feature: "resource_bottleneck_count", weight: 0.3, bad: v => v >= 1, scale: v => Math.min(1.1, v * 0.3), cap: 1.1, fmt: v => `${v} at >90%`, why: "Plant/machinery running above 90% leaves no catch-up capacity for re-sequencing." },
  { feature: "budget_utilisation_rate", weight: 0.9, bad: v => v > 0.9 || v < 0.15, scale: v => v > 0.9 ? (v - 0.9) * 6 : (0.15 - v) * 4, cap: 0.8, fmt: v => `${Math.round(v * 100)}% spent`, why: "Money consumed out of proportion to work done signals estimation error or idle charges." },
  { feature: "task_completion_rate", weight: 1.2, bad: v => v < 0.7, scale: v => (0.7 - v) * 1.2, cap: 0.6, fmt: v => `${Math.round(v * 100)}% tasks done`, why: "Low activity closure rate precedes milestone slippage by 4–8 weeks." },
  { feature: "dependency_chain_health", weight: 1.3, bad: v => v < 0.9, scale: v => (0.9 - v) * 1.3, cap: 0.9, fmt: v => `${Math.round(v * 100)}% unblocked`, why: "Blocked dependency chains stall entire work fronts, not just single activities." },
  { feature: "team_size_adequacy", weight: 1.1, bad: v => v < 0.85, scale: v => (0.85 - v) * 1.1, cap: 0.5, fmt: v => `${Math.round(v * 100)}% adequacy`, why: "Understaffed fronts cannot absorb any further disruption without slipping." },
];

export function computeDelayPrediction(p: Project, modelVersion = MODEL_VERSION, now: Date = ANCHOR): PredictionResult {
  const f = extractFeatures(p, now);
  const isStory = p.story ? p.story.tier === "A" || p.story.tier === "C" : false;
  const damp = isStory ? 1 : 0.4; // healthy portfolio projects get damped contributions

  let margin = -2.35 + (100 - p.healthScore) / 55;
  const factors: PredictionFactor[] = [];
  for (const spec of FACTOR_SPECS) {
    const v = f[spec.feature];
    if (!spec.bad(v)) continue;
    const contribution = clamp(spec.scale(v), 0, spec.cap) * (damp === 1 ? 1 : damp);
    if (contribution <= 0.02) continue;
    margin += contribution;
    factors.push({
      feature: spec.feature, label: FEATURE_LABELS[spec.feature],
      value: v, valueLabel: spec.fmt(v), contribution: +contribution.toFixed(2),
      direction: "raises", plainLanguage: spec.why,
    });
  }
  // one mitigating factor for realism
  if (f.task_completion_rate > 0.8) {
    margin -= 0.13;
    factors.push({ feature: "task_completion_rate", label: FEATURE_LABELS.task_completion_rate, value: f.task_completion_rate, valueLabel: `${Math.round(f.task_completion_rate * 100)}% tasks done`, contribution: -0.13, direction: "lowers", plainLanguage: "Strong activity closure rate gives the contractor re-sequencing headroom." });
  }

  // calibrated blend: model + health prior
  const pModel = sigmoid(margin);
  const pHealth = sigmoid((62 - p.healthScore) / 7);
  const probability = clamp(0.3 * pModel + 0.7 * pHealth, 0.02, 0.985);

  const deficit = Math.max(0, (1 - clamp(f.progress_vs_elapsed, 0, 1)) * f.days_to_deadline);
  const estimatedDays = Math.round(clamp(deficit, 4, 240) * (0.5 + 0.6 * probability));
  const ciWidth = Math.round(estimatedDays * 0.32 + 6);
  const confidence = clamp(
    0.62 + (p.prediction ? 0.14 : 0.06) + (isStory ? 0.1 : 0.05) - Math.abs(probability - 0.5) * 0.18,
    0.5, 0.93,
  );

  factors.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return {
    id: `pred-${p.id}-${Date.now().toString(36)}`,
    projectId: p.id,
    predictionType: "delay",
    probability: +probability.toFixed(3),
    estimatedDays,
    ciLower: Math.max(2, estimatedDays - ciWidth),
    ciUpper: estimatedDays + ciWidth,
    confidence: +confidence.toFixed(2),
    factors: factors.slice(0, 6),
    modelVersion,
    computedAt: new Date().toISOString(),
    featureSnapshot: f as unknown as Record<string, number>,
  };
}

// ─── Budget forecast (seasonality + confidence interval surrogate) ────────
export interface ForecastPoint { month: number; year: number; planned: number; actual: number | null; projected: number; lower: number; upper: number; }
export interface BudgetForecast { points: ForecastPoint[]; projectedFinal: number; overrunPct: number; monthlyBurn: number; breachMonth?: string; }

export function computeBudgetForecast(p: Project): BudgetForecast {
  const recs = [...p.budgetRecords].sort((a, b) => a.year - b.year || a.month - b.month);
  const points: ForecastPoint[] = [];
  let cumPlanned = 0, cumActual = 0;
  const byMonth = new Map<string, { planned: number; spent: number }>();
  for (const r of recs) {
    const k = `${r.year}-${r.month}`;
    const e = byMonth.get(k) || { planned: 0, spent: 0 };
    e.planned += r.planned; e.spent += r.spent;
    byMonth.set(k, e);
  }
  const keys = [...byMonth.keys()];
  const lastN = keys.slice(-4);
  const avgBurn = lastN.length ? lastN.reduce((s, k) => s + (byMonth.get(k)!.spent), 0) / lastN.length : p.totalBudget / Math.max(6, p.durationMonths);
  const first = keys.length ? byMonth.get(keys[0])! : { planned: 0, spent: 0 };
  const last = keys.length ? byMonth.get(keys[keys.length - 1])! : { planned: 0, spent: 0 };
  const trend = (lastN.length > 1) ? (byMonth.get(lastN[lastN.length - 1])!.spent - byMonth.get(lastN[0])!.spent) / (lastN.length - 1) : 0;

  for (const k of keys) {
    const [y, m] = k.split("-").map(Number);
    const e = byMonth.get(k)!;
    cumPlanned += e.planned; cumActual += e.spent;
    points.push({ month: m, year: y, planned: cumPlanned, actual: cumActual, projected: cumActual, lower: cumActual, upper: cumActual });
  }
  const remainingMonths = Math.max(3, Math.round(p.durationMonths * (1 - Math.min(0.95, p.progress / 100))) + 2);
  let cumProj = cumActual;
  const startM = keys.length ? points[points.length - 1] : null;
  let breachMonth: string | undefined;
  const monsoon = (m: number) => (m >= 6 && m <= 9);
  for (let i = 1; i <= remainingMonths; i++) {
    const m = (( (startM ? startM.month : 1) + i - 1) % 12) + 1;
    const y = startM ? startM.year + Math.floor(((startM.month - 1 + i) / 12)) : 2026;
    const season = monsoon(m) ? 0.85 : 1.08;
    const monthBurn = Math.max(0, (avgBurn + trend / 3 * i * 0.35) * season);
    cumProj += monthBurn;
    const spread = 1 + (0.03 + i * 0.009);
    points.push({ month: m, year: y, planned: cumPlanned, actual: null, projected: Math.round(cumProj), lower: Math.round(cumProj / spread), upper: Math.round(cumProj * spread) });
    if (!breachMonth && cumProj > p.totalBudget) breachMonth = `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1]} ${y}`;
  }
  const projectedFinal = Math.round(cumProj);
  const overrunPct = p.totalBudget > 0 ? +(((projectedFinal - p.totalBudget) / p.totalBudget) * 100).toFixed(1) : 0;
  return { points, projectedFinal, overrunPct, monthlyBurn: +avgBurn.toFixed(1), breachMonth };
}

// ─── Critical path (milestones) ─────────────────────────────────────────────
export function criticalPathMilestones(p: Project): string[] {
  const chain: string[] = [];
  const sorted = [...p.milestones].sort((a, b) => a.order - b.order);
  let anchor = 0;
  for (const m of sorted) {
    const dur = 30; // heuristic month block
    const pos = m.order * dur;
    if (m.isCritical || pos <= anchor) {
      chain.push(m.id);
      anchor = pos + dur;
    }
  }
  return chain;
}

// ─── Model lab: retrain simulation ──────────────────────────────────────────
export function simulateRetrain(currentCount: number): ModelVersion {
  const seed = currentCount + 1;
  const jitter = (base: number, spread: number) => +(base + (Math.sin(seed * 12.9898) * spread)).toFixed(3);
  return {
    version: `AssurePredict 2.${4 + seed}`,
    trainedAt: new Date().toISOString(),
    trainedOn: 5000 + seed * 120,
    metrics: {
      auc: clamp(jitter(0.912, 0.012), 0.85, 0.96), accuracy: clamp(jitter(0.842, 0.015), 0.78, 0.92),
      precision: clamp(jitter(0.814, 0.014), 0.76, 0.9), recall: clamp(jitter(0.831, 0.015), 0.77, 0.92),
      f1: clamp(jitter(0.822, 0.014), 0.77, 0.91), maeDays: +clamp(jitter(18.4, 1.5), 14, 24).toFixed(1),
      brier: +clamp(jitter(0.118, 0.01), 0.09, 0.15).toFixed(3), ece: +clamp(jitter(0.041, 0.006), 0.02, 0.06).toFixed(3),
    },
    status: "new version",
    notes: "Retrained on accumulated prediction outcomes with auto-calibration; shadow week pending promotion.",
  };
}
