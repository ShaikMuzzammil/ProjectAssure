// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure — Simple Monitoring Suite data engine (v5)
// Derived, deterministic, LIVE: every row below is computed from the current
// scoped project portfolio on each render, so the simple screens always agree
// with the deep screens (no second source of truth, no stale demo numbers).
// Covers the teammate-facing "one idea per page" views inspired by the
// ProjectGuard-style dashboard: cost benchmark, budget variance, progress
// mismatch, risk scoreboard, procurement anomalies, change orders,
// authority review and simple overview.
// ═══════════════════════════════════════════════════════════════════════════
import type { Project, PortfolioStats, PredictionFactor } from "./types";
import { extractFeatures, computeBudgetForecast } from "./ml";

// ─── deterministic helpers ──────────────────────────────────────────────────

/** FNV-1a 32-bit hash — stable per string, used to derive rows deterministically. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** deterministic pseudo-random in [0,1) from a seed string + salt */
const unit = (s: string, salt: number) => ((hashSeed(`${s}::${salt}`) % 10000) / 10000);
const pick = <T,>(arr: readonly T[], s: string, salt: number): T => arr[hashSeed(`${s}::${salt}`) % arr.length];
const between = (s: string, salt: number, lo: number, hi: number) => lo + unit(s, salt) * (hi - lo);

const round1 = (v: number) => Math.round(v * 10) / 10;

// ─── 1. Cost benchmark ──────────────────────────────────────────────────────

export interface CostBenchmarkRow {
  id: string;
  psId: string;
  name: string;
  sector: string;
  approved: number;      // ₹ lakhs — sanctioned budget
  aiBenchmark: number;   // ₹ lakhs — independent model estimate of fair cost
  trajectory: number;    // ₹ lakhs — current model-projected final cost (live)
  variancePct: number;   // trajectory vs Intelligence benchmark (+ = running above fair cost)
  status: "Normal" | "Watch" | "High";
  reason: string;
}

// sector multipliers: how much a typical well-run project of this type should
// cost relative to its sanctioned estimate (historic benchmark factors)
const SECTOR_FACTOR: Record<string, number> = {
  Roads: 0.95, Rail: 0.97, Urban: 0.99, Water: 1.01, Power: 0.96,
  Defence: 0.98, Ports: 0.95, Telecom: 0.99, Housing: 1.0, Health: 1.02,
};

export function deriveCostBenchmarks(projects: Project[]): CostBenchmarkRow[] {
  return projects.map(p => {
    const factor = (SECTOR_FACTOR[p.sector] ?? 0.98) * between(p.psId, 7, 0.97, 1.05);
    // Intelligence benchmark: fair-cost estimate from characteristics — sector factor,
    // size diseconomy (very large projects carry execution overhead), team adequacy
    const sizeAdj = p.totalBudget > 50000 ? 1.015 : p.totalBudget < 8000 ? 0.99 : 1;
    const aiBenchmark = Math.round(p.totalBudget * factor * sizeAdj);
    // live trajectory: completed/finished projects use the actual final cost; others the ML forecast
    const trajectory = (p.status === "COMPLETED" || p.progress >= 98) ? Math.round(p.spentBudget) : Math.round(computeBudgetForecast(p).projectedFinal);
    const variancePct = aiBenchmark > 0 ? round1(((trajectory - aiBenchmark) / aiBenchmark) * 100) : 0;
    // Cost alerts only fire ABOVE benchmark (paying more than fair cost).
    // Far-below-benchmark is an underspend/schedule-lag signal → Watch, never High.
    const status: CostBenchmarkRow["status"] = variancePct > 10 ? "High" : (variancePct > 4 || variancePct < -15) ? "Watch" : "Normal";
    const reason = variancePct > 4
      ? `Running ${Math.abs(variancePct)}% above the intelligence fair-cost benchmark — burn trajectory exceeds what comparable well-run projects cost.`
      : variancePct < -15
        ? `Tracking ${Math.abs(variancePct)}% below benchmark — underspending at this level usually means work is not happening on the ground (schedule lag), not savings.`
        : variancePct < -4
          ? `Slightly below benchmark — typically an early-phase burn pattern.`
          : "Within the normal band of the intelligence fair-cost benchmark.";
    return { id: p.id, psId: p.psId, name: p.name, sector: p.sector, approved: Math.round(p.totalBudget), aiBenchmark, trajectory, variancePct, status, reason };
  }).sort((a, b) => b.variancePct - a.variancePct);
}

// ─── 2. Budget variance ─────────────────────────────────────────────────────

export interface BudgetVarianceRow {
  id: string;
  psId: string;
  name: string;
  approved: number;    // original sanction (₹ L)
  revised: number;     // current model-projected final cost (₹ L)
  spent: number;       // actual expenditure to date (₹ L)
  remaining: number;   // revised − spent
  variancePct: number; // revised vs approved (+ = overrun expected)
  status: "Normal" | "Warning" | "High";
}

export function deriveBudgetVariance(projects: Project[]): BudgetVarianceRow[] {
  return projects.map(p => {
    const approved = Math.round(p.totalBudget);
    const revised = Math.round(p.projectedBudget);
    const spent = Math.round(p.spentBudget);
    const remaining = Math.max(0, revised - spent);
    const variancePct = approved > 0 ? round1(((revised - approved) / approved) * 100) : 0;
    const status: BudgetVarianceRow["status"] = variancePct > 10 ? "High" : variancePct > 3 ? "Warning" : "Normal";
    return { id: p.id, psId: p.psId, name: p.name, approved, revised, spent, remaining, variancePct, status };
  }).sort((a, b) => b.variancePct - a.variancePct);
}

export function budgetUtilisation(projects: Project[]): { approvedTotal: number; revisedTotal: number; spentTotal: number; pct: number } {
  const approvedTotal = projects.reduce((s, p) => s + p.totalBudget, 0);
  const revisedTotal = projects.reduce((s, p) => s + p.projectedBudget, 0);
  const spentTotal = projects.reduce((s, p) => s + p.spentBudget, 0);
  const pct = approvedTotal > 0 ? Math.round((spentTotal / approvedTotal) * 100) : 0;
  return { approvedTotal, revisedTotal, spentTotal, pct };
}

// ─── 3. Progress mismatch (physical vs financial) ──────────────────────────

export interface ProgressMismatchRow {
  id: string;
  psId: string;
  name: string;
  physical: number;    // field-verified % of work actually done
  financial: number;   // % of approved money already spent
  gap: number;         // financial − physical (+ = money ahead of work)
  status: "Matched" | "Watch" | "Mismatch";
  interpretation: string;
}

export function deriveProgressMismatches(projects: Project[]): ProgressMismatchRow[] {
  return projects.map(p => {
    const physical = Math.round(p.progress);
    const financial = p.totalBudget > 0 ? Math.round((p.spentBudget / p.totalBudget) * 100) : 0;
    const gap = financial - physical;
    const status: ProgressMismatchRow["status"] = Math.abs(gap) > 10 ? "Mismatch" : Math.abs(gap) > 5 ? "Watch" : "Matched";
    const interpretation = gap > 10
      ? `₹ spent is ${gap} points ahead of work delivered — payments are outpacing physical output (typical causes: advance payments, inflated running-account bills, idle fronts).`
      : gap < -10
        ? `Work is ${-gap} points ahead of money spent — either genuine efficiency or under-invoicing that will hit later (verify milestone billing).`
        : "Payments and physical progress are in step — no mismatch signal.";
    return { id: p.id, psId: p.psId, name: p.name, physical, financial, gap, status, interpretation };
  }).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
}

// ─── 4. Risk scoreboard ─────────────────────────────────────────────────────

export interface RiskScoreRow {
  id: string;
  psId: string;
  name: string;
  riskScore: number;            // 0–100 (100 − health)
  band: "Low" | "Medium" | "High";
  delayProbability: number;     // 0–100 from the ML model
  expectedDelayDays: number;
  topFactors: { label: string; value: number }[];  // plain-language top risk drivers
}

export function deriveRiskScores(projects: Project[]): RiskScoreRow[] {
  return projects.map(p => {
    const riskScore = Math.max(0, Math.min(100, Math.round(100 - p.healthScore)));
    const band: RiskScoreRow["band"] = riskScore >= 40 ? "High" : riskScore >= 25 ? "Medium" : "Low";
    const delayProbability = p.prediction ? Math.round(p.prediction.probability * 100) : 0;
    const expectedDelayDays = p.prediction?.estimatedDays ?? 0;
    const factors: PredictionFactor[] = p.prediction?.factors ?? [];
    const topFactors = factors.slice(0, 3).map(f => ({ label: f.label, value: Math.round(f.contribution * 100) / 100 }));
    return { id: p.id, psId: p.psId, name: p.name, riskScore, band, delayProbability, expectedDelayDays, topFactors };
  }).sort((a, b) => b.riskScore - a.riskScore);
}

// ─── 5. Procurement anomaly detection ──────────────────────────────────────

export interface ContractRow {
  id: string;
  projectId: string;
  psId: string;
  projectName: string;
  vendor: string;
  category: string;
  value: number;         // ₹ lakhs — awarded contract value
  benchmark: number;     // ₹ lakhs — intelligence fair-price benchmark for this package
  variancePct: number;   // value vs benchmark (+ = paying above benchmark)
  risk: "Low" | "Medium" | "High";
  anomaly: string;
  flags: string[];       // behavioural flags (split contracts, concentration…)
}

const VENDORS = [
  "ABC Infrastructure Ltd", "L&T Geotech Works", "NCC Construction", "BuildTech Solutions",
  "Afcons Tractebel JV", "Tata Projects Ltd", "Dilip Buildcon", "IRCON International",
  "Aqua Engineering Pvt Ltd", "SmartBuild India", "National Works Corp", "GVK Project Services",
  "Shapoorji Pallonji", "KNR Constructions", "PSP Projects Ltd", "HG Infra Engineering",
] as const;

const CATEGORY_BY_SECTOR: Record<string, readonly string[]> = {
  Roads: ["Civil Works", "Bituminous Paving", "Bridges & Structures", "Road Signage & Safety"],
  Rail: ["Track Works", "Signalling & Telecom", "Civil Works", "Electrical Works"],
  Urban: ["Civil Works", "Electrical", "IT & Networking", "HVAC & Utilities"],
  Water: ["Pipeline", "Pumping Machinery", "Civil Works", "Treatment Plant"],
  Power: ["Transmission Lines", "Substation Equipment", "Civil Works", "Cabling"],
};
const GENERIC_CATEGORIES = ["Civil Works", "Electrical", "Mechanical", "Survey & Design"] as const;

const ANOMALY_LABEL = (v: number) =>
  v > 20 ? "Significant price anomaly" : v > 12 ? "Above benchmark" : v > 5 ? "Minor price variance" : "No major anomaly";

export function deriveContracts(projects: Project[]): ContractRow[] {
  const rows: ContractRow[] = [];
  let n = 1;
  for (const p of projects) {
    if (p.status === "PLANNING" || p.status === "CANCELLED" || p.status === "ON_HOLD") continue;
    const count = 2 + (hashSeed(`${p.psId}::c`) % 3); // 2–4 contracts per executing project
    const cats = CATEGORY_BY_SECTOR[p.sector] ?? GENERIC_CATEGORIES;
    for (let i = 0; i < count; i++) {
      const id = `CNT-${String(n).padStart(3, "0")}`;
      // fair price: what this package should cost as a share of the project budget
      const fairShare = between(p.psId, 100 + i, 0.06, 0.34);
      const benchmark = Math.max(140, Math.round(p.totalBudget * fairShare));
      // awarded value skews around the fair price; stressed projects skew expensive (story bias preserved)
      const skew = between(p.psId, 200 + i, -0.05, 0.18)
        + (p.healthStatus === "CRITICAL" ? 0.15 : p.healthStatus === "AT_RISK" ? 0.07 : 0);
      const value = Math.max(150, Math.round(benchmark * (1 + skew)));
      const variancePct = benchmark > 0 ? round1(((value - benchmark) / benchmark) * 100) : 0;
      const risk: ContractRow["risk"] = variancePct > 12 ? "High" : variancePct > 5 ? "Medium" : "Low";
      const flags: string[] = [];
      if (variancePct > 12 && p.healthStatus !== "HEALTHY") flags.push("High variance on a stressed project");
      if (value > 0.25 * p.totalBudget) flags.push("Single-package concentration > 25% of project budget");
      if (pick(VENDORS, p.psId, 300 + i) === p.contractor) flags.push("Same vendor holds multiple project packages");
      rows.push({
        id, projectId: p.id, psId: p.psId, projectName: p.name, vendor: pick(VENDORS, p.psId, 300 + i),
        category: cats[hashSeed(`${p.psId}::${i}::cat`) % cats.length],
        value, benchmark, variancePct, risk, anomaly: ANOMALY_LABEL(variancePct), flags,
      });
      n++;
    }
  }
  return rows;
}

export interface ProcurementSummary {
  totalContracts: number;
  suspicious: number;
  priceAnomalies: number;
  vendorAlerts: number;
  flaggedVendors: { vendor: string; count: number }[];
}

export function procurementSummary(contracts: ContractRow[]): ProcurementSummary {
  const suspicious = contracts.filter(c => c.risk === "High").length;
  const priceAnomalies = contracts.filter(c => c.variancePct > 12).length;
  const byVendor = new Map<string, number>();
  for (const c of contracts) if (c.risk !== "Low") byVendor.set(c.vendor, (byVendor.get(c.vendor) ?? 0) + 1);
  const flaggedVendors = [...byVendor.entries()].map(([vendor, count]) => ({ vendor, count })).sort((a, b) => b.count - a.count);
  return { totalContracts: contracts.length, suspicious, priceAnomalies, vendorAlerts: flaggedVendors.length, flaggedVendors };
}

// ─── 6. Change orders ───────────────────────────────────────────────────────

export interface ChangeOrderRow {
  id: string;
  projectId: string;
  psId: string;
  projectName: string;
  raisedAt: string;           // ISO date
  description: string;
  costImpact: number;         // ₹ lakhs (signed)
  costImpactPct: number;      // % of approved budget
  scheduleImpactDays: number; // signed
  status: "Pending" | "Under Review" | "Approved" | "Rejected";
  risk: "Low" | "Medium" | "High";
}

const CO_REASONS = [
  "Additional utility relocation — unmapped underground services found during excavation",
  "Design specification change requested by the executing agency",
  "Change of material grade per revised IRC/IS code",
  "Scope addition: extra service lanes at two junctions",
  "Monsoon-damaged works re-execution and dewatering",
  "Rate revision due to steel price escalation beyond the escalation clause",
  "Land-acquisition-driven alignment shift for a 1.2 km stretch",
  "Vendor-recommended equipment substitution (obsolete model)",
] as const;

export function deriveChangeOrders(projects: Project[]): ChangeOrderRow[] {
  const rows: ChangeOrderRow[] = [];
  let n = 1;
  for (const p of projects) {
    // change orders concentrate on projects whose budget has actually moved
    const variance = p.totalBudget > 0 ? (p.projectedBudget - p.totalBudget) / p.totalBudget : 0;
    const count = Math.abs(variance) > 0.08 ? 2 + (hashSeed(`${p.psId}::co`) % 2) : Math.abs(variance) > 0.03 ? 1 : 0;
    for (let i = 0; i < count; i++) {
      const id = `CO-${String(n).padStart(3, "0")}`;
      const costImpactPct = round1(between(p.psId, 400 + i, 1.5, Math.max(4, 18 * (1 - p.healthScore / 100))));
      const costImpact = Math.round(p.totalBudget * costImpactPct / 100);
      const scheduleImpactDays = Math.round(between(p.psId, 500 + i, 5, 60));
      const status = pick(["Pending", "Under Review", "Approved", "Rejected"] as const, p.psId, 600 + i);
      rows.push({
        id, projectId: p.id, psId: p.psId, projectName: p.name,
        raisedAt: new Date(Date.now() - between(p.psId, 700 + i, 20, 330) * 864e5).toISOString(),
        description: pick(CO_REASONS, p.psId, 800 + i),
        costImpact, costImpactPct, scheduleImpactDays, status,
        risk: costImpactPct > 8 || scheduleImpactDays > 45 ? "High" : costImpactPct > 4 || scheduleImpactDays > 25 ? "Medium" : "Low",
      });
      n++;
    }
  }
  return rows.sort((a, b) => +new Date(b.raisedAt) - +new Date(a.raisedAt));
}

export function changeOrderSummary(cos: ChangeOrderRow[]) {
  return {
    total: cos.length,
    pending: cos.filter(c => c.status === "Pending").length,
    approvedCost: cos.filter(c => c.status === "Approved").reduce((s, c) => s + c.costImpact, 0),
    pipelineCost: cos.filter(c => c.status === "Pending" || c.status === "Under Review").reduce((s, c) => s + c.costImpact, 0),
    highRisk: cos.filter(c => c.risk === "High").length,
  };
}

// ─── 7. Authority review rollup ─────────────────────────────────────────────

export interface AuthorityProject {
  id: string;
  psId: string;
  name: string;
  riskScore: number;
  healthStatus: Project["healthStatus"];
  issues: string[];
  recommendedAction: string;
  needsDecision: boolean;   // has pending change orders awaiting approval
}

export interface AuthoritySummary {
  critical: number;
  financialAlerts: number;
  procurementAlerts: number;
  pendingApprovals: number;
  projects: AuthorityProject[];
  headline: string;
}

export function deriveAuthorityReview(projects: Project[], contracts: ContractRow[], cos: ChangeOrderRow[], stats: PortfolioStats): AuthoritySummary {
  const pendingByProject = new Map<string, number>();
  for (const c of cos) if (c.status === "Pending" || c.status === "Under Review") pendingByProject.set(c.psId, (pendingByProject.get(c.psId) ?? 0) + 1);

  const rows: AuthorityProject[] = projects
    .filter(p => p.healthStatus !== "HEALTHY")
    .map(p => {
      const issues: string[] = [];
      const variance = p.totalBudget > 0 ? (p.projectedBudget - p.totalBudget) / p.totalBudget : 0;
      if (variance > 0.10) issues.push(`Budget overrun forecast at ${round1(variance * 100)}% (above the 10% review threshold)`);
      if (p.prediction && p.prediction.probability > 0.7) issues.push(`Delay probability ${Math.round(p.prediction.probability * 100)}% (~${p.prediction.estimatedDays} days)`);
      const physFinGap = (p.totalBudget > 0 ? (p.spentBudget / p.totalBudget) : 0) * 100 - p.progress;
      if (physFinGap > 10) issues.push(`Payments run ${Math.round(physFinGap)} points ahead of physical work`);
      const highContracts = contracts.filter(c => c.psId === p.psId && c.risk === "High").length;
      if (highContracts > 0) issues.push(`${highContracts} procurement package${highContracts > 1 ? "s" : ""} priced above benchmark`);
      const lateCritical = p.milestones.filter(m => m.isCritical && (m.status === "DELAYED" || m.status === "BLOCKED")).length;
      if (lateCritical > 0) issues.push(`${lateCritical} critical milestone${lateCritical > 1 ? "s" : ""} delayed or blocked`);
      if (!issues.length) issues.push("Health below the healthy band — monitor");

      const needsDecision = (pendingByProject.get(p.psId) ?? 0) > 0;
      const recommendedAction = variance > 0.15
        ? "Detailed financial review before further release of funds"
        : physFinGap > 10
          ? "Field verification of physical progress vs running-account bills"
          : highContracts > 0
            ? "Vendor review and price re-benchmarking"
            : lateCritical > 1
              ? "Critical-path review meeting with the executing agency"
              : "Include in the next periodic review";

      return {
        id: p.id, psId: p.psId, name: p.name, riskScore: Math.max(0, Math.min(100, Math.round(100 - p.healthScore))),
        healthStatus: p.healthStatus, issues, recommendedAction, needsDecision,
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);

  const financialAlerts = projects.filter(p => p.totalBudget > 0 && (p.projectedBudget - p.totalBudget) / p.totalBudget > 0.10).length;
  const procurementAlerts = contracts.filter(c => c.risk === "High").length;

  const headline = rows.length === 0
    ? "All scoped projects are inside the healthy band — no authority-level escalations today."
    : `${rows.length} project${rows.length > 1 ? "s" : ""} carry combined financial, schedule and procurement risk. Authority review is recommended before approving further expenditure.`;

  return {
    critical: stats.critical, financialAlerts, procurementAlerts,
    pendingApprovals: cos.filter(c => c.status === "Pending" || c.status === "Under Review").length,
    projects: rows, headline,
  };
}

// ─── 8. Simple overview aggregates ─────────────────────────────────────────

export interface SimpleOverview {
  projects: number;
  budgetL: number;          // ₹ lakhs total approved
  highRisk: number;
  alertCount: number;       // unread alerts across portfolio
  progressLeaders: { id: string; psId: string; name: string; progress: number; healthStatus: Project["healthStatus"] }[];
  riskDistribution: { label: string; count: number; pct: number }[];
  recentAlerts: { id: string; psId: string; project: string; title: string; severity: string; createdAt: string }[];
}

export function deriveSimpleOverview(projects: Project[]): SimpleOverview {
  const budgetL = projects.reduce((s, p) => s + p.totalBudget, 0);
  const highRisk = projects.filter(p => p.healthStatus !== "HEALTHY").length;
  const alertCount = projects.reduce((s, p) => s + p.alerts.filter(a => !a.isRead).length, 0);
  const progressLeaders = projects.slice().sort((a, b) => b.progress - a.progress).slice(0, 5)
    .map(p => ({ id: p.id, psId: p.psId, name: p.name, progress: Math.round(p.progress), healthStatus: p.healthStatus }));
  const total = projects.length || 1;
  const healthy = projects.filter(p => p.healthStatus === "HEALTHY").length;
  const atRisk = projects.filter(p => p.healthStatus === "AT_RISK").length;
  const critical = projects.filter(p => p.healthStatus === "CRITICAL").length;
  const riskDistribution = [
    { label: "Low risk", count: healthy, pct: Math.round((healthy / total) * 100) },
    { label: "Medium risk", count: atRisk, pct: Math.round((atRisk / total) * 100) },
    { label: "High risk", count: critical, pct: Math.round((critical / total) * 100) },
  ];
  const recentAlerts = projects.flatMap(p => p.alerts.map(a => ({ ...a, id: p.id, psId: p.psId, project: p.name })))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6)
    .map(a => ({ id: a.id, psId: a.psId, project: a.project, title: a.title, severity: a.severity, createdAt: a.createdAt }));
  return { projects: projects.length, budgetL, highRisk, alertCount, progressLeaders, riskDistribution, recentAlerts };
}

// ─── shared export rows (CSV/Excel) ────────────────────────────────────────

export const csvRows = {
  costBenchmark: (rows: CostBenchmarkRow[]): (string | number)[][] => [
    ["PS-ID", "Project", "Sector", "Approved (₹ L)", "Intelligence benchmark (₹ L)", "Projected final (₹ L)", "Variance %", "Status", "Reason"],
    ...rows.map(r => [r.psId, r.name, r.sector, r.approved, r.aiBenchmark, r.trajectory, r.variancePct, r.status, r.reason]),
  ],
  budgetVariance: (rows: BudgetVarianceRow[]): (string | number)[][] => [
    ["PS-ID", "Project", "Approved (₹ L)", "Revised / projected (₹ L)", "Spent (₹ L)", "Remaining (₹ L)", "Variance %", "Status"],
    ...rows.map(r => [r.psId, r.name, r.approved, r.revised, r.spent, r.remaining, r.variancePct, r.status]),
  ],
  progressMismatch: (rows: ProgressMismatchRow[]): (string | number)[][] => [
    ["PS-ID", "Project", "Physical progress %", "Financial progress %", "Gap (pts)", "Status", "Interpretation"],
    ...rows.map(r => [r.psId, r.name, r.physical, r.financial, r.gap, r.status, r.interpretation]),
  ],
  riskScores: (rows: RiskScoreRow[]): (string | number)[][] => [
    ["PS-ID", "Project", "Risk score (0-100)", "Band", "Delay probability %", "Expected delay (days)", "Top factors"],
    ...rows.map(r => [r.psId, r.name, r.riskScore, r.band, r.delayProbability, r.expectedDelayDays, r.topFactors.map(f => `${f.label}`).join("; ")]),
  ],
  contracts: (rows: ContractRow[]): (string | number)[][] => [
    ["Contract ID", "PS-ID", "Project", "Vendor", "Category", "Value (₹ L)", "Benchmark (₹ L)", "Variance %", "Risk", "Anomaly", "Flags"],
    ...rows.map(r => [r.id, r.psId, r.projectName, r.vendor, r.category, r.value, r.benchmark, r.variancePct, r.risk, r.anomaly, r.flags.join("; ")]),
  ],
  changeOrders: (rows: ChangeOrderRow[]): (string | number)[][] => [
    ["CO ID", "PS-ID", "Project", "Raised", "Description", "Cost impact (₹ L)", "Cost impact %", "Schedule impact (days)", "Status", "Risk"],
    ...rows.map(r => [r.id, r.psId, r.projectName, new Date(r.raisedAt).toLocaleDateString("en-IN"), r.description, r.costImpact, r.costImpactPct, r.scheduleImpactDays, r.status, r.risk]),
  ],
  authority: (rows: AuthorityProject[]): (string | number)[][] => [
    ["PS-ID", "Project", "Risk score", "Issues", "Recommended action", "Pending decision"],
    ...rows.map(r => [r.psId, r.name, r.riskScore, r.issues.join("; "), r.recommendedAction, r.needsDecision ? "YES" : "No"]),
  ],
};
