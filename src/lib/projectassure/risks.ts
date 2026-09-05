// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure — Live risk engine (v8).
// ONE register that always has MANY risks, drawn from three honest sources:
//   1. DOCUMENTS  — every uploaded report is scanned against a 45-pattern
//                   risk taxonomy (schedule, money, procurement, people,
//                   quality, approvals, environment, safety).
//   2. ENGINE     — live signals (delay probability, burn ratio, delayed
//                   milestones, data staleness, resource bottlenecks).
//   3. CONTEXT    — sector / stage / size heuristics (monsoon window, land
//                   acquisition, pending tender, statutory clearances).
// The register recomputes whenever a document lands or data changes, so the
// risk tab is never empty and never shows a single lonely line again.
// ═══════════════════════════════════════════════════════════════════════════
import type { Project, DocumentItem, RiskLevel, Alert } from "./types";
import { uid } from "./format";

export type RiskCategory =
  | "schedule" | "budget" | "procurement" | "resources"
  | "quality" | "compliance" | "external" | "safety";

export const RISK_CATEGORY_META: Record<RiskCategory, { label: string; hint: string }> = {
  schedule: { label: "Time", hint: "Dates, milestones and pace of work." },
  budget: { label: "Money", hint: "Spending vs sanction and forecast overrun." },
  procurement: { label: "Purchases", hint: "Vendor prices, tendering and supplies." },
  resources: { label: "People & Machines", hint: "Labour, equipment and material on site." },
  quality: { label: "Quality", hint: "Workmanship, defects and rework." },
  compliance: { label: "Approvals", hint: "Permissions, sanctions and mandatory papers." },
  external: { label: "Outside factors", hint: "Weather, land, courts and communities." },
  safety: { label: "Safety", hint: "Site safety and incidents." },
};

export type RiskSource = "document" | "engine" | "context";

export interface DerivedRisk {
  id: string;
  category: RiskCategory;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  impact: number;             // 0-100 — how bad if it happens
  likelihood: number;         // 0-100 — how likely it is
  evidence: string;           // what we saw (document line or live signal)
  description: string;        // plain language: what it means
  mitigation: string;         // plain language: what to do
  source: RiskSource;
  sourceDoc?: string;         // file name for document-sourced risks
  detectedAt: string;
}

export interface DerivedRiskRegister {
  risks: DerivedRisk[];
  scheduleRisk: number;
  budgetRisk: number;
  resourceRisk: number;
  overallRisk: number;
  riskLevel: RiskLevel;
  computedAt: string;
  counts: { documents: number; engine: number; context: number; total: number };
}

// ─── 1. Document risk taxonomy ───────────────────────────────────────────────
// Each pattern: what the text says → a risk entry with an action.
interface Pattern { re: RegExp; category: RiskCategory; title: string; severity: DerivedRisk["severity"]; description: string; mitigation: string }

const PATTERNS: Pattern[] = [
  // schedule / time
  { re: /(?:delay|slippage|slip)\D{0,30}(\d{1,3})\s*days?/i, category: "schedule", title: "Schedule slip reported in document", severity: "HIGH", description: "The report itself admits work is running behind the planned dates.", mitigation: "Ask the project manager for a catch-up plan with weekly checkpoints." },
  { re: /behind (?:schedule|baseline|plan)/i, category: "schedule", title: "Work behind the approved plan", severity: "MEDIUM", description: "Physical work is not keeping pace with the baseline programme.", mitigation: "Re-sequence critical-path activities and re-approve the schedule." },
  { re: /critical[- ]path/i, category: "schedule", title: "Critical-path pressure", severity: "MEDIUM", description: "Activities with zero float are mentioned — any hiccup directly moves the finish date.", mitigation: "Protect critical activities with standby resources and daily tracking." },
  { re: /extension of time|eot\b|time extension/i, category: "schedule", title: "Time-extension request", severity: "MEDIUM", description: "A formal extension of time is being sought, which signals a date change.", mitigation: "Audit the justification before granting; check idle-resource records." },
  { re: /milestone[^.]{0,60}(?:missed|delayed|deferred|pending)/i, category: "schedule", title: "Milestone at risk", severity: "HIGH", description: "A contractual milestone is missed, delayed or still pending.", mitigation: "Review the milestone owner and put a recovery date in writing." },
  { re: /reschedul|re-baseline|rebaseline|re-phasing/i, category: "schedule", title: "Re-baselining under discussion", severity: "MEDIUM", description: "The plan dates are being reopened — history must be preserved.", mitigation: "Approve the new baseline only with a variance note in the audit trail." },
  // budget / money
  { re: /(?:overrun|overshoot|exceed\w*)\D{0,30}(?:₹\s?)?([\d.,]+)\s?(?:%|percent|crore|cr|lakh)/i, category: "budget", title: "Cost overrun signal", severity: "HIGH", description: "Spending is running past the sanctioned amount or its band.", mitigation: "Trigger the mandatory weekly re-forecast and hold milestone payments." },
  { re: /cost (?:escalat|increas|rise)/i, category: "budget", title: "Cost escalation", severity: "MEDIUM", description: "Input costs are moving up against the estimate.", mitigation: "Re-check rate approvals and contingency headroom." },
  { re: /payment(?:s)? (?:pending|delayed|dispute|held|withheld)/i, category: "budget", title: "Payment pipeline friction", severity: "MEDIUM", description: "Bills or payments are stuck — vendors slow down when cash slows down.", mitigation: "Clear undisputed bills within the contract window; document disputes." },
  { re: /contingency (?:is )?(?:low|exhausted|inadequate|depleted)/i, category: "budget", title: "Contingency nearly used up", severity: "HIGH", description: "The safety margin for surprises is thin.", mitigation: "Re-estimate remaining risk exposure before approving new expenses." },
  { re: /budget (?:cut|reduc|constrain)|fund(?:s)? (?:not )?available|fund(?:ing)? (?:delay|shortfall)/i, category: "budget", title: "Funding availability risk", severity: "HIGH", description: "Money flow itself may be constrained this cycle.", mitigation: "Get a written phasing confirmation from the finance division." },
  { re: /liabilit\w+|pending dues|arrears/i, category: "budget", title: "Outstanding liabilities", severity: "MEDIUM", description: "Older dues are accumulating on the books.", mitigation: "Schedule a liability clearance plan with aging analysis." },
  { re: /variation|change order|extra item|additional item/i, category: "budget", title: "Scope/variation pressure", severity: "MEDIUM", description: "Extra items or variations are adding cost beyond the base scope.", mitigation: "Cap cumulative variations and route new ones through the approval gate." },
  // procurement / vendors
  { re: /procurement (?:anomaly|delay|irregular)|tender (?:delay|pending|dispute|cancel)/i, category: "procurement", title: "Procurement process flag", severity: "HIGH", description: "Tendering or buying is delayed or flagged as unusual.", mitigation: "Single-source justification check and a revised procurement calendar." },
  { re: /vendor[^.]{0,50}(?:default|fail|delay|non[- ]?deliver|underperform)/i, category: "procurement", title: "Vendor performance risk", severity: "HIGH", description: "A supplier is not delivering to contract.", mitigation: "Issue a show-cause notice; line up an alternate source." },
  { re: /single (?:source|supplier)|sole (?:source|supplier)/i, category: "procurement", title: "Single-source dependency", severity: "MEDIUM", description: "One supplier controls a critical item.", mitigation: "Qualify a second vendor or hold buffer stock." },
  { re: /material (?:shortage|scarcity|delay)|supply (?:gap|shortfall|delay)/i, category: "procurement", title: "Material supply gap", severity: "MEDIUM", description: "Materials are not arriving as needed for the work fronts.", mitigation: "Advance-indent critical materials and monitor delivery lead times." },
  { re: /price(?:s)? (?:spike|surge|volatil)|rate (?:spike|increase)/i, category: "procurement", title: "Price volatility", severity: "MEDIUM", description: "Market prices for key items are unstable.", mitigation: "Consider rate-locked contracts for the next procurement cycle." },
  { re: /cartel|bid rigging|collusion|anti[- ]?competitive/i, category: "procurement", title: "Competition integrity flag", severity: "CRITICAL", description: "Text suggests bidding may not be genuinely competitive.", mitigation: "Refer to the vigilance desk; re-tender the affected package." },
  // resources / people & machines
  { re: /(?:labour|labor|manpower|workforce) (?:shortage|scarcity|deficit|absent)/i, category: "resources", title: "Labour shortage", severity: "HIGH", description: "Not enough workers to keep the planned fronts running.", mitigation: "Approve overtime or labour from the district pool; re-sequence." },
  { re: /(?:idle|unutilised|unutilized|stand(?:ing)?[- ]?by)[^.]{0,40}(?:equipment|machinery|plant|jcb|crane)/i, category: "resources", title: "Idle equipment burning cost", severity: "MEDIUM", description: "Machines are on hire but not working.", mitigation: "Release idle machinery to another site or renegotiate the hire." },
  { re: /(?:staff|engineer|officer)[^.]{0,40}(?:vacan|short|attrition|resign|transfer)/i, category: "resources", title: "Key-person gap", severity: "MEDIUM", description: "Supervision or approvals may thin out.", mitigation: "Arrange backfill or delegation of financial powers." },
  { re: /(?:skill|trained|certified)[^.]{0,30}(?:gap|shortage|lack)/i, category: "resources", title: "Skills gap", severity: "MEDIUM", description: "Specialist skills for the next phase are thin.", mitigation: "Schedule training or engage a specialist consultant." },
  // quality / technical
  { re: /(?:defect|rework|poor workmanship|substandard|quality (?:fail|issue|lapse|non[- ]?conform))/i, category: "quality", title: "Quality / rework flag", severity: "HIGH", description: "Work done is not up to specification and must be redone.", mitigation: "Independent quality audit and a rectification plan with owner." },
  { re: /(?:test|trial|inspection)[^.]{0,40}(?:fail|reject|below)/i, category: "quality", title: "Test or inspection failure", severity: "HIGH", description: "Checks are failing against the accepted standard.", mitigation: "Root-cause the failure; re-test after correction with proof." },
  { re: /design (?:change|revision|error|flaw)|drawing (?:revision|clarification)/i, category: "quality", title: "Design instability", severity: "MEDIUM", description: "Drawings/designs are still moving — rework risk.", mitigation: "Freeze the design baseline for the affected package." },
  { re: /(?:crack|seepage|leak|settlement|structural (?:concern|issue))/i, category: "quality", title: "Physical distress observed", severity: "HIGH", description: "The asset itself shows signs of distress.", mitigation: "Condition survey by the design consultant within 7 days." },
  // compliance / approvals
  { re: /(?:approval|permission|clearance|sanction|no objection|noc)[^.]{0,50}(?:pending|awaited|delay|not received)/i, category: "compliance", title: "Approval pending", severity: "HIGH", description: "A statutory or financial approval is holding up progress.", mitigation: "Track with the issuing authority weekly; escalate after 2 cycles." },
  { re: /(?:forest|environment(?:al)?|pollution|wildlife|coastal)[^.]{0,40}(?:clearance|permission|approval)/i, category: "compliance", title: "Environmental clearance linkage", severity: "HIGH", description: "Green clearances sit on the critical path.", mitigation: "Pre-file compliance documentation; seek conditional clearance." },
  { re: /land (?:acquisition|dispute|handover|possession)/i, category: "compliance", title: "Land availability risk", severity: "HIGH", description: "Land is not fully in hand for the works.", mitigation: "Joint survey with the revenue department; phase works around available land." },
  { re: /court|litigation|arbitration|legal (?:dispute|case)/i, category: "compliance", title: "Legal proceeding attached", severity: "HIGH", description: "A case or arbitration is live against the works.", mitigation: "Legal opinion on exposure; document status for the audit trail." },
  { re: /compliance (?:gap|lapse|breach)|regulator\w* (?:flag|notice|penalty)/i, category: "compliance", title: "Compliance breach noted", severity: "MEDIUM", description: "A mandatory rule was not met.", mitigation: "File the rectification report with the regulator." },
  { re: /statutory[^.]{0,40}(?:pending|due|lap)/i, category: "compliance", title: "Statutory obligation pending", severity: "MEDIUM", description: "Statutory filings or consents are due.", mitigation: "Assign a single owner with a calendar reminder." },
  // external / environment
  { re: /monsoon|heavy rain|flood|cyclone|unseasonal rain/i, category: "external", title: "Weather window exposure", severity: "MEDIUM", description: "Weather can stop site work in the mentioned window.", mitigation: "Shift monsoon-unsafe activities outside the window; verify insurance." },
  { re: /(?:site)? ?access (?:blocked|denied|restricted|issue)/i, category: "external", title: "Site access constraint", severity: "MEDIUM", description: "Getting to or inside the work site is restricted.", mitigation: "Coordinate with local authorities for an access window." },
  { re: /(?:community|public|local)[^.]{0,40}(?:protest|objection|agitation|resist)/i, category: "external", title: "Community objection", severity: "MEDIUM", description: "Local stakeholders are opposing the works.", mitigation: "Grievance redressal meeting; document commitments." },
  { re: /right of way|row clearance|utility (?:shifting|relocation)/i, category: "external", title: "Right-of-way / utility shifting", severity: "HIGH", description: "Corridor availability depends on others moving utilities first.", mitigation: "Joint utility plan with firm dates from each agency." },
  { re: /(?:earthquake|landslide|sinking|subsidence|geotech\w* (?:issue|surprise))/i, category: "external", title: "Ground condition surprise", severity: "HIGH", description: "Sub-surface conditions differ from the assumption.", mitigation: "Additional geotechnical investigation before the next pour." },
  // safety
  { re: /(?:accident|injur|fatalit|casualt)/i, category: "safety", title: "Safety incident reported", severity: "CRITICAL", description: "A site safety event occurred.", mitigation: "Incident report within 24h; safety stand-down and re-briefing." },
  { re: /(?:unsafe|safety (?:lapse|violation|concern|issue)|without (?:helmet|harness))/i, category: "safety", title: "Unsafe practice observed", severity: "HIGH", description: "Safety protocols are not being followed on site.", mitigation: "Safety audit and toolbox re-training; photograph compliance." },
  { re: /fire (?:risk|hazard|incident)|gas leak|electrical hazard/i, category: "safety", title: "Hazard exposure", severity: "HIGH", description: "A specific hazard is live on site.", mitigation: "Immediate mitigation plan and hazard register update." },
];

/** Scan a document's text for every risk pattern it contains. */
export function scanDocumentRisks(text: string, docName: string): DerivedRisk[] {
  const found: DerivedRisk[] = [];
  const seen = new Set<string>();
  for (const pat of PATTERNS) {
    const m = pat.re.exec(text);
    if (!m) continue;
    if (seen.has(pat.title)) continue;
    seen.add(pat.title);
    const quote = text.slice(Math.max(0, m.index - 10), Math.min(text.length, m.index + 110)).replace(/\s+/g, " ").trim();
    const sevRank = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[pat.severity];
    const impact = pat.severity === "CRITICAL" ? 82 : pat.severity === "HIGH" ? 66 : pat.severity === "MEDIUM" ? 44 : 26;
    found.push({
      id: uid("rk"), category: pat.category, title: pat.title, severity: pat.severity,
      impact, likelihood: 40 + sevRank * 8,
      evidence: `“${quote}…”`, sourceDoc: docName, source: "document",
      description: pat.description, mitigation: pat.mitigation,
      detectedAt: new Date().toISOString(),
    });
  }
  return found;
}

// ─── 2. Engine + context signals ─────────────────────────────────────────────
function engineRisks(p: Project): DerivedRisk[] {
  const out: DerivedRisk[] = [];
  const add = (r: Omit<DerivedRisk, "id" | "detectedAt" | "source"> & { source?: RiskSource }) =>
    out.push({ id: uid("rk"), detectedAt: new Date().toISOString(), source: "engine", ...r });

  const delayed = p.milestones.filter(m => m.status === "DELAYED").length;
  if (delayed > 0) add({ category: "schedule", title: `${delayed} milestone${delayed > 1 ? "s" : ""} behind schedule`, severity: delayed >= 3 ? "CRITICAL" : "HIGH", impact: 70, likelihood: 85, evidence: `Live milestone board: ${delayed} of ${p.milestones.length} milestones DELAYED.`, description: "Milestones past their planned dates directly push the completion date.", mitigation: "Review each delayed milestone owner and approve recovery dates.", source: "engine" });
  if (p.prediction && p.prediction.probability >= 0.4) {
    const pct = Math.round(p.prediction.probability * 100);
    add({ category: "schedule", title: `Delay probability ${pct}%`, severity: pct >= 70 ? "CRITICAL" : pct >= 55 ? "HIGH" : "MEDIUM", impact: Math.min(92, pct), likelihood: pct, evidence: `Prediction engine: ${pct}% chance of finishing late (est. slip ${p.prediction.estimatedDays} days).`, description: "The prediction engine currently puts this project at meaningful risk of finishing late.", mitigation: "Work the top driving factors first — they are ranked in the prediction tab.", source: "engine" });
  }
  if (p.spentBudget > 0) {
    const burn = p.spentBudget / Math.max(1, p.projectedBudget);
    const prog = p.progress / 100;
    if (burn - prog > 0.12) add({ category: "budget", title: "Spending ahead of work done", severity: burn - prog > 0.25 ? "HIGH" : "MEDIUM", impact: 60, likelihood: 80, evidence: `${Math.round(burn * 100)}% of budget spent vs ${p.progress}% physical progress.`, description: "Money is going out faster than work is appearing — a classic overrun precursor.", mitigation: "Re-forecast the cost at completion and hold milestone payments until aligned.", source: "engine" });
    const overrunPct = ((p.projectedBudget - p.totalBudget) / Math.max(1, p.totalBudget)) * 100;
    if (overrunPct > 5) add({ category: "budget", title: `Forecast overrun ${overrunPct > 0 ? "+" : ""}${overrunPct.toFixed(1)}%`, severity: overrunPct > 20 ? "CRITICAL" : overrunPct > 10 ? "HIGH" : "MEDIUM", impact: Math.min(90, 40 + overrunPct * 2), likelihood: 75, evidence: `Projected final cost ₹${Math.round(p.projectedBudget / 100)} Cr vs sanction ₹${Math.round(p.totalBudget / 100)} Cr.`, description: "The cost forecast is above the sanctioned amount.", mitigation: "Trigger the escalation procedure for the overrun band crossed.", source: "engine" });
  }
  const bottleneck = p.resources.filter(r => r.status === "bottleneck").length;
  if (bottleneck > 0) add({ category: "resources", title: `${bottleneck} resource bottleneck${bottleneck > 1 ? "s" : ""}`, severity: "HIGH", impact: 62, likelihood: 78, evidence: `Resource board: ${bottleneck} of ${p.resources.length} allocations flagged bottleneck.`, description: "People, machines or material are choking the work fronts.", mitigation: "Re-deploy idle allocations to the starved fronts.", source: "engine" });
  const lastDoc = p.documents[0]?.uploadedAt;
  if (p.status === "ACTIVE" && lastDoc) {
    const ageDays = Math.round((Date.now() - +new Date(lastDoc)) / 86400000);
    if (ageDays > 35) add({ category: "compliance", title: "Reporting is stale", severity: "MEDIUM", impact: 40, likelihood: 90, evidence: `Latest document is ${ageDays} days old (flash-report SLA is 7 working days).`, description: "Fresh data is the platform's fuel — stale reports blind the predictions.", mitigation: "Automated reminder to the field reporting officer.", source: "engine" });
  } else if (p.status === "ACTIVE" && p.documents.length === 0) {
    add({ category: "compliance", title: "No field report uploaded yet", severity: "MEDIUM", impact: 38, likelihood: 85, evidence: "Document vault is empty for an executing project.", description: "Monitoring quality improves as soon as the first progress report arrives.", mitigation: "Upload the latest monthly/flash report from the documents tab.", source: "engine" });
  }
  return out;
}

function contextRisks(p: Project): DerivedRisk[] {
  const out: DerivedRisk[] = [];
  const add = (r: Omit<DerivedRisk, "id" | "detectedAt">) =>
    out.push({ id: uid("rk"), detectedAt: new Date().toISOString(), ...r, impact: r.impact ?? 45, likelihood: r.likelihood ?? 55 });
  const month = new Date().getMonth() + 1;
  const sector = p.sector.toLowerCase();

  if (p.status === "PLANNING") {
    add({ category: "compliance", title: "Statutory clearances still open", severity: "MEDIUM", impact: 58, likelihood: 60, evidence: `Project stage: Planning — the milestone board starts with clearances pending.`, description: "Before execution starts, environmental, land and finance approvals must be in hand.", mitigation: "Maintain a clearance checklist with an owner and date per item.", source: "context" });
    add({ category: "schedule", title: "Execution has not started", severity: "LOW", impact: 30, likelihood: 100, evidence: "Progress 0% — baseline (pre-execution) risk applies.", description: "Until execution begins, risk is judged on plan quality rather than field data.", mitigation: "Keep the plan realistic; the score updates itself once work starts.", source: "context" });
  }
  // early-stage watch items — honest for ANY young project (planning or
  // freshly-started execution); they retire as data accumulates.
  if (p.progress < 15 && p.documents.length < 2) {
    add({ category: "compliance", title: "First-report window is open", severity: "LOW", impact: 34, likelihood: 80, evidence: "Progress 0–15% and fewer than 2 documents on file.", description: "The first field reports set the baseline every later claim is measured against — a weak start blurs detection.", mitigation: "Submit the first progress report within the reporting window to lock a clean baseline.", source: "context" });
    add({ category: "budget", title: "Budget phasing not yet validated by spend", severity: "LOW", impact: 32, likelihood: 65, evidence: "S-curve plan exists but almost no expenditure history to check it against.", description: "The monthly plan is a projection until real spending arrives to confirm it.", mitigation: "Reconcile the first month's actuals against the planned phasing.", source: "context" });
    add({ category: "schedule", title: "Mobilisation of contractor pending", severity: "MEDIUM", impact: 44, likelihood: 60, evidence: "Early execution phase — mobilisation progress is the leading indicator to watch.", description: "Slow mobilisation is the single most common early cause of schedule slip.", mitigation: "Track the site-establishment checklist weekly until mobilisation completes.", source: "context" });
  }
  if (/water|irrigation|river|drainage|sewer/.test(sector)) add({ category: "external", title: "Monsoon window exposure", severity: month >= 6 && month <= 9 ? "HIGH" : "MEDIUM", impact: 55, likelihood: month >= 6 && month <= 9 ? 75 : 40, evidence: `${p.sector} works in ${p.state} — monsoon-sensitive activity window Jun–Sep.`, description: "Water-sector works usually cannot progress through heavy rain months.", mitigation: "Schedule monsoon-unsafe activities outside the window.", source: "context" });
  if (/road|highway|transport|metro|rail/.test(sector)) add({ category: "compliance", title: "Right-of-way and utility shifting", severity: "MEDIUM", impact: 56, likelihood: 62, evidence: `${p.sector} corridor in ${p.district}, ${p.state}.`, description: "Linear corridors depend on land handover and utility agencies moving lines first.", mitigation: "Joint utility plan with firm dates from each agency.", source: "context" });
  if (p.totalBudget >= 50000) add({ category: "compliance", title: "Large-project escalation rules apply", severity: "LOW", impact: 35, likelihood: 50, evidence: `Sanction ₹${Math.round(p.totalBudget / 100)} Cr — above the ₹500 Cr oversight line.`, description: "Big projects attract stricter escalation and Cabinet-level reporting rules.", mitigation: "Keep overrun bands visible; escalate proactively, not after the fact.", source: "context" });
  if (/tbd|pending/i.test(p.contractor)) add({ category: "procurement", title: "Contractor not yet onboard", severity: "MEDIUM", impact: 50, likelihood: 70, evidence: `Contractor field reads “${p.contractor}”.`, description: "A pending tender means price and start-date are still unknowns.", mitigation: "Close the tender quickly; consider an early-work order for critical fronts.", source: "context" });
  if (p.teamSize < 15 && p.totalBudget > 10000) add({ category: "resources", title: "Thin team for the sanction size", severity: "MEDIUM", impact: 46, likelihood: 60, evidence: `${p.teamSize} staff for a ₹${Math.round(p.totalBudget / 100)} Cr project.`, description: "Oversight capacity is thin relative to the money being monitored.", mitigation: "Augment supervision or engage a project management consultant.", source: "context" });
  return out;
}

// ─── 3. The register ─────────────────────────────────────────────────────────
/** Build the full live register: documents + engine + context → many risks. */
export function deriveRiskRegister(p: Project, now = new Date()): DerivedRiskRegister {
  const docRisks = p.documents.flatMap(d => (d.text ? scanDocumentRisks(d.text, d.fileName) : (d.extractedData?.risks ?? []).filter(r => !/^no material/i.test(r)).map(r => ({
    id: uid("rk"), category: "compliance" as RiskCategory, title: r.length > 70 ? r.slice(0, 70) + "…" : r, severity: "MEDIUM" as const,
    impact: 44, likelihood: 55, evidence: `From ${d.fileName}`, description: r, mitigation: "Assign an owner to verify and act on this finding.", source: "document" as RiskSource, sourceDoc: d.fileName, detectedAt: d.uploadedAt,
  })))).slice(0, 18);

  const engine = engineRisks(p);
  const context = contextRisks(p);

  const all = [...docRisks, ...engine, ...context];
  // de-duplicate by title (documents can repeat the same pattern)
  const seen = new Set<string>();
  const risks = all.filter(r => { if (seen.has(r.title)) return false; seen.add(r.title); return true; });
  const scheduleRisk = avg(risks.filter(r => r.category === "schedule").map(r => r.impact));
  const budgetRisk = avg(risks.filter(r => r.category === "budget").map(r => r.impact));
  const resourceRisk = avg(risks.filter(r => r.category === "resources").map(r => r.impact));
  const overallRisk = Math.round(avg(risks.map(r => r.impact * (0.5 + r.likelihood / 200))));
  const riskLevel: RiskLevel = overallRisk > 70 ? "CRITICAL" : overallRisk > 45 ? "HIGH" : overallRisk > 25 ? "MEDIUM" : "LOW";
  return {
    risks, scheduleRisk, budgetRisk, resourceRisk, overallRisk, riskLevel, computedAt: now.toISOString(),
    counts: { documents: docRisks.length, engine: engine.length, context: context.length, total: risks.length },
  };
}

function avg(xs: number[]): number { return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0; }

/** Convert high-severity register risks into real alerts (max 4, deduped by title). */
export function riskAlertsFromRegister(p: Project, reg: DerivedRiskRegister, existing: Alert[] = []): Alert[] {
  const existingTitles = new Set(existing.map(a => a.title));
  return reg.risks
    .filter(r => (r.severity === "CRITICAL" || r.severity === "HIGH") && !existingTitles.has(r.title))
    .slice(0, 4)
    .map(r => ({
      id: uid("al"), projectId: p.id,
      title: `${r.severity === "CRITICAL" ? "Critical" : "High"} risk: ${r.title}`,
      description: `${r.description}${r.sourceDoc ? ` (source: ${r.sourceDoc})` : ""}. ${r.evidence}`,
      severity: r.severity, type: "RISK_LEVEL_CHANGE", isRead: false, createdAt: new Date().toISOString(),
      recommendedAction: r.mitigation, recommendedOwner: p.projectManager, recommendedDeadline: "within 7 days",
    }));
}

// ─── 4. Starter data for newly created projects ──────────────────────────────
/** S-curve phased plan across the duration so the budget tab works on day one. */
export function buildInitialBudgetRecords(p: Project): { id: string; projectId: string; category: "CONSTRUCTION"; month: number; year: number; planned: number; spent: number }[] {
  const out: ReturnType<typeof buildInitialBudgetRecords> = [];
  const start = new Date(p.startDate);
  const months = Math.max(6, Math.min(p.durationMonths, 24));
  const perMonth = p.totalBudget / months;
  const weight = (i: number, n: number) => { // ramp-up → peak → taper (S-ish)
    const t = i / Math.max(1, n - 1);
    return 0.4 + 1.2 * Math.sin(Math.PI * (0.15 + 0.7 * t));
  };
  const wSum = Array.from({ length: months }, (_, i) => weight(i, months)).reduce((a, b) => a + b, 0);
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    out.push({ id: `${p.id}-br-${i}`, projectId: p.id, category: "CONSTRUCTION", month: d.getMonth() + 1, year: d.getFullYear(), planned: Math.round(perMonth * (months * weight(i, months) / wSum)), spent: 0 });
  }
  return out;
}

/** Baseline resource board so the resources tab works on day one. */
export function buildInitialResources(p: Project): { id: string; projectId: string; category: "HUMAN" | "EQUIPMENT" | "MATERIAL"; name: string; quantity: number; allocated: number; utilised: number; unit: string; status: "available" | "constrained" | "bottleneck" }[] {
  const big = p.totalBudget > 20000;
  return [
    { id: `${p.id}-rs-1`, projectId: p.id, category: "HUMAN", name: "Engineers (site + design)", quantity: big ? 8 : 4, allocated: big ? 8 : 4, utilised: 0, unit: "persons", status: "available" },
    { id: `${p.id}-rs-2`, projectId: p.id, category: "HUMAN", name: "Supervisors & quality staff", quantity: big ? 12 : 6, allocated: big ? 12 : 6, utilised: 0, unit: "persons", status: "available" },
    { id: `${p.id}-rs-3`, projectId: p.id, category: "EQUIPMENT", name: "Earthmoving fleet", quantity: big ? 4 : 2, allocated: big ? 4 : 2, utilised: 0, unit: "machines", status: "available" },
    { id: `${p.id}-rs-4`, projectId: p.id, category: "MATERIAL", name: "Key construction material", quantity: 100, allocated: 100, utilised: 0, unit: "% of plan", status: "constrained" },
  ];
}

/** Two honest onboarding alerts so the alerts tab is alive (not empty, not fake-critical). */
export function starterAlerts(p: Project): Alert[] {
  const now = new Date().toISOString();
  return [
    {
      id: uid("al"), projectId: p.id,
      title: "Monitoring activated — the platform is now watching this project",
      description: "ProjectAssure has onboarded this project: milestone board, budget phasing and resource baseline were created automatically. The live engine re-checks it with every data change and every monitoring cycle.",
      severity: "LOW", type: "RISK_LEVEL_CHANGE", isRead: false, createdAt: now,
      recommendedAction: "No action needed — this confirms monitoring is live.", recommendedOwner: p.projectManager, recommendedDeadline: "—",
    },
    {
      id: uid("al"), projectId: p.id,
      title: "Upload your first progress report to sharpen predictions",
      description: "Right now the risk register runs on plan quality (context signals). Each uploaded document adds document-sourced risks, sharpens the delay prediction and updates the dashboard fields automatically.",
      severity: "MEDIUM", type: "DATA_STALENESS", isRead: false, createdAt: now,
      recommendedAction: "Go to the Documents tab and upload the latest monthly or flash report (PDF, image, spreadsheet or text).", recommendedOwner: p.projectManager, recommendedDeadline: "within 7 days",
    },
  ];
}

/** Update a project's legacy riskAssessment block from the live register (keeps old UI in sync). */
export function riskAssessmentFromRegister(reg: DerivedRiskRegister, p: Project) {
  return {
    scheduleRisk: reg.scheduleRisk, budgetRisk: reg.budgetRisk, resourceRisk: reg.resourceRisk,
    overallRisk: reg.overallRisk, riskLevel: reg.riskLevel,
    factors: reg.risks.slice(0, 8).map(r => ({ factor: r.title, impact: r.impact, description: `${r.description} → ${r.mitigation}` })),
    assessedAt: reg.computedAt,
  };
}
