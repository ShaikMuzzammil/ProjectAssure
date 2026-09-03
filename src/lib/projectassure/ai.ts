/* ============================================================
 * ProjectAssure — Agentic AI assistant (deterministic demo brain)
 * Implements md/06_AI_ML_ENGINE.md Part E:
 *  - 6 canonical tools, intent classification, ReAct-style
 *    tool-call trace, grounded answers, citations [n],
 *    data-freshness stamp. Fully offline & deterministic.
 * ============================================================ */

import type { Project } from "./types";
import { computeBudgetForecast } from "./ml";
import { formatIndian, formatLakhs, timeAgo } from "./format";

export interface ToolCall { tool: string; args: string; observation: string; durationMs: number; }
export interface Citation { n: number; label: string; detail: string; }
export interface AiAnswer {
  answer: string;
  toolCalls: ToolCall[];
  citations: Citation[];
  intent: string;
  dataFreshness: string;
}

const asOf = () => `Based on data as of ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })} IST · model ${"sim:xgboost-v2.1-18f"}`;

export const QUICK_ACTIONS = [
  "Why is Bharatmala P-4 at risk?",
  "Which projects need my attention today?",
  "Show the budget analysis for Jal Jeevan Bundelkhand",
  "Compare Bharatmala P-4 vs NH-44 Krishnagiri",
  "Which projects in Tamil Nadu are delayed?",
  "Generate an executive summary",
];

function classify(q: string): string {
  const s = q.toLowerCase();
  if (/(^|\b)(hi|hello|hey|thanks|thank you|good morning)\b/.test(s)) return "smalltalk";
  if (/\b(why|reason|explain|risk)\b/.test(s) && /\bat risk\b|behind|delay/.test(s) === false && s.includes("why")) return "risk_query";
  if (/\b(why|risk|factors?|at risk)\b/.test(s)) return "risk_query";
  if (/\b(compare|vs\.?|versus|difference)\b/.test(s)) return "comparison";
  if (/\b(report|summary|brief|executive)\b/.test(s)) return "report_request";
  if (/\b(budget|cost|forecast|overrun|spend)\b/.test(s)) return "budget_query";
  if (/\b(document|report upload|pdf|summary of)\b/.test(s) && /\b(doc|document|upload)\b/.test(s)) return "doc_query";
  if (/\b(which|list|show|how many|what projects|attention|delayed|delay)\b/.test(s)) return "status_query";
  return "status_query";
}

function findProjects(projects: Project[], q: string): Project[] {
  const s = q.toLowerCase();
  let hits = projects.filter((p) =>
    s.includes(p.name.toLowerCase().split(" ").slice(0, 2).join(" ")) ||
    s.includes(p.name.toLowerCase()) ||
    (p.name.toLowerCase().includes("bharatmala p-4") && s.includes("bharatmala")) ||
    (p.name.toLowerCase().includes("jal jeevan") && s.includes("bundelkhand")) ||
    (p.name.toLowerCase().includes("iccc") && s.includes("prayagraj")) ||
    (p.name.toLowerCase().includes("nh-44") && (s.includes("nh") || s.includes("krishnagiri")))
  );
  if (hits.length === 0) {
    /* state / sector filter */
    hits = projects.filter((p) => s.includes(p.state.toLowerCase()) || s.includes(p.sector.toLowerCase()));
  }
  return hits;
}

const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;

export function answerQuestion(question: string, projects: Project[]): AiAnswer {
  const intent = classify(question);
  const toolCalls: ToolCall[] = [];
  const citations: Citation[] = [];
  const addTool = (tool: string, args: string, observation: string) =>
    toolCalls.push({ tool, args, observation, durationMs: 120 + Math.round(Math.random() * 380) });
  let answer = "";

  switch (intent) {
    case "smalltalk":
      answer = [
        "Hello! I am **Assure AI**, your monitoring assistant for this portfolio.",
        "I can explain why any project is at risk, query the portfolio (\"which roads projects in Tamil Nadu are delayed?\"), run delay predictions, compare projects, analyse budgets, or draft a report — always grounded in the live database with citations.",
        "Try one of the quick actions below, or ask me anything about the 30 monitored projects.",
      ].join("\n\n");
      break;

    case "risk_query": {
      const hits = findProjects(projects, question);
      const p = hits[0] ?? projects.filter((x) => x.healthStatus !== "HEALTHY")[0];
      addTool("get_project_detail", `{ "projectId": "${p.id}" }`, `Fetched project, health=${p.healthScore}, status=${p.healthStatus}`);
      addTool("run_delay_prediction", `{ "projectId": "${p.id}" }`, `probability=${pct(p.prediction?.probability ?? 0)}, days=${p.prediction?.estimatedDays ?? 0}`);

      if (p.healthStatus === "HEALTHY") {
        answer = `**${p.name}** is currently **healthy** (health score **${p.healthScore}/100**, GREEN).\n\n- Schedule ${p.scheduleScore} · Budget ${p.budgetScore} · Resources ${p.resourceScore} · Milestones ${p.milestoneScore}\n- Physical progress ${p.progress}% with burn aligned to plan\n- Delay probability is low at **${pct(p.prediction?.probability ?? 0.08)}**\n\nOne mitigating watch-item: keep the routine report cadence so the model keeps full feature coverage. I would verify the next monthly report upload and the next 6-hour scoring run.`;
      } else {
        const top = (p.prediction?.factors ?? []).slice(0, 3);
        const ra = p.riskAssessment;
        const bullets = top.map((f, i) => {
          citations.push({ n: i + 1, label: `${f.label}`, detail: `SHAP contribution ${f.contribution > 0 ? "+" : ""}${f.contribution} log-odds · model ${p.prediction?.modelVersion}` });
          return `${i + 1}. **${f.label}** — observed: *${f.plainLanguage.split("—")[0].trim()}* [${i + 1}]`;
        }).join("\n");
        const mitigating = p.healthStatus === "AT_RISK"
          ? "One mitigating factor: resource adequacy is still within band, so recovery is possible without re-baselining."
          : "One mitigating factor: the contractor has re-mobilised two crews this week, which the next scoring run should reflect.";
        answer = `**${p.name}** is **${p.healthStatus === "CRITICAL" ? "RED" : "AMBER"}** — health score **${p.healthScore}/100** (Schedule ${p.scheduleScore} · Budget ${p.budgetScore} · Resources ${p.resourceScore} · Milestones ${p.milestoneScore}).\n\nThe delay model puts completion-delay probability at **${pct(p.prediction?.probability ?? 0.78)}** with an estimated slip of **${p.prediction?.estimatedDays} days** (90% CI ${p.prediction?.ciLower}–${p.prediction?.ciUpper} days).\n\n**Top risk factors**\n${bullets}\n\n${mitigating}\n\n**Recommended single highest-leverage action:** ${p.alerts[0]?.recommendedAction ?? "verify field data"} — owner: *${p.alerts[0]?.recommendedOwner ?? "Project Manager"}*, ${p.alerts[0]?.recommendedDeadline ?? "this week"}.\n\n**Verify next:** the underlying procurement ledger entries and the next 6-hour scoring run before escalation.${ra ? `\n\n*Formal risk assessment on record: overall ${ra.overallRisk}/100 (${ra.riskLevel}).*` : ""}`;
      }
      break;
    }

    case "comparison": {
      const parts = question.split(/\bvs\.?\b|\bversus\b/i).map((s) => s.trim());
      const a = findProjects(projects, parts[0] ?? "")[0];
      const b = parts[1] ? findProjects(projects, parts[1])[0] : undefined;
      const p1 = a ?? projects[0], p2 = b ?? projects.find((x) => x.id !== p1.id && x.healthStatus !== "HEALTHY") ?? projects[1];
      addTool("compare_portfolio", `["${p1.id}", "${p2.id}"]`, "2 projects compared across health, schedule, budget, risk");
      answer = `**Comparison — ${p1.name} vs ${p2.name}**\n\n| Dimension | ${p1.name} | ${p2.name} |\n|---|---|---|\n| Health score | **${p1.healthScore}** (${p1.healthStatus}) | **${p2.healthScore}** (${p2.healthStatus}) |\n| Progress | ${p1.progress}% | ${p2.progress}% |\n| Budget | ${formatLakhs(p1.totalBudget)} | ${formatLakhs(p2.totalBudget)} |\n| Spent | ${formatLakhs(p1.spentBudget)} (${Math.round((p1.spentBudget / p1.totalBudget) * 100)}%) | ${formatLakhs(p2.spentBudget)} (${Math.round((p2.spentBudget / p2.totalBudget) * 100)}%) |\n| Delay probability | ${pct(p1.prediction?.probability ?? 0.06)} | ${pct(p2.prediction?.probability ?? 0.06)} |\n| Risk band | ${p1.riskAssessment?.riskLevel ?? "LOW"} | ${p2.riskAssessment?.riskLevel ?? "LOW"} |\n\n**Takeaway:** ${p1.healthScore >= p2.healthScore ? `${p2.name} carries the heavier risk profile and should absorb the next review slot; ${p1.name} stays on routine monitoring.` : `${p1.name} carries the heavier risk profile and should absorb the next review slot; ${p2.name} stays on routine monitoring.`}`;
      citations.push({ n: 1, label: "Portfolio DB — projects table", detail: "health & financial columns, live read" });
      break;
    }

    case "report_request": {
      addTool("generate_report", '{ "type": "executive" }', "Portfolio roll-up across 30 projects");
      const flagged = projects.filter((p) => p.healthStatus !== "HEALTHY");
      const atRisk = projects.filter((p) => p.healthStatus === "AT_RISK");
      const crit = projects.filter((p) => p.healthStatus === "CRITICAL");
      const totalBudget = projects.reduce((s, p) => s + p.totalBudget, 0);
      const totalSpent = projects.reduce((s, p) => s + p.spentBudget, 0);
      answer = `**Executive Summary — ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}**\n\n**Portfolio:** ${projects.length} projects · ${formatLakhs(totalBudget)} sanctioned · ${formatLakhs(totalSpent)} spent (${Math.round((totalSpent / totalBudget) * 100)}% utilisation) · average health **${Math.round(projects.reduce((s, p) => s + p.healthScore, 0) / projects.length)}/100**.\n\n**Exception set (${flagged.length}):**\n${crit.map((p) => `- 🔴 **${p.name}** — ${p.healthScore}/100. ${p.riskAssessment?.factors[0]?.description ?? ""}`).join("\n")}\n${atRisk.map((p) => `- 🟡 **${p.name}** — ${p.healthScore}/100, delay probability ${pct(p.prediction?.probability ?? 0.6)}. ${p.story ?? ""}`).join("\n")}\n\n**Financial watch:** ${projects.filter((p) => p.projectedBudget > p.totalBudget * 1.1).length} projects project >10% overrun; combined exposure ${formatLakhs(projects.filter((p) => p.projectedBudget > p.totalBudget * 1.1).reduce((s, p) => s + (p.projectedBudget - p.totalBudget), 0))}.\n\n**Recommended actions:** expedite steel procurement (Bharatmala P-4), escalate forest-clearance permit (Bundelkhand), and freeze non-critical procurement pending review (ICCC Prayagraj). Red-flagged items require human-officer verification before escalation (rule R10).`;
      citations.push({ n: 1, label: "Portfolio roll-up", detail: "30 projects, health & alerts snapshot" });
      break;
    }

    case "budget_query": {
      const p = findProjects(projects, question)[0] ?? projects.filter((x) => x.healthStatus === "CRITICAL")[0];
      addTool("get_project_detail", `{ "projectId": "${p.id}" }`, "budget records fetched");
      const fc = computeBudgetForecast(p);
      addTool("forecast/budget", `{ "projectId": "${p.id}" }`, `projectedFinal=₹${(fc.projectedFinal / 100).toFixed(2)} Cr, overrun=${fc.overrunPct}%`);
      citations.push({ n: 1, label: "Budget ledger + Prophet-style forecast", detail: `${p.budgetRecords.length} months of records, model sim:prophet-1.2` });
      answer = `**Budget analysis — ${p.name}**\n\n- Sanctioned: **${formatLakhs(p.totalBudget)}** · Spent to date: **${formatLakhs(p.spentBudget)}** (${Math.round((p.spentBudget / p.totalBudget) * 100)}%)\n- Projected final cost: **${formatLakhs(fc.projectedFinal)}** → projected overrun **${fc.overrunPct}%** ${fc.overrunPct > 20 ? "— **CRITICAL threshold (>20%) breached**" : fc.overrunPct > 10 ? "— **WARNING threshold (>10%) breached**" : "— within tolerance"}\n- Burn velocity (last 3 months) vs plan: ${((p.prediction?.factors.find((f) => f.feature === "budget_velocity_deviation")?.value ?? 0) * 100 + 100).toFixed(0)}%\n\nThe forecast interval widens in later months; if the **upper interval** crosses the planned line before completion, a BUDGET_STRESS alert fires even if the point estimate stays under 10% [1].\n\n**Action:** verify the materials ledger for the last two months and re-run the forecast after the next invoice upload.`;
      break;
    }

    case "doc_query": {
      const p = findProjects(projects, question)[0] ?? projects[0];
      addTool("search_documents", `{ "query": "${question}", "topK": 3 }`, `3 chunks retrieved from ${p.documents.length} indexed documents`);
      p.documents.slice(0, 3).forEach((d, i) => citations.push({ n: i + 1, label: d.fileName, detail: `${(d.fileSize / 1024).toFixed(0)} KB · processed ${timeAgo(d.uploadedAt)}` }));
      answer = `**Document intelligence — ${p.name}**\n\n${p.documents.length} processed documents are indexed for this project (OCR → GPT-4o extraction → vector search). Key findings across recent uploads:\n\n${p.documents.slice(0, 3).map((d, i) => `- **${d.fileName}** [${i + 1}] — ${d.summary ?? "no summary"} (${d.extractedData?.fieldsCaptured ?? 0} fields auto-populated from ${d.extractedData?.totalPages ?? 0} pages)`).join("\n")}\n\nAll extractions reconcile with dashboard values within ±2%. Ask me to *"show budget analysis"* to see the financial picture, or open the Reports page to simulate a new upload.`;
      break;
    }

    default: {
      /* status_query — portfolio query engine */
      const s = question.toLowerCase();
      let set = [...projects];
      let filterDesc = "entire portfolio";
      if (s.includes("tamil nadu") || s.includes("tn")) { set = set.filter((p) => p.state === "Tamil Nadu"); filterDesc = "Tamil Nadu"; }
      else if (/(attention|today|need)/.test(s)) { filterDesc = "exception set"; }
      else {
        const sec = ["roads", "health", "education", "urban", "water", "infrastructure"].find((x) => s.includes(x));
        if (sec) { set = set.filter((p) => p.sector.toLowerCase() === sec); filterDesc = `${sec} sector`; }
        const st = set.length && s.includes("delayed") ? set.filter((p) => p.healthStatus !== "HEALTHY") : set;
        if (st.length) set = st;
      }
      if (/attention|today|need/.test(s)) {
        set = set.filter((p) => p.healthStatus !== "HEALTHY" || p.alerts.some((a) => !a.isRead));
      }
      if (/delay|at risk|behind|risk/.test(s) && !/attention/.test(s)) {
        set = set.filter((p) => p.healthStatus !== "HEALTHY");
      }
      addTool("query_projects", `{ "filters": { "scope": "${filterDesc}" }, "sortBy": "healthScore" }`, `${set.length} projects returned`);
      set.slice(0, 6).forEach((p, i) => citations.push({ n: i + 1, label: p.name, detail: `health ${p.healthScore} · ${p.state} · ${formatLakhs(p.totalBudget)}` }));

      if (set.length === 0) {
        answer = `No projects matched **${filterDesc}** with that condition. The portfolio currently has ${projects.filter((p) => p.healthStatus !== "HEALTHY").length} flagged projects (2 AT_RISK, 1 CRITICAL). Try: *"Which projects need my attention today?"*`;
      } else {
        const lines = set.slice(0, 6).map((p, i) => {
          const dot = p.healthStatus === "CRITICAL" ? "🔴" : p.healthStatus === "AT_RISK" ? "🟡" : "🟢";
          return `${dot} **${p.name}** — health **${p.healthScore}**, ${p.progress}% complete, delay probability ${pct(p.prediction?.probability ?? 0.05)} [${i + 1}]`;
        });
        answer = `**${set.length} project${set.length > 1 ? "s" : ""} in scope** (${filterDesc}):\n\n${lines.join("\n")}\n\n${/attention|today|need/.test(s) ? "Recommended order of review: 🔴 items first, then 🟡. Each line item links to the full health breakdown, prediction factors and alert history." : "Ask me *\"Why is <project> at risk?\"* for the factor-level explanation of any line above."}`;
      }
    }
  }

  return { answer, toolCalls, citations, intent, dataFreshness: asOf() };
}
