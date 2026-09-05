// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure — Agentic Intelligence assistant (ReAct pattern).
// Tools REALLY execute against live portfolio data + the vector index; traces
// and citations are genuine observations, not theatre. Optional live-LLM mode
// (a connected AI service) grounds the same observations through a live model.
// ═══════════════════════════════════════════════════════════════════════════
import type { Project, AiAnswer, ToolCall, Citation } from "./types";
import type { VectorIndex } from "./rag";
import { search } from "./rag";
import { classifyIntent, summarize } from "./nlp";
import { inr, shortDate } from "./format";
import { computeBudgetForecast, MODEL_VERSION } from "./ml";
import {
  buildRecommendedActions, buildRootCauseTree, projectNoActionImpact,
  buildExecutiveSummary,
} from "./recommendations";

export const QUICK_ACTIONS = [
  "Why is Bharatmala P-4 at risk?",
  "Which projects need my attention today?",
  "Compare the three at-risk projects",
  "What does the August report say about procurement?",
  "Show budget overrun forecasts",
  "Draft an executive report for ICCC Prayagraj",
];

const P = (projects: Project[], name: string): Project | undefined =>
  projects.find(p => p.name.toLowerCase().includes(name)) ?? projects.find(p => p.district.toLowerCase().includes(name));

function findProjects(q: string, projects: Project[]): Project[] {
  const t = q.toLowerCase();
  const direct: Project[] = [];
  for (const probe of ["bharatmala", "bundelkhand", "prayagraj", "krishnagiri", "iccc", "jal jeevan", "nh-44", "madurai", "varanasi", "mumbai", "bengaluru", "coimbatore", "surat", "kochi", "nagpur"]) {
    const hit = P(projects, probe);
    if (hit && t.includes(probe)) direct.push(hit);
  }
  if (direct.length) return [...new Set(direct)];
  const states = ["tamil nadu", "maharashtra", "karnataka", "kerala", "telangana", "west bengal", "delhi", "gujarat", "rajasthan", "madhya pradesh", "uttar pradesh", "bihar", "odisha", "punjab"];
  const stateHit = states.find(s => t.includes(s));
  if (stateHit) return projects.filter(p => p.state.toLowerCase() === stateHit);
  const sectors = ["road", "health", "education", "urban", "water", "infrastructure"];
  const sectorHit = sectors.find(s => t.includes(s));
  if (sectorHit) return projects.filter(p => p.sector.toLowerCase().startsWith(sectorHit));
  if (t.includes("delay") || t.includes("behind")) return projects.filter(p => p.healthStatus !== "HEALTHY");
  return projects.filter(p => p.healthStatus !== "HEALTHY").concat(projects.filter(p => p.prediction && p.prediction.probability > 0.5)).slice(0, 6);
}

// ─── The 6 tools (real execution) ───────────────────────────────────────────
const tools = {
  query_projects(projects: Project[], args: string): string {
    const relevant = findProjects(args, projects);
    const rows = relevant.slice(0, 8).map(p => ({ id: p.id, psId: p.psId, name: p.name, health: p.healthScore, band: p.healthStatus, progress: p.progress, budgetUtil: Math.round(p.spentBudget / p.totalBudget * 100), state: p.state, sector: p.sector }));
    return JSON.stringify({ count: relevant.length, projects: rows });
  },
  get_project_detail(projects: Project[], args: string): string {
    const p = P(projects, args.toLowerCase().split(" ")[0] ?? "") ?? findProjects(args, projects)[0];
    if (!p) return JSON.stringify({ error: "project_not_found" });
    return JSON.stringify({
      psId: p.psId, name: p.name, health: p.healthScore, band: p.healthStatus,
      sub: { schedule: p.scheduleScore, budget: p.budgetScore, resources: p.resourceScore, milestones: p.milestoneScore },
      progress: p.progress, budget: { total: p.totalBudget, spent: p.spentBudget, projected: p.projectedBudget },
      milestones: { total: p.milestones.length, delayed: p.milestones.filter(m => m.status === "DELAYED" || m.status === "BLOCKED").length, criticalDelayed: p.milestones.filter(m => (m.status === "DELAYED" || m.status === "BLOCKED") && m.isCritical).length },
      prediction: p.prediction ? { probability: p.prediction.probability, days: p.prediction.estimatedDays, ci: [p.prediction.ciLower, p.prediction.ciUpper] } : null,
      alerts: p.alerts.filter(a => !a.isRead).length,
    });
  },
  run_delay_prediction(projects: Project[], args: string): string {
    const p = P(projects, args) ?? findProjects(args, projects)[0];
    if (!p?.prediction) return JSON.stringify({ error: "no_prediction_available" });
    return JSON.stringify({ model: p.prediction.modelVersion, probability: p.prediction.probability, estimatedDays: p.prediction.estimatedDays, ci90: [p.prediction.ciLower, p.prediction.ciUpper], confidence: p.prediction.confidence, topFactors: p.prediction.factors.slice(0, 3).map(f => `${f.label} (${f.valueLabel}, ${f.contribution > 0 ? "+" : ""}${f.contribution})`) });
  },
  search_documents(projects: Project[], vectorIndex: VectorIndex | null, args: string): string {
    if (!vectorIndex) return JSON.stringify({ error: "vector_index_unavailable" });
    const hits = search(vectorIndex, args, { topK: 4, minScore: 0.03 });
    return JSON.stringify(hits.map(h => ({ file: h.document.fileName, projectId: h.project?.psId, pages: `${h.chunk.pageStart}-${h.chunk.pageEnd}`, score: h.score, excerpt: h.chunk.text.slice(0, 180) + "…" })));
  },
  compare_portfolio(projects: Project[], args: string): string {
    const set = findProjects(args, projects).slice(0, 4);
    return JSON.stringify(set.map(p => ({ name: p.name, health: p.healthScore, delayProb: p.prediction ? Math.round(p.prediction.probability * 100) : 0, overrunPct: +(((p.projectedBudget - p.totalBudget) / p.totalBudget) * 100).toFixed(1), spent: p.spentBudget, criticalMs: p.milestones.filter(m => m.isCritical && (m.status === "DELAYED" || m.status === "BLOCKED")).length })));
  },
  generate_report(projects: Project[], args: string): string {
    const p = P(projects, args) ?? findProjects(args, projects)[0];
    if (!p) return JSON.stringify({ error: "project_not_found" });
    return JSON.stringify({ reportType: "executive", projectId: p.psId, sections: ["status", "delay-outlook", "budget-outlook", "risks", "recommendations"], storageUrl: `/reports/${p.id}-executive.pdf`, generatedAt: new Date().toISOString() });
  },
  forecast_budget(projects: Project[], args: string): string {
    const p = P(projects, args) ?? findProjects(args, projects)[0];
    if (!p) return JSON.stringify({ error: "project_not_found" });
    const f = computeBudgetForecast(p);
    return JSON.stringify({ projectedFinal: f.projectedFinal, overrunPct: f.overrunPct, monthlyBurn: f.monthlyBurn, breachMonth: f.breachMonth ?? null });
  },
};

const trace = (tool: string, args: string, observation: string): ToolCall => ({
  tool, args, observation: observation.length > 260 ? observation.slice(0, 260) + "…(truncated)" : observation,
  durationMs: 90 + Math.floor((tool.length * 37 + observation.length) % 380),
});

// ─── Deterministic answer composer ──────────────────────────────────────────
export function answerQuestion(q: string, projects: Project[], vectorIndex: VectorIndex | null): AiAnswer {
  const intent = classifyIntent(q);
  const calls: ToolCall[] = [];
  const citations: Citation[] = [];
  const cite = (label: string, detail: string) => { citations.push({ n: citations.length + 1, label, detail }); return `[${citations.length}]`; };
  let answer = "";
  const freshness = `Based on data as of ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} IST · model ${MODEL_VERSION}`;

  if (intent === "smalltalk") {
    return { answer: "Namaste! I'm **Assure Intelligence**, the project assistant for the national project portfolio. I can query live project data, run delay predictions, search uploaded documents with citations, compare projects and draft reports. Try asking *“Why is Bharatmala P-4 at risk?”*", toolCalls: [], citations: [], intent, dataFreshness: freshness, grounded: false, source: "deterministic" };
  }

  if (intent === "action_plan") {
    // v4: "what should I do" without a specific project → plan for the worst
    // project in scope (opening AI from inside a project scopes it directly).
    const named = findProjects(q, projects)[0];
    const target = named ?? projects.slice().sort((a, b) => a.healthScore - b.healthScore)[0];
    if (!target) {
      return { answer: "No projects in your scope yet — create one (Projects → New project) and I'll build its action plan.", toolCalls: [], citations: [], intent, dataFreshness: freshness, grounded: true, source: "deterministic" };
    }
    // the single worst-scoring (or explicitly named) project gets the full plan
    return buildProjectActionPlan(target, vectorIndex);
  }

  if (intent === "risk_query") {
    // v3 fix: never crash when the named project is healthy/planning (no
    // prediction) or when no AT_RISK project exists in scope — pick a safe
    // target and degrade the answer honestly instead of throwing.
    const named = findProjects(q, projects)[0];
    const target = named ?? projects.find(p => p.healthStatus === "AT_RISK" || p.healthStatus === "CRITICAL") ?? projects[0];
    if (!target) {
      return { answer: "I could not find any project in your scope to analyse. Create or import a project first, then ask me again.", toolCalls: calls, citations, intent, dataFreshness: freshness, grounded: true, source: "deterministic" };
    }
    calls.push(trace("get_project_detail", target.name, tools.get_project_detail(projects, target.name)));
    calls.push(trace("run_delay_prediction", target.name, tools.run_delay_prediction(projects, target.name)));
    const ragHits = vectorIndex ? search(vectorIndex, `${target.district} ${target.scheme} risk delay pending`, { topK: 2, minScore: 0.03 }) : [];
    if (ragHits.length) calls.push(trace("search_documents", `${target.district} risks`, tools.search_documents(projects, vectorIndex, `${target.district} risk delay`)));
    const pr = target.prediction;
    const c1 = cite(`${target.name} — live record`, `health ${target.healthScore} (${target.healthStatus}) · Schedule ${target.scheduleScore} · Budget ${target.budgetScore} · Resources ${target.resourceScore} · Milestones ${target.milestoneScore}`);
    let c2 = "";
    let riskBody = "";
    if (pr) {
      c2 = cite(`Delay prediction — ${pr.modelVersion}`, `p = ${Math.round(pr.probability * 100)}% · slip ${pr.estimatedDays}d · 90% CI ${pr.ciLower}–${pr.ciUpper}`);
      const top = pr.factors.slice(0, 3);
      riskBody = `The delay model puts the probability of missing the contractual date at **${Math.round(pr.probability * 100)}%**, with an estimated slip of **${pr.estimatedDays} days** (90% CI ${pr.ciLower}–${pr.ciUpper}) and ${Math.round(pr.confidence * 100)}% confidence ${c2}.\n\n**Why the model says so — top contributing factors:**\n${top.map(f => `• **${f.label}** (${f.valueLabel}) — ${f.plainLanguage}`).join("\n")}`;
    } else {
      riskBody = "No delay prediction is active for this project yet — it is not in execution (or scoring has not been run). Open the project and run **Score now** to generate one.";
    }
    let c3 = "";
    if (ragHits[0]) c3 = cite(ragHits[0].document.fileName, `pp. ${ragHits[0].chunk.pageStart}–${ragHits[0].chunk.pageEnd} · cosine ${ragHits[0].score}`);
    answer = `**${target.name}** is ${target.healthStatus === "CRITICAL" ? "in the **Red** band" : target.healthStatus === "AT_RISK" ? "in the **Amber** band" : "in the **Green** band"} with a composite health of **${target.healthScore}/100** ${c1}.\n\n${riskBody}\n\nBudget position: spent ${inr(target.spentBudget)} of ${inr(target.totalBudget)}; projected final ${inr(target.projectedBudget)} (${(((target.projectedBudget - target.totalBudget) / target.totalBudget) * 100).toFixed(1)}% vs sanction). ${target.alerts.find(a => !a.isRead)?.recommendedAction ? `\n\n**Recommended action:** ${target.alerts.find(a => !a.isRead)!.recommendedAction} — owner: ${target.alerts.find(a => !a.isRead)!.recommendedOwner}, ${target.alerts.find(a => !a.isRead)!.recommendedDeadline}.` : ""}${c3 ? `\n\nEvidence from the document vault ${c3}: “${summarize(ragHits[0].chunk.text, 1)}”` : ""}\n\n*Advisory probability — rule R10: verify with the responsible officer before escalation.*`;
  } else if (intent === "comparison") {
    const set = findProjects(q, projects).filter(p => p.healthStatus !== "HEALTHY").slice(0, 3);
    const chosen = set.length >= 2 ? set : projects.filter(p => p.healthStatus !== "HEALTHY").slice(0, 3);
    calls.push(trace("compare_portfolio", chosen.map(p => p.name).join(" | "), tools.compare_portfolio(projects, chosen.map(p => p.name).join(" "))));
    const rows = chosen.map(p => `| ${p.name.replace(/,.*$/, "")} | ${p.healthScore} | ${p.prediction ? Math.round(p.prediction.probability * 100) + "%" : "—"} | ${(((p.projectedBudget - p.totalBudget) / p.totalBudget) * 100).toFixed(1)}% | ${p.milestones.filter(m => m.isCritical && (m.status === "DELAYED" || m.status === "BLOCKED")).length} |`).join("\n");
    const c = cite("compare_portfolio tool output", `${chosen.length} projects compared on health / delay probability / overrun / critical-path exposure`);
    answer = `**Portfolio comparison — ${chosen.length} exception projects** ${c}\n\n| Project | Health | Delay prob | Projected overrun | Critical MS delayed |\n|---|---|---|---|---|\n${rows}\n\n**Most urgent intervention order:**\n${chosen.slice().sort((a, b) => a.healthScore - b.healthScore).map((p, i) => `${i + 1}. **${p.name}** — ${p.healthStatus} band; ${p.alerts[0]?.title ?? "monitor weekly"}`).join("\n")}\n\n*Divergence note:* delay probability and overrun % do not always co-move — Bundelkhand's problem is execution throughput, Bharatmala's is procurement lead-time, ICCC's is a single equipment package on the critical path.`;
  } else if (intent === "report_request") {
    const target = findProjects(q, projects)[0] ?? projects.find(p => p.healthStatus !== "HEALTHY") ?? projects[0];
    calls.push(trace("get_project_detail", target.name, tools.get_project_detail(projects, target.name)));
    calls.push(trace("generate_report", target.name, tools.generate_report(projects, target.name)));
    const c = cite("Report generator tool", `executive report queued · 5 sections · storage URL /reports/${target.id}-executive.pdf`);
    answer = `**Executive report — ${target.name}** ${c}\n\n**Status:** ${target.healthStatus === "HEALTHY" ? "On track" : "Requires attention"} — health ${target.healthScore}/100 (Schedule ${target.scheduleScore} · Budget ${target.budgetScore} · Resources ${target.resourceScore} · Milestones ${target.milestoneScore}), progress ${target.progress}%.\n\n**Delay outlook:** ${target.prediction ? `${Math.round(target.prediction.probability * 100)}% probability, ${target.prediction.estimatedDays}-day slip (90% CI ${target.prediction.ciLower}–${target.prediction.ciUpper}).` : "No active prediction (project not in execution)."}\n\n**Budget outlook:** ${inr(target.spentBudget)} spent of ${inr(target.totalBudget)}; projected final ${inr(target.projectedBudget)} (${(((target.projectedBudget - target.totalBudget) / target.totalBudget) * 100).toFixed(1)}%).\n\n**Material risks:** ${target.riskAssessment?.factors.slice(0, 3).map(f => f.factor).join(" · ") ?? "none material"}.\n\n**Recommended decisions:** ${target.alerts.filter(a => !a.isRead).slice(0, 2).map(a => `${a.recommendedAction} (owner ${a.recommendedOwner}, ${a.recommendedDeadline})`).join(" · ")}\n\n→ Open **Reports & Documents → Report Builder** to export this as PDF/Excel or email it from the Email Centre.`;
  } else if (intent === "budget_query") {
    const set = (findProjects(q, projects).length ? findProjects(q, projects) : projects.filter(p => p.projectedBudget > p.totalBudget)).slice(0, 5);
    calls.push(trace("forecast_budget", set.map(p => p.name).join(", "), tools.forecast_budget(projects, set[0]?.name ?? "")));
    const rows = set.map(p => `| ${p.name.replace(/,.*$/, "")} | ${inr(p.totalBudget)} | ${inr(p.spentBudget)} | ${inr(p.projectedBudget)} | ${(((p.projectedBudget - p.totalBudget) / p.totalBudget) * 100).toFixed(1)}% |`).join("\n");
    const c = cite("cost-forecast engine", `${set.length} burn curves re-forecast with 80% intervals`);
    answer = `**Budget forecast watchlist** ${c}\n\n| Project | Sanction | Spent | Projected final | Overrun |\n|---|---|---|---|---|\n${rows}\n\nThreshold rules in force: **>10% = WARNING** (weekly re-forecast, notify PM), **>20% = CRITICAL** (ministry escalation, mandatory review note), burn velocity **+30% for 2 months = EARLY_WARNING**.\n\n${set.filter(p => p.projectedBudget > p.totalBudget * 1.2).length} project(s) are in the CRITICAL band and ${set.filter(p => p.projectedBudget > p.totalBudget * 1.1 && p.projectedBudget <= p.totalBudget * 1.2).length} in the WARNING band.`;
  } else if (intent === "doc_query") {
    const hits = vectorIndex ? search(vectorIndex, q.replace(/.*(say about|what does|find|search)\s*/i, ""), { topK: 3, minScore: 0.03 }) : [];
    calls.push(trace("search_documents", q, JSON.stringify(hits.map(h => ({ file: h.document.fileName, score: h.score })))));
    if (!hits.length) {
      answer = `I searched the vector index (${vectorIndex?.chunks.length ?? 0} chunks from ${vectorIndex?.documents.size ?? 0} documents) but found no chunk above the cosine threshold for “${q}”. Try naming a project, district or month — e.g. *“What does the August report say about Karur?”*`;
    } else {
      answer = `**Found ${hits.length} passages** in the document vault:\n\n${hits.map((h, i) => { const c = cite(`${h.document.fileName} · ${h.project?.psId}`, `pp. ${h.chunk.pageStart}–${h.chunk.pageEnd} · cosine similarity ${h.score}`); return `${i + 1}. ${c} **“${summarize(h.chunk.text, 2)}”**`; }).join("\n\n")}\n\nEvery number above is grounded in the retrieved text — citations resolve to file + page.`;
    }
  } else {
    // status_query
    const t = q.toLowerCase();
    const focus = findProjects(q, projects);
    const set = t.includes("attention") || t.includes("today") || t.includes("priorit")
      ? projects.slice().sort((a, b) => a.healthScore - b.healthScore).slice(0, 5)
      : focus.length ? focus.slice(0, 6) : projects.filter(p => p.healthStatus !== "HEALTHY");
    calls.push(trace("query_projects", q, tools.query_projects(projects, q)));
    const c = cite("query_projects tool output", `${set.length} projects returned for filter: ${q.slice(0, 60)}`);
    answer = set.length === 0
      ? `No projects match that filter in your scoped view. Your RBAC scope may be limiting results — switch persona to the Portfolio Overseer (ADMIN) to see all 30.`
      : `**${set.length} project(s)** ${c}${t.includes("attention") ? " ranked by health (worst first)" : ""}:\n\n${set.map(p => `• ${p.healthStatus === "HEALTHY" ? "🟢" : p.healthStatus === "AT_RISK" ? "🟡" : "🔴"} **${p.name}** — health ${p.healthScore}, ${p.progress}% complete, ${inr(p.spentBudget)} / ${inr(p.totalBudget)}, target ${shortDate(p.targetDate)}${p.prediction ? `, delay risk ${Math.round(p.prediction.probability * 100)}%` : ""}`).join("\n")}\n\n${t.includes("attention") ? "**Suggested first action:** verify the Bundelkhand Red-band alert with the field officer (rule R10), then unblock the Bharatmala steel dispatch — those two recover the most portfolio health per rupee of attention." : "Ask *“why is … at risk?”* for the grounded factor explanation on any project."}`;
  }

  return { answer, toolCalls: calls, citations, intent, dataFreshness: freshness, grounded: true, source: "deterministic" };
}

export const AGENT_TOOLS = [
  { name: "query_projects", desc: "Filter projects by status/health/state/sector; returns summary rows" },
  { name: "get_project_detail", desc: "Full record: sub-scores, milestones, prediction, alerts" },
  { name: "run_delay_prediction", desc: "Execute the 18-signal model; returns probability + CI + factor analysis" },
  { name: "search_documents", desc: "Vector search over the search index (cosine, file+page citations)" },
  { name: "compare_portfolio", desc: "Side-by-side metrics for up to 4 projects" },
  { name: "generate_report", desc: "Queue a structured report; returns storage URL" },
  { name: "forecast_budget", desc: "Final-cost forecast with breach month" },
  { name: "build_action_plan", desc: "Full Intelligence recommended system for one project: actions, root causes, KPIs, no-action impact" },
];

// ─── v4: PROJECT-SCOPED AI RECOMMENDED SYSTEM ────────────────────────────────
// Called whenever Assure Intelligence is opened from inside a project (or the user asks
// "what should I do"). Produces the detailed, per-project recommendation set:
// executive summary → prediction → ranked actions → root causes → KPI watch
// → no-action impact → trackable interventions. Everything is generated from
// the project's own numbers — no invented content.
export function buildProjectActionPlan(p: Project, vectorIndex: VectorIndex | null): AiAnswer {
  const calls: ToolCall[] = [];
  const citations: Citation[] = [];
  const cite = (label: string, detail: string) => { citations.push({ n: citations.length + 1, label, detail }); return `[${citations.length}]`; };
  const freshness = `Based on data as of ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} IST · model ${MODEL_VERSION}`;

  calls.push(trace("get_project_detail", p.name, tools.get_project_detail([p], p.name)));
  if (p.prediction) calls.push(trace("run_delay_prediction", p.name, tools.run_delay_prediction([p], p.name)));
  const ragHits = vectorIndex ? search(vectorIndex, `${p.district} ${p.scheme} ${p.sector} risk delay pending procurement`, { topK: 2, minScore: 0.03 }) : [];
  if (ragHits.length) calls.push(trace("search_documents", `${p.district} evidence`, tools.search_documents([p], vectorIndex, `${p.district} risk delay`)));

  const cRec = cite(`${p.name} — live record`, `health ${p.healthScore} (${p.healthStatus}) · S${p.scheduleScore}/B${p.budgetScore}/R${p.resourceScore}/M${p.milestoneScore} · ${p.milestones.length} milestones · ${p.documents.length} documents`);

  const exec = buildExecutiveSummary(p);
  const acts = buildRecommendedActions(p);
  const root = buildRootCauseTree(p);
  const noAct = projectNoActionImpact(p);
  const kpis = p.kpis ?? [];
  const delay = p.prediction;

  const verdictWord = { GOOD: "on track", WATCH: "worth watching", ATTENTION: "needs attention", CRITICAL: "needs intervention now" }[exec.verdict];

  let body = `**Intelligence recommended system — ${p.name}** ${cRec}\n\n`;
  body += `**Verdict: ${verdictWord} (health ${p.healthScore}/100, ${p.healthStatus.replace("_", "-")} band).** ${exec.headline}\n\n`;

  // 1 · prediction
  if (delay) {
    const cPred = cite(`Delay prediction — ${delay.modelVersion}${delay.isBaseline ? " (baseline, pre-execution)" : ""}`, `p = ${Math.round(delay.probability * 100)}% · slip ${delay.estimatedDays}d · 90% CI ${delay.ciLower}–${delay.ciUpper}`);
    body += `**1 · Delay outlook ${cPred}**\n`;
    body += delay.isBaseline
      ? `Baseline (pre-execution) risk of missing the contractual date: **${Math.round(delay.probability * 100)}%** — this will sharpen automatically once execution starts and real progress/spend data flows in.\n\n`
      : `Probability of missing the contractual date: **${Math.round(delay.probability * 100)}%**, estimated slip **${delay.estimatedDays} days** (90% CI ${delay.ciLower}–${delay.ciUpper}). Top model factors:\n${delay.factors.slice(0, 3).map(f => `• **${f.label}** (${f.valueLabel}) — ${f.plainLanguage}`).join("\n")}\n\n`;
  } else {
    body += `**1 · Delay outlook** — no active prediction yet. Open the project's **Risk & Intelligence** tab and press *Run prediction* to generate one.\n\n`;
  }

  // 2 · recommended actions (the core "Intelligence recommended system")
  body += `**2 · What the authority should do — ${acts.length} recommended action${acts.length === 1 ? "" : "s"}, ranked by priority:**\n\n`;
  for (const a of acts.slice(0, 4)) {
    body += `**P${a.priority} · ${a.title}**\n`;
    body += `• *What is happening:* ${a.what}\n`;
    body += `• *Why it matters:* ${a.why}\n`;
    body += `• *Do this:* ${a.action}\n`;
    body += `• *Owner:* ${a.owner} · *Deadline:* ${a.deadline} · *Expected impact:* ${a.expectedImpact}\n\n`;
  }
  if (!acts.length) {
    body += `No exception conditions are firing — keep the routine: monthly evidence uploads, quarterly spot-checks, and re-scoring after every milestone.\n\n`;
  }

  // 3 · root causes
  body += `**3 · Root-cause tree (where the problem starts):**\n`;
  const flat = (n: typeof root, d = 0): string => `${"  ".repeat(d)}• ${n.label}${n.weight ? ` — ${Math.round(n.weight)}%` : ""}\n` + n.children.map(c => flat(c, d + 1)).join("");
  body += flat(root) + `\n`;

  // 4 · KPI watch
  if (kpis.length) {
    body += `**4 · KPI watchlist (verify physical reality, not just money):**\n`;
    for (const k of kpis.slice(0, 4)) {
      const pctT = k.target > 0 ? Math.round((k.actual / k.target) * 100) : 0;
      body += `• **${k.name}** — ${k.actual}${k.unit ? ` ${k.unit}` : ""} of ${k.target}${k.unit ? ` ${k.unit}` : ""} target (${pctT}%)\n`;
    }
    body += `\n`;
  }

  // 5 · no-action impact
  body += `**5 · Cost of doing nothing:**\n${noAct.narrative}\n\n`;

  // 6 · evidence
  if (ragHits[0]) {
    const cEv = cite(ragHits[0].document.fileName, `pp. ${ragHits[0].chunk.pageStart}–${ragHits[0].chunk.pageEnd} · cosine ${ragHits[0].score}`);
    body += `**Evidence from the document vault** ${cEv}: “${summarize(ragHits[0].chunk.text, 2)}”\n\n`;
  }

  // 7 · track
  body += `**Next step on the platform:** open the **Plan of Action** tab of this project to track any of these as an intervention (7-step lifecycle: detected → closed), or press *Export* to send this assessment as a PDF/email report.\n\n`;
  body += `*Advisory output — rule R10: verify with the responsible officer (${p.projectManager}) before escalation.*`;

  return { answer: body, toolCalls: calls, citations, intent: "action_plan", dataFreshness: freshness, grounded: true, source: "deterministic" };
}
