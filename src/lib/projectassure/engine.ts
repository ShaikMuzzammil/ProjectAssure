/* ============================================================
 * ProjectAssure — Engine: assembles the 30-project portfolio
 * Attaches alerts, risk assessments & portfolio statistics.
 * ============================================================ */

import type {
  Alert, PortfolioStats, Project, RiskAssessment,
} from "./types";
import {
  buildAuditTrail, buildBudgetRecords, buildDocuments, buildMilestones,
  buildResources, buildTasks, CONTRACTORS, DEFS, DEPARTMENTS, USERS,
  DAY, NOW, iso, monthsAgo, type ProjDef,
} from "./seed-data";
import { computeDelayPrediction } from "./ml";

let cache: Project[] | null = null;

export function getProjects(): Project[] {
  if (cache) return cache;
  const projects: Project[] = [];

  DEFS.forEach((def: ProjDef, idx) => {
    const id = `prj-${String(idx + 1).padStart(2, "0")}`;
    const start = new Date(NOW.getTime() - def.startAgo * 30 * DAY);
    const target = new Date(start.getTime() + def.durMonths * 30 * DAY);
    const milestones = buildMilestones(def, id);
    const tasks = buildTasks(milestones, id);
    const budgetRecords = buildBudgetRecords(def, id);

    /* financials: spent & projected */
    const spentBudget = Math.round((def.budget * (def.progress / 100) * (def.health === "A" ? 1.18 : def.health === "C" ? 1.34 : 0.98 + (idx % 7) * 0.01)) * 10) / 10;
    const overrunFactor = def.health === "A" ? 1.052 : def.health === "C" ? 1.118 : 0.985 + ((idx * 7) % 11) / 400;
    const projectedBudget = Math.round(def.budget * overrunFactor * 10) / 10;

    const p: Project = {
      id,
      psId: `PRJ-2026-${String(101 + idx * 7).padStart(4, "0")}`,
      name: def.name,
      description: `${def.sector} project under ${def.scheme}, implemented in ${def.district}, ${def.state}. Monitored by ${DEPARTMENTS.find((d) => d.id === def.dept)?.name}.`,
      status: def.status,
      departmentId: def.dept,
      sector: def.sector,
      scheme: def.scheme,
      state: def.state,
      district: def.district,
      latitude: def.lat,
      longitude: def.lng,
      startDate: iso(start),
      targetDate: iso(target),
      estimatedEndDate: def.health ? iso(new Date(target.getTime() + (def.health === "C" ? 150 : 55) * DAY)) : undefined,
      progress: def.progress,
      totalBudget: def.budget,
      spentBudget,
      projectedBudget,
      healthScore: 100, // recomputed below
      healthStatus: "HEALTHY",
      scheduleScore: 90, budgetScore: 90, resourceScore: 90, milestoneScore: 90,
      healthComputedAt: new Date().toISOString(),
      story: def.story,
      projectManager: def.pm,
      contractor: def.contractor ?? CONTRACTORS[idx % CONTRACTORS.length],
      milestones, tasks, budgetRecords,
      resources: buildResources(def, id),
      documents: buildDocuments(def, id, def.pm),
      alerts: [],
      auditTrail: buildAuditTrail(id, def.name),
    };

    /* risk assessment for flagged projects */
    if (def.health) {
      p.riskAssessment = buildRiskAssessment(p, def.health);
    }

    /* deterministic-ish health from sub-scores, with story overrides */
    const health = computeHealthFor(p, def);
    p.scheduleScore = health.schedule;
    p.budgetScore = health.budget;
    p.resourceScore = health.resources;
    p.milestoneScore = health.milestones;
    p.healthScore = Math.round((0.30 * health.schedule + 0.25 * health.budget + 0.20 * health.resources + 0.25 * health.milestones) * 10) / 10;
    p.healthStatus = p.healthScore >= 75 ? "HEALTHY" : p.healthScore >= 50 ? "AT_RISK" : "CRITICAL";

    /* delay prediction for every non-completed project */
    if (def.status === "ACTIVE" || def.status === "ON_HOLD") {
      p.prediction = computeDelayPrediction(p);
    }

    /* alerts for flagged projects (+ generic ones) */
    p.alerts = buildAlerts(p, def.health);

    projects.push(p);
  });

  cache = projects;
  return projects;
}

function computeHealthFor(p: Project, def: ProjDef) {
  /* Story-driven sub-scores for flagged projects (doc 04 exemplar) */
  if (def.health === "A" && def.name.startsWith("Bharatmala")) {
    return { schedule: 61.0, budget: 52.0, resources: 70.0, milestones: 50.0 };
  }
  if (def.health === "A" && def.name.startsWith("ICCC")) {
    /* doc 06 worked example: 70.4 / 35.3 / 82.5 / 59.6 -> 61.3 */
    return { schedule: 70.4, budget: 35.3, resources: 82.5, milestones: 59.6 };
  }
  if (def.health === "C") {
    return { schedule: 28.5, budget: 31.2, resources: 44.0, milestones: 30.5 }; // ~33
  }
  /* healthy: derive from progress consistency with deterministic jitter
     floor 76 guarantees the weighted composite stays HEALTHY (>= 75) */
  const seed = (p.id.charCodeAt(p.id.length - 1) * 37 + def.name.length * 13) % 100;
  const base = 80 + (seed % 15); // 80-94
  const j = (k: number) => clamp(base + ((seed * (k + 3)) % 11) - 5, 76, 97);
  return { schedule: j(1), budget: j(2), resources: j(3), milestones: j(4) };
}

function buildRiskAssessment(p: Project, tier: "R" | "A" | "C"): RiskAssessment {
  const critical = tier === "C";
  return {
    scheduleRisk: critical ? 86 : tier === "A" ? 62 : 55,
    budgetRisk: critical ? 74 : 68,
    resourceRisk: critical ? 58 : 41,
    overallRisk: critical ? 82 : 61,
    riskLevel: critical ? "CRITICAL" : "HIGH",
    factors: critical
      ? [
          { factor: "Forest clearance permit pending", impact: 92, description: "Stage-2 forest clearance awaiting final sign-off for 41 days; 62% of remaining critical-path tasks blocked." },
          { factor: "Budget burn ahead of schedule", impact: 78, description: "41% of budget consumed against 19% schedule progress; funding-gap alert triggered." },
          { factor: "3 critical milestones delayed", impact: 71, description: "Pipeline, pumping station and grid milestones all slipped; downstream dependencies frozen." },
          { factor: "Monsoon window", impact: 44, description: "Jun-Sep seasonality historically cuts effective field capacity by ~35% in Bundelkhand." },
        ]
      : [
          { factor: "Steel procurement pending 18 days", impact: 84, description: "Vendor lot for pier steel unpaid beyond credit window; casting of pier footing P-07 blocked." },
          { factor: "Monsoon interruption", impact: 55, description: "Jun-Sep window reduces effective working days on corridor sections." },
          { factor: "3 of 8 milestones behind", impact: 61, description: "Foundation, procurement award and integration milestones showing slippage." },
          { factor: "Burn velocity +22%", impact: 47, description: "Spending 22% faster than plan while physical progress trails — efficiency concern." },
        ],
    assessedAt: new Date().toISOString(),
  };
}

function buildAlerts(p: Project, tier?: "R" | "A" | "C"): Alert[] {
  const alerts: Alert[] = [];
  const push = (a: Omit<Alert, "id" | "projectId">) =>
    alerts.push({ id: `${p.id}-alert-${alerts.length + 1}`, projectId: p.id, ...a });

  if (tier === "C") {
    push({
      title: "Critical: projected budget overrun crosses 20%",
      description: `Prophet forecast projects final cost at ₹${(p.projectedBudget / 100).toFixed(2)} Cr vs sanctioned ₹${(p.totalBudget / 100).toFixed(2)} Cr (+11.8%). Mandatory review note required.`,
      severity: "CRITICAL", type: "BUDGET_OVERRUN", isRead: false, createdAt: monthsAgo(0.05),
      recommendedAction: "Immediately verify burn-rate ledger and freeze non-critical procurement pending ministry review.",
      recommendedOwner: "Project Manager", recommendedDeadline: "within 24 hours",
    });
    push({
      title: "Critical: 3 critical-path milestones delayed",
      description: "Pipeline laying, pumping station and rural grid milestones are delayed; 12 downstream tasks frozen on the critical path.",
      severity: "CRITICAL", type: "MILESTONE_SLIPPAGE", isRead: false, createdAt: monthsAgo(0.12),
      recommendedAction: "Convene escalation review with contractor; resequence non-blocked tasks and file permit status update.",
      recommendedOwner: "Project Manager", recommendedDeadline: "this week",
    });
    push({
      title: "Risk level change: AMBER → RED",
      description: "Health score crossed below 50 on the latest scoring run. Human-officer verification required before escalation (rule R10).",
      severity: "HIGH", type: "RISK_LEVEL_CHANGE", isRead: false, createdAt: monthsAgo(0.2),
      recommendedAction: "Assign monitoring officer to verify field data feeding the health score.",
      recommendedOwner: "Field Reporting Officer", recommendedDeadline: "within 48 hours",
    });
  }
  if (tier === "A") {
    const overrunPct = ((p.projectedBudget - p.totalBudget) / p.totalBudget) * 100;
    const delayedMs = p.milestones.find((m) => m.status === "DELAYED" || m.status === "BLOCKED");
    if (overrunPct > 8) {
      push({
        title: "Warning: projected budget overrun > 10%",
        description: `Projected final cost ₹${(p.projectedBudget / 100).toFixed(2)} Cr exceeds sanctioned ₹${(p.totalBudget / 100).toFixed(2)} Cr by ${overrunPct.toFixed(1)}%.`,
        severity: "HIGH", type: "BUDGET_OVERRUN", isRead: false, createdAt: monthsAgo(0.08),
        recommendedAction: "Verify cost ledger, re-examine velocity deviation and issue weekly re-forecast.",
        recommendedOwner: "Project Manager", recommendedDeadline: "this week",
      });
    } else {
      push({
        title: "Budget stress: forecast upper interval crosses sanctioned cost",
        description: `Point estimate stays within +${overrunPct.toFixed(1)}%, but the forecast upper band breaches ₹${(p.totalBudget / 100).toFixed(2)} Cr before completion month — BUDGET_STRESS rule fires.`,
        severity: "HIGH", type: "BUDGET_OVERRUN", isRead: false, createdAt: monthsAgo(0.08),
        recommendedAction: "Verify burn-rate ledger, check velocity deviation (+22% vs plan) and schedule weekly re-forecast.",
        recommendedOwner: "Project Manager", recommendedDeadline: "this week",
      });
    }
    push({
      title: `Milestone slippage detected on critical path${delayedMs ? `: ${delayedMs.name}` : ""}`,
      description: `${delayedMs ? `"${delayedMs.name}" (weight ${delayedMs.weight}${delayedMs.isCritical ? ", critical path" : ""}) is ${delayedMs.status}` : "A milestone is behind schedule"}. Downstream casting/dependency sequence impacted.`,
      severity: "MEDIUM", type: "MILESTONE_SLIPPAGE", isRead: false, createdAt: monthsAgo(0.3),
      recommendedAction: "Expedite steel procurement; confirm revised sequence date with contractor.",
      recommendedOwner: "Project Manager", recommendedDeadline: "within 7 days",
    });
    push({
      title: "Resource bottleneck: cranes at 96% utilisation",
      description: "Tower crane pool exceeds 90% utilisation threshold — queueing risk on lifting operations.",
      severity: "MEDIUM", type: "RESOURCE_BOTTLENECK", isRead: true, createdAt: monthsAgo(0.6),
      recommendedAction: "Evaluate inter-project crane transfer or extended shift authorisation.",
      recommendedOwner: "Project Manager", recommendedDeadline: "this week",
    });
  }
  /* generic light alerts — only a handful, deterministic */
  if (!tier) {
    const n = parseInt(p.id.slice(-2), 10);
    if (n % 8 === 3 && p.progress > 40 && p.progress < 80) {
      push({
        title: "Data freshness notice",
        description: "Latest monthly progress report is 9 days old — within SLA but aging. Upload is due.",
        severity: "LOW", type: "DATA_STALENESS", isRead: rnd() > 0.5, createdAt: monthsAgo(0.35),
        recommendedAction: "Schedule the routine report upload; no action required if already filed.",
        recommendedOwner: "Field Reporting Officer", recommendedDeadline: "monitor",
      });
    }
  }
  return alerts;
}

/* deterministic read flag */
function rnd(): number {
  return (Math.sin(NOW.getTime() / 1e7) + 1) / 2;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function getProject(id: string): Project | undefined {
  return getProjects().find((p) => p.id === id);
}

export function computePortfolioStats(projects: Project[]): PortfolioStats {
  const active = projects.filter((p) => p.status === "ACTIVE");
  const allAlerts = projects.flatMap((p) => p.alerts);
  return {
    totalProjects: projects.length,
    active: active.length,
    healthy: projects.filter((p) => p.healthStatus === "HEALTHY").length,
    atRisk: projects.filter((p) => p.healthStatus === "AT_RISK").length,
    critical: projects.filter((p) => p.healthStatus === "CRITICAL").length,
    totalBudget: Math.round(projects.reduce((s, p) => s + p.totalBudget, 0)),
    totalSpent: Math.round(projects.reduce((s, p) => s + p.spentBudget, 0)),
    avgHealth: Math.round(projects.reduce((s, p) => s + p.healthScore, 0) / projects.length),
    avgProgress: Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length),
    projectsBehind: projects.filter((p) => p.healthStatus !== "HEALTHY").length,
    projectedOverruns: projects.filter((p) => p.projectedBudget > p.totalBudget * 1.1).length,
    alertsUnread: allAlerts.filter((a) => !a.isRead).length,
    criticalAlerts: allAlerts.filter((a) => a.severity === "CRITICAL" && !a.isRead).length,
  };
}

export { DEPARTMENTS, USERS } from "./seed-data";
export { ROLES_CONFIG } from "./seed-data";
