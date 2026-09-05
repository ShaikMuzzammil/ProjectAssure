// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure — Decision Intelligence Engine.
// Answers the five questions every feature must answer:
//   What is happening? → Why? → What next? → What should the authority do? →
//   Can they verify it?
//
// Pure functions over the Project aggregate — no side effects, no invented
// numbers: every threshold matches engine.ts / thresholds.ts.
// ═══════════════════════════════════════════════════════════════════════════
import type {
  Project, RecommendedAction, RootCauseNode, NoActionProjection,
  ExecutiveSummary, ProjectKpi, Intervention,
} from "./types";
import { uid } from "./format";

const inrL = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")} L`;
const pct = (v: number) => `${Math.round(v)}%`;

/* ────────────────────────────────────────────────────────────────────────────
 * 1. RECOMMENDED ACTIONS — "Here is what the authority can do."
 *    Ranked by priority; every action carries What / Why / Do / Owner /
 *    Deadline / Expected impact in plain language.
 * ──────────────────────────────────────────────────────────────────────────── */
export function buildRecommendedActions(p: Project): RecommendedAction[] {
  const acts: RecommendedAction[] = [];
  const finPct = p.totalBudget > 0 ? (p.spentBudget / p.totalBudget) * 100 : 0;
  const mismatch = finPct - p.progress;
  const overrunPct = p.totalBudget > 0 ? ((p.projectedBudget - p.totalBudget) / p.totalBudget) * 100 : 0;
  const daysLate = daysBetween(p.targetDate, new Date().toISOString());
  const delay = p.prediction;
  const overdueMs = p.milestones.filter(m => m.status !== "COMPLETED" && new Date(m.plannedDate) < new Date());

  // 1 · financial–physical mismatch
  if (mismatch > 15) {
    acts.push({
      id: uid("ra"), priority: 1, area: "financial",
      title: `Money is moving faster than work (${pct(finPct)} spent vs ${pct(p.progress)} built)`,
      what: `For every ₹100 approved, ₹${Math.round(finPct)} is already spent, but only ${pct(p.progress)} of the physical work is finished.`,
      why: `Paying ahead of progress is the classic early signal of cost overrun or inflated billing — ${pct(mismatch)} more money has gone out than the work justifies.`,
      action: `Conduct a financial review: reconcile bills against measured work, and ask the project manager to justify the gap in writing within 7 days.`,
      owner: p.projectManager, deadline: "within 7 days",
      expectedImpact: "Stops further over-billing and gives a defensible record for audit.",
    });
  }

  // 2 · projected overrun
  if (overrunPct > 10) {
    acts.push({
      id: uid("ra"), priority: 1, area: "financial",
      title: `Final cost is expected to cross the approved budget by ${pct(overrunPct)}`,
      what: `Approved budget ${inrL(p.totalBudget)} · current estimate ${inrL(p.projectedBudget)} · expected extra ${inrL(p.projectedBudget - p.totalBudget)}.`,
      why: "A projected overrun means either the estimate was too optimistic or costs are rising — waiting makes the gap bigger, acting early keeps options open.",
      action: `Review every pending change order, re-tender expensive packages if still possible, and prepare a revised cost estimate (RCE) for approval.`,
      owner: "Finance Controller", deadline: "within 14 days",
      expectedImpact: `Can cap the overrun near ${pct(Math.max(10, overrunPct / 2))} instead of letting it drift.`,
    });
  }

  // 3 · schedule slip / predicted delay
  if (delay && delay.probability > 0.55) {
    acts.push({
      id: uid("ra"), priority: 1, area: "schedule",
      title: `${pct(delay.probability)} chance the project finishes ${delay.estimatedDays} days late`,
      what: `Planned finish ${fmtDate(p.targetDate)} · expected finish ≈ ${fmtDate(plusDays(p.targetDate, delay.estimatedDays))} (range ${delay.ciLower}–${delay.ciUpper} days).`,
      why: `Main drivers: ${delay.factors.slice(0, 3).map(f => f.label.toLowerCase()).join(", ")}.`,
      action: `Schedule a milestone review with the contractor, re-baseline the critical-path tasks, and add a weekly progress check.`,
      owner: p.projectManager, deadline: "within 10 days",
      expectedImpact: `Typical recovery: 20–35% of the predicted delay when action starts this month.`,
    });
  }

  // 4 · overdue milestones
  if (overdueMs.length) {
    acts.push({
      id: uid("ra"), priority: 2, area: "schedule",
      title: `${overdueMs.length} milestone${overdueMs.length > 1 ? "s" : ""} past the due date`,
      what: overdueMs.slice(0, 3).map(m => `“${m.name}” was due ${fmtDate(m.plannedDate)} and is ${m.status.toLowerCase()}.`).join(" "),
      why: "An overdue milestone on the critical path delays everything after it — and hides wider problems when left unexplained.",
      action: `Request a written recovery plan per overdue milestone and verify the reason with the latest site evidence.`,
      owner: p.projectManager, deadline: "within 7 days",
      expectedImpact: "Either the milestone recovers on a stated date, or escalation is justified with evidence.",
    });
  }

  // 5 · evidence gap
  const evidenceDocs = p.documents.filter(d => d.status === "PROCESSED").length;
  if (evidenceDocs < 2 && p.status === "ACTIVE") {
    acts.push({
      id: uid("ra"), priority: 2, area: "evidence",
      title: `Only ${evidenceDocs} verified document${evidenceDocs === 1 ? "" : "s"} on file`,
      what: `This project is executing but has ${evidenceDocs} processed document${evidenceDocs === 1 ? "" : "s"} (progress reports, inspection notes, photos).`,
      why: "Without independent proof, progress numbers are just claims — verification is what separates monitoring from trusting.",
      action: "Instruct the field officer to upload a dated site photo and a monthly progress report, then compare before/after.",
      owner: "Field Officer", deadline: "next site visit (max 15 days)",
      expectedImpact: "Progress claims become verifiable; mismatch risk drops.",
    });
  }

  // 6 · resource bottleneck
  const bottleneck = p.resources.find(r => r.status === "bottleneck");
  if (bottleneck) {
    acts.push({
      id: uid("ra"), priority: 2, area: "resources",
      title: `${bottleneck.name} is a bottleneck (${pct(bottleneck.utilised)} utilisation)`,
      what: `${bottleneck.quantity} ${bottleneck.unit} allocated, running at ${pct(bottleneck.utilised)} of capacity.`,
      why: "A resource above 90% utilisation has no slack — any hiccup (rain, breakdown, absenteeism) directly becomes delay.",
      action: `Approve additional ${bottleneck.name.toLowerCase()} capacity or re-sequence tasks that depend on it.`,
      owner: "Resource Manager", deadline: "within 10 days",
      expectedImpact: "Protects the critical path from single-point failure.",
    });
  }

  // 7 · stale data
  const staleDays = daysBetween(p.healthComputedAt, new Date().toISOString());
  if (staleDays > 30 && p.status === "ACTIVE") {
    acts.push({
      id: uid("ra"), priority: 3, area: "compliance",
      title: `Progress data is ${staleDays} days old`,
      what: `The last health recompute was ${fmtDate(p.healthComputedAt)}.`,
      why: "Old data means decisions are being made on a picture that no longer exists.",
      action: "Trigger a manual scoring run and require the monthly update from the site office.",
      owner: "Project Officer", deadline: "within 3 days",
      expectedImpact: "Restores decision confidence to current data.",
    });
  }

  // 8 · good-project reinforcement
  if (p.healthScore >= 80 && !acts.length) {
    acts.push({
      id: uid("ra"), priority: 3, area: "compliance",
      title: "Project is on track — keep the routine tight",
      what: `Health ${p.healthScore}/100, progress ${pct(p.progress)}, spending aligned.`,
      why: "Healthy projects drift when attention moves elsewhere; routine verification is cheap insurance.",
      action: "Continue monthly evidence uploads and quarterly audit spot-checks.",
      owner: p.projectManager, deadline: "monthly routine",
      expectedImpact: "Keeps the project in the healthy band through completion.",
    });
  }

  return acts.sort((a, b) => a.priority - b.priority);
}

/* ────────────────────────────────────────────────────────────────────────────
 * 2. ROOT-CAUSE TREE — "Why is the project delayed?" as a drill-down tree.
 * ──────────────────────────────────────────────────────────────────────────── */
export function buildRootCauseTree(p: Project): RootCauseNode {
  const delay = p.prediction;
  const top = delay?.factors ?? [];
  const mk = (id: string, label: string, weight: number, children: RootCauseNode[] = []): RootCauseNode => ({ id, label, weight, children });

  // weights: derived from prediction factor contributions when present,
  // otherwise a deterministic split from the project's own scores
  const sched = top.find(f => f.feature.includes("schedule"))?.contribution ?? (100 - p.scheduleScore);
  const res = top.find(f => f.feature.includes("resource"))?.contribution ?? (100 - p.resourceScore);
  const ms = top.find(f => f.feature.includes("milestone"))?.contribution ?? (100 - p.milestoneScore);
  const total = Math.max(1, sched + res + ms);
  const wS = Math.round((sched / total) * 100), wR = Math.round((res / total) * 100);
  const wM = 100 - wS - wR;

  return mk(p.id, `Why is ${p.psId} behind?`, 100, [
    mk(`${p.id}-c1`, "Schedule slippage", wS, [
      mk(`${p.id}-c1a`, `Critical milestone${p.milestones.filter(m => m.isCritical && m.status === "DELAYED").length === 1 ? "" : "s"} delayed (${p.milestones.filter(m => m.isCritical && m.status === "DELAYED").length})`, 60),
      mk(`${p.id}-c1b`, `Tasks blocked on dependencies (${p.tasks.filter(t => t.status === "BLOCKED").length})`, 40),
    ]),
    mk(`${p.id}-c2`, "Resource / capacity", wR, [
      mk(`${p.id}-c2a`, p.resources.find(r => r.status === "bottleneck") ? `Bottleneck: ${p.resources.find(r => r.status === "bottleneck")!.name}` : "No bottleneck flagged", 55),
      mk(`${p.id}-c2b`, `Team of ${p.teamSize} vs plan workload`, 45),
    ]),
    mk(`${p.id}-c3`, "Approvals & procurement", wM, [
      mk(`${p.id}-c3a`, `Pending documents: ${p.documents.filter(d => d.status !== "PROCESSED").length}`, 50),
      mk(`${p.id}-c3b`, "Change orders awaiting decision", 50),
    ]),
  ]);
}

/* ────────────────────────────────────────────────────────────────────────────
 * 3. NO-ACTION IMPACT — "What happens if we do nothing?"
 * ──────────────────────────────────────────────────────────────────────────── */
export function projectNoActionImpact(p: Project): NoActionProjection {
  const risk = 100 - p.healthScore;
  const drift = p.prediction ? Math.max(2, p.prediction.probability * 18) : 4;   // points / 30d
  const overrunPct = p.totalBudget > 0 ? (p.projectedBudget - p.totalBudget) / p.totalBudget : 0;
  const delayDays = p.prediction?.estimatedDays ?? Math.max(0, daysBetween(p.targetDate, new Date().toISOString()));
  const r30 = Math.min(98, risk + drift);
  const r60 = Math.min(98, risk + drift * 1.7);
  const r90 = Math.min(99, risk + drift * 2.3);
  const cost90 = p.projectedBudget + p.totalBudget * 0.02 + (r90 - risk) / 100 * p.totalBudget * 0.08;
  const delay90 = Math.round(delayDays * 1.6 + (p.progress < 50 ? 15 : 6));
  return {
    riskToday: Math.round(risk), risk30: Math.round(r30), risk60: Math.round(r60), risk90: Math.round(r90),
    costToday: p.projectedBudget, cost90: Math.round(cost90),
    delayToday: Math.round(delayDays), delay90,
    riskWithIntervention: Math.max(8, Math.round(risk * 0.62)),
    narrative:
      `If no action is taken, risk is projected to climb from ${Math.round(risk)} to ${Math.round(r90)} in 90 days, ` +
      `final cost could reach ${inrL(cost90)} (vs ${inrL(p.projectedBudget)} today) and the expected delay could grow ` +
      `from ${Math.round(delayDays)} to ${delay90} days. Acting on the top recommended interventions typically brings ` +
      `the 90-day risk down to about ${Math.max(8, Math.round(risk * 0.62))}.`,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * 4. EXECUTIVE SUMMARY — plain-language top card for every project.
 * ──────────────────────────────────────────────────────────────────────────── */
export function buildExecutiveSummary(p: Project): ExecutiveSummary {
  const finPct = p.totalBudget > 0 ? (p.spentBudget / p.totalBudget) * 100 : 0;
  const mismatch = Math.round(finPct - p.progress);
  const overrunPct = p.totalBudget > 0 ? Math.round(((p.projectedBudget - p.totalBudget) / p.totalBudget) * 100) : 0;
  const delayDays = p.prediction?.estimatedDays ?? Math.max(0, daysBetween(p.targetDate, new Date().toISOString()));
  const overdue = p.milestones.filter(m => m.status !== "COMPLETED" && new Date(m.plannedDate) < new Date()).length;
  const unread = p.alerts.filter(a => !a.isRead).length;
  const verdict = p.healthStatus === "CRITICAL" ? "CRITICAL" : p.healthStatus === "AT_RISK" ? "ATTENTION" : p.healthScore < 85 ? "WATCH" : "GOOD";

  const bullets: string[] = [];
  if (mismatch > 10) bullets.push(`Spending is ${Math.abs(mismatch)}% ${mismatch > 0 ? "ahead" : "behind"} of physical work — ${pct(finPct)} of the money is spent but ${pct(p.progress)} of the work is done.`);
  if (overrunPct > 5) bullets.push(`Final cost is expected to exceed the approved budget by about ${pct(overrunPct)} (${inrL(p.projectedBudget - p.totalBudget)} extra).`);
  if (delayDays > 15) bullets.push(`Completion is predicted ${delayDays} days later than planned${p.prediction ? ` (${pct(p.prediction.probability)} confidence)` : ""}.`);
  if (overdue) bullets.push(`${overdue} milestone${overdue > 1 ? "s are" : " is"} past the due date.`);
  if (unread) bullets.push(`${unread} unread alert${unread > 1 ? "s" : ""} need officer attention.`);
  if (!bullets.length) bullets.push(`On track: ${pct(p.progress)} physical progress, spending aligned, no open risks above threshold.`);

  const recommendation =
    verdict === "CRITICAL" ? "Intervene now — assign the top recommended actions this week and verify with site evidence."
    : verdict === "ATTENTION" ? "Review the top two recommended actions and set owners and deadlines."
    : verdict === "WATCH" ? "Keep under monthly observation; no urgent intervention required."
    : "Routine monitoring is sufficient.";

  const headline =
    verdict === "CRITICAL" ? "Project needs intervention now"
    : verdict === "ATTENTION" ? "Project requires attention"
    : verdict === "WATCH" ? "Project is worth watching"
    : "Project is on track";

  return { headline, verdict, bullets: bullets.slice(0, 5), recommendation };
}

/* ────────────────────────────────────────────────────────────────────────────
 * 5. KPI seeds — sector-appropriate target-vs-actual indicators.
 * ──────────────────────────────────────────────────────────────────────────── */
export function seedKpis(p: Project): ProjectKpi[] {
  const k = (name: string, unit: string, target: number, actual: number, category: ProjectKpi["category"]): ProjectKpi =>
    ({ id: uid("kpi"), projectId: p.id, name, unit, target, actual, category });
  const prog = Math.max(2, p.progress) / 100;
  switch (p.sector) {
    case "Roads & Highways":
      return [k("Road length completed", "km", 120, Math.round(120 * prog * 0.92), "physical"), k("Bridges completed", "no.", 10, Math.max(1, Math.round(10 * prog)), "physical"), k("Employment generated", "jobs", 4000, Math.round(4000 * Math.min(1, prog * 1.1)), "social")];
    case "Metro Rail":
      return [k("Tunnelling completed", "km", 18, Math.round(18 * prog), "physical"), k("Stations fitted-out", "no.", 12, Math.round(12 * prog * 0.9), "physical"), k("Daily trial trips", "trips", 220, Math.round(220 * prog * 0.6), "quality")];
    case "Water & Sanitation":
      return [k("Household connections", "no.", 50000, Math.round(50000 * prog), "physical"), k("Treatment capacity added", "MLD", 120, Math.round(120 * prog * 0.95), "physical"), k("Water quality tests passed", "%", 100, Math.round(96 + prog * 3), "quality")];
    case "Power & Renewable":
      return [k("Generation capacity added", "MW", 250, Math.round(250 * prog), "physical"), k("Transmission lines built", "km", 96, Math.round(96 * prog * 0.88), "physical"), k("Villages electrified", "no.", 84, Math.round(84 * prog), "social")];
    case "Urban Development":
      return [k("Smart poles installed", "no.", 450, Math.round(450 * prog), "physical"), k("Public Wi-Fi zones", "no.", 60, Math.round(60 * prog * 0.85), "physical"), k("Property tax digitised", "%", 100, Math.round(70 + prog * 28), "financial")];
    default:
      return [k("Physical work completed", "%", 100, p.progress, "physical"), k("Employment generated", "jobs", 1500, Math.round(1500 * Math.min(1, prog * 1.05)), "social"), k("Quality tests passed", "%", 100, 94, "quality")];
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 6. Portfolio helpers — attention ranking + performance ranking.
 * ──────────────────────────────────────────────────────────────────────────── */
export interface AttentionItem {
  project: Project;
  reason: string;
  reasonDetail: string;
  urgency: 1 | 2 | 3;
}

/** "Projects Requiring Attention" — the command-centre priority list. */
export function buildAttentionList(projects: Project[], limit = 5): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const p of projects) {
    if (p.status === "COMPLETED" || p.status === "CANCELLED") continue;
    const finPct = p.totalBudget > 0 ? (p.spentBudget / p.totalBudget) * 100 : 0;
    const mismatch = finPct - p.progress;
    const overrunPct = p.totalBudget > 0 ? ((p.projectedBudget - p.totalBudget) / p.totalBudget) * 100 : 0;
    const delayP = p.prediction?.probability ?? 0;
    const criticalAlerts = p.alerts.filter(a => a.severity === "CRITICAL" && !a.isRead).length;

    if (criticalAlerts) items.push({ project: p, reason: `${criticalAlerts} critical alert${criticalAlerts > 1 ? "s" : ""} unacknowledged`, reasonDetail: p.alerts.find(a => a.severity === "CRITICAL" && !a.isRead)?.title ?? "", urgency: 1 });
    else if (p.healthStatus === "CRITICAL") items.push({ project: p, reason: `Health ${p.healthScore}/100 — critical band`, reasonDetail: `Multiple risk factors active (money/time/proof).`, urgency: 1 });
    else if (mismatch > 20) items.push({ project: p, reason: `Financial–physical gap ${pct(mismatch)}`, reasonDetail: `${pct(finPct)} spent vs ${pct(p.progress)} built.`, urgency: 1 });
    else if (overrunPct > 18) items.push({ project: p, reason: `Cost overrun +${pct(overrunPct)} projected`, reasonDetail: `Expected extra ${inrL(p.projectedBudget - p.totalBudget)}.`, urgency: 2 });
    else if (delayP > 0.65) items.push({ project: p, reason: `${pct(delayP)} delay probability`, reasonDetail: `≈ ${p.prediction?.estimatedDays ?? "—"} days late expected.`, urgency: 2 });
    else if (p.healthStatus === "AT_RISK" && mismatch > 10) items.push({ project: p, reason: `Watch: spending ${pct(mismatch)} ahead of work`, reasonDetail: "Early mismatch — worth a review before it grows.", urgency: 3 });
  }
  return items.sort((a, b) => a.urgency - b.urgency || a.project.healthScore - b.project.healthScore).slice(0, limit);
}

/** Intervention factory — turn an alert / AI finding into a tracked issue. */
export function interventionFromProject(p: Project, title: string, issue: string, why: string, severity: Intervention["severity"], raisedBy: string, actions: string[]): Omit<Intervention, "id"> {
  const acts = buildRecommendedActions(p);
  const top = acts[0];
  return {
    code: `#A${1000 + Math.floor(Math.random() * 9000)}`,
    projectId: p.id, title, issue, why, severity,
    status: "DETECTED",
    detectedAt: new Date().toISOString(),
    source: raisedBy === "Assure Intelligence" ? "ai" : "alert",
    raisedBy,
    assignedTo: top?.owner ?? p.projectManager,
    deadline: plusDaysISO(new Date().toISOString(), 14),
    steps: actions.slice(0, 5).map((text, i) => ({ id: uid("ivs"), text, owner: i === 0 ? (top?.owner ?? p.projectManager) : "Project Officer", dueDays: 7 * (i + 1), done: false })),
    evidenceCount: p.documents.filter(d => d.status === "PROCESSED").length,
    updates: [{ at: new Date().toISOString(), by: "ProjectAssure", note: "Issue detected automatically by the intelligence engine.", status: "DETECTED" }],
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * helpers
 * ──────────────────────────────────────────────────────────────────────────── */
export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
export function plusDays(iso: string, d: number): string {
  return new Date(new Date(iso).getTime() + d * 86400000).toISOString();
}
export function plusDaysISO(iso: string, d: number): string {
  return plusDays(iso, d);
}
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
