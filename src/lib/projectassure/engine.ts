// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure — Engine: health recomputation (formula + story bias),
// portfolio stats, RBAC scoping, alert-rule evaluation.
// ═══════════════════════════════════════════════════════════════════════════
import type { Project, PortfolioStats, User, ThresholdSettings, Alert } from "./types";
import { computeHealth, computeDelayPrediction, computeBudgetForecast } from "./ml";
import { STORY_TARGETS } from "./seed";
import { clamp } from "./format";
import { ANCHOR } from "./doc-corpus";

// Story bias keeps the 4 narrative projects at their documented jury-script
// numbers while still letting mutations move scores (bias is constant).
export function storyBias(p: Project): { schedule: number; budget: number; resources: number; milestones: number } {
  const t = STORY_TARGETS[p.id];
  if (!t) return { schedule: 0, budget: 0, resources: 0, milestones: 0 };
  const f = computeHealth(p, ANCHOR);
  return {
    schedule: clamp(t.schedule - f.schedule, -40, 40),
    budget: clamp(t.budget - f.budget, -40, 40),
    resources: clamp(t.resources - f.resources, -40, 40),
    milestones: clamp(t.milestones - f.milestones, -40, 40),
  };
}

/** Recompute a project's health + prediction from its live data (mutations feed this). */
export function recomputeProject(p: Project, thresholds: ThresholdSettings, now = ANCHOR): Project {
  const bias = storyBias(p);
  const f = computeHealth(p, now);
  const schedule = clamp(f.schedule + bias.schedule, 0, 100);
  const budget = clamp(f.budget + bias.budget, 0, 100);
  const resources = clamp(f.resources + bias.resources, 0, 100);
  const milestones = clamp(f.milestones + bias.milestones, 0, 100);
  const health = 0.3 * schedule + 0.25 * budget + 0.2 * resources + 0.25 * milestones;
  const next: Project = {
    ...p,
    scheduleScore: Math.round(schedule * 10) / 10,
    budgetScore: Math.round(budget * 10) / 10,
    resourceScore: Math.round(resources * 10) / 10,
    milestoneScore: Math.round(milestones * 10) / 10,
    healthScore: Math.round(health * 10) / 10,
    healthComputedAt: new Date().toISOString(),
  };
  next.healthStatus = next.healthScore >= thresholds.amberAt ? "HEALTHY" : next.healthScore >= thresholds.redAt ? "AT_RISK" : "CRITICAL";

  // keep financial projection in sync with any budget edits
  const forecast = computeBudgetForecast(next);
  next.projectedBudget = next.projectedBudget > 0 && next.status === "ACTIVE" ? Math.max(next.spentBudget, Math.min(forecast.projectedFinal, next.projectedBudget * 1.5)) : next.projectedBudget;

  if (next.status === "ACTIVE" || next.status === "ON_HOLD") {
    next.prediction = computeDelayPrediction(next, p.prediction?.modelVersion ?? "AssurePredict 2.3");
  } else if (next.status === "PLANNING") {
    // v4: newly created projects start in PLANNING — they still deserve a
    // *baseline* (pre-execution) risk score so "Run prediction" works from
    // minute one instead of silently doing nothing.
    const base = computeDelayPrediction(next, "AssurePredict 2.3");
    next.prediction = { ...base, isBaseline: true };
  } else {
    next.prediction = undefined;
  }
  return next;
}

export function computePortfolioStats(projects: Project[]): PortfolioStats {
  const [totalBudget, totalSpent, avgHealth, avgProgress] = projects.reduce(
    ([b, s, h, pr], p) => [b + p.totalBudget, s + p.spentBudget, h + p.healthScore, pr + p.progress],
    [0, 0, 0, 0] as number[],
  );
  const n = projects.length || 1;
  const alerts = projects.flatMap(p => p.alerts);
  return {
    totalProjects: projects.length,
    active: projects.filter(p => p.status === "ACTIVE").length,
    healthy: projects.filter(p => p.healthStatus === "HEALTHY").length,
    atRisk: projects.filter(p => p.healthStatus === "AT_RISK").length,
    critical: projects.filter(p => p.healthStatus === "CRITICAL").length,
    totalBudget, totalSpent,
    avgHealth: Math.round(avgHealth / n),
    avgProgress: Math.round(avgProgress / n),
    projectsBehind: projects.filter(p => {
      const elapsed = (Date.now() - new Date(p.startDate).getTime()) / (new Date(p.targetDate).getTime() - new Date(p.startDate).getTime());
      return p.status === "ACTIVE" && elapsed > 0.05 && p.progress / 100 < elapsed * 0.92;
    }).length,
    projectedOverruns: projects.filter(p => p.projectedBudget > p.totalBudget * 1.1).length,
    alertsUnread: alerts.filter(a => !a.isRead).length,
    criticalAlerts: alerts.filter(a => a.severity === "CRITICAL" && !a.isRead).length,
    documentsProcessed: projects.reduce((s, p) => s + p.documents.filter(d => d.status === "PROCESSED").length, 0),
    emailsSent: 0,
  };
}

// ─── RBAC scoping ───────────────────────────────────────────────────────────
export function scopedProjects(projects: Project[], user: User): Project[] {
  const own = (p: Project) => p.ownerId === user.id; // registered-account ownership always wins
  switch (user.role) {
    case "ADMIN": return projects;
    case "PROJECT_MANAGER": return projects.filter(p => own(p) || p.projectManager === user.name);
    case "STAKEHOLDER": return projects.filter(p => own(p) || p.departmentId === user.departmentId);
    case "VIEWER": return projects.filter(p => own(p) || ["prj-01", "prj-02", "prj-03", "prj-04", "prj-05", "prj-19"].includes(p.id));
    default: return [];
  }
}

// ─── Alert rule evaluation (runs after mutations) ───────────────────────────
export interface RuleEvaluation { rule: string; severity: Alert["severity"]; type: Alert["type"]; title: string; description: string; action: string; owner: string; deadline: string; }

export function evaluateAlertRules(p: Project, t: ThresholdSettings): RuleEvaluation[] {
  const out: RuleEvaluation[] = [];
  const overrunPct = p.totalBudget > 0 ? ((p.projectedBudget - p.totalBudget) / p.totalBudget) * 100 : 0;
  const budgetAlerts = p.alerts.filter(a => a.type === "BUDGET_OVERRUN");

  if (overrunPct > t.budgetCriticalPct && !budgetAlerts.some(a => a.severity === "CRITICAL")) {
    out.push({ rule: "Overrun >20%", severity: "CRITICAL", type: "BUDGET_OVERRUN", title: `Projected overrun +${overrunPct.toFixed(1)}% — CRITICAL escalation band`, description: `Forecast final cost exceeds sanction by more than ${t.budgetCriticalPct}%. Ministry dashboard escalation and a mandatory review note are triggered.`, action: "Freeze new financial approvals and prepare the Cabinet escalation note.", owner: "Finance Division", deadline: "within 48 hours" });
  } else if (overrunPct > t.budgetWarnPct && !budgetAlerts.some(a => a.severity === "HIGH")) {
    out.push({ rule: "Overrun >10%", severity: "HIGH", type: "BUDGET_OVERRUN", title: `Projected overrun +${overrunPct.toFixed(1)}% — WARNING band`, description: `Forecast exceeds the ${t.budgetWarnPct}% warning threshold. Weekly re-forecast is now mandatory.`, action: "Issue vendor liquidated-damages notice and re-baseline the cash-flow.", owner: p.projectManager, deadline: "weekly until stabilised" });
  }

  if (p.prediction && p.prediction.probability * 100 >= t.delayProbEmailAt && !p.alerts.some(a => a.type === "DELAY_PREDICTION")) {
    out.push({ rule: `Delay probability ≥ ${t.delayProbEmailAt}%`, severity: "HIGH", type: "DELAY_PREDICTION", title: `Delay probability ${Math.round(p.prediction.probability * 100)}% — email threshold crossed`, description: `Model ${p.prediction.modelVersion} estimates ${p.prediction.estimatedDays}-day slip (90% CI ${p.prediction.ciLower}–${p.prediction.ciUpper}). Advisory — rule R10 verification required.`, action: "Run the mitigation plan on the top driving factors and verify with the field officer.", owner: p.projectManager, deadline: "within 5 working days" });
  }

  const delayed = p.milestones.filter(m => m.status === "DELAYED" || m.status === "BLOCKED");
  const critical = delayed.filter(m => m.isCritical);
  if (critical.length >= 1 && !p.alerts.some(a => a.type === "MILESTONE_SLIPPAGE" && a.severity === "HIGH")) {
    const worst = critical[0];
    out.push({ rule: "Critical milestone delayed", severity: delayed.length > 3 ? "CRITICAL" : "HIGH", type: "MILESTONE_SLIPPAGE", title: `${worst.name} — critical path slip`, description: `${critical.length} critical milestone(s) delayed or blocked; ${worst.name} is the binding constraint.`, action: "Escalate the blocking dependency and re-sequence parallel work fronts.", owner: p.projectManager, deadline: "before next milestone review" });
  }

  const bottlenecks = p.resources.filter(r => r.utilised > 90);
  if (bottlenecks.length >= 2 && !p.alerts.some(a => a.type === "RESOURCE_BOTTLENECK")) {
    out.push({ rule: "≥2 resources >90%", severity: "MEDIUM", type: "RESOURCE_BOTTLENECK", title: `${bottlenecks.length} resource bottlenecks detected`, description: bottlenecks.map(r => `${r.name} at ${r.utilised}%`).join(" · ") + " — no catch-up capacity remains.", action: "Re-deploy from idle fronts or hire short-term plant.", owner: p.projectManager, deadline: "before 30 Sep 2026" });
  }

  if (p.healthScore < t.redAt && !p.alerts.some(a => a.type === "RISK_LEVEL_CHANGE")) {
    out.push({ rule: `Health < ${t.redAt}`, severity: "CRITICAL", type: "RISK_LEVEL_CHANGE", title: "Project health entered the Red band", description: `Composite health ${p.healthScore}. Rule R10: a human officer must verify field data before escalation.`, action: "Verify with the executive engineer, then escalate to the administrative ministry.", owner: "Arun Kulkarni (JS, MoSPI)", deadline: "within 48 hours" });
  }
  return out;
}
