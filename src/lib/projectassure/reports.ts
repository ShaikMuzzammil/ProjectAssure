// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure — Report generation engine (REAL exports).
// jsPDF → branded PDF reports · SheetJS → multi-sheet Excel · CSV.
// Every export is audit-loggable and emailable via the Email Centre.
// ═══════════════════════════════════════════════════════════════════════════
import type { Project, PortfolioStats, ReportKind, User } from "./types";
import { inr, shortDate, dateTime, monthLabel } from "./format";
import { computeBudgetForecast } from "./ml";
import { deriveRiskRegister, RISK_CATEGORY_META } from "./risks";
import { buildRecommendedActions } from "./recommendations";

export type ReportBlock =
  | { type: "para"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "kv"; items: [string, string][] };
export interface ReportSection { title: string; blocks: ReportBlock[] }
export interface ReportDoc {
  meta: { title: string; subtitle: string; scope: string; generatedBy: string; generatedAt: string; classification: string };
  sections: ReportSection[];
}

const BRAND: [number, number, number] = [11, 66, 110];    // #0b426e
const ACCENT: [number, number, number] = [12, 147, 231];  // #0c93e7

// ─── v8: export topic picker ("what to export") ───────────────────────────
// Users choose WHICH matter goes into the file — the recommended set is the
// compact, decision-ready core; everything else is opt-in per section title.
export const REPORT_TOPICS: { id: string; label: string; hint: string; re: RegExp; recommended?: boolean }[] = [
  { id: "summary", label: "Summary", hint: "Health, progress and money at a glance", re: /summary|pulse/i, recommended: true },
  { id: "risks", label: "Faults & risks", hint: "The live risk register — every risk with its fix", re: /risk|fault/i, recommended: true },
  { id: "recommendations", label: "Recommendations", hint: "What to do, who owns it, by when", re: /recommend|action|plan/i, recommended: true },
  { id: "alerts", label: "Alerts", hint: "Open alerts with owners and deadlines", re: /alert/i },
  { id: "prediction", label: "Predictions", hint: "Delay probability, slip and driving factors", re: /prediction/i },
  { id: "budget", label: "Budget & spend", hint: "Sanction, burn, forecast and bands", re: /budget|burn|money|signal/i },
  { id: "milestones", label: "Milestones", hint: "Milestone board and dates", re: /milestone/i },
  { id: "resources", label: "Resources", hint: "People, machines and material", re: /resource/i },
  { id: "documents", label: "Documents", hint: "Vault contents and data activity", re: /document|vault|activity/i },
];
export const DEFAULT_TOPICS = REPORT_TOPICS.filter(t => t.recommended).map(t => t.id);
export function filterReport(doc: ReportDoc, topics: string[]): ReportDoc {
  if (!topics.length) return doc;
  const chosen = REPORT_TOPICS.filter(t => topics.includes(t.id));
  if (!chosen.length) return doc;
  return { ...doc, sections: doc.sections.filter(s => chosen.some(t => t.re.test(s.title))) };
}

// ─── Content builders ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function buildReport(kind: ReportKind, projects: Project[], stats: PortfolioStats, user: User, scopeProject?: Project): ReportDoc {
  const generatedAt = dateTime(new Date());
  const base: ReportDoc = {
    meta: {
      title: "", subtitle: "", scope: scopeProject ? `Project ${scopeProject.psId} — ${scopeProject.name}` : `National portfolio · ${projects.length} projects`,
      generatedBy: `${user.name} (${user.designation})`, generatedAt, classification: "OFFICIAL — For internal review",
    },
    sections: [],
  };
  const exceptions = projects.filter(p => p.healthStatus !== "HEALTHY").sort((a, b) => a.healthScore - b.healthScore);
  const S = (title: string, ...blocks: ReportBlock[]) => base.sections.push({ title, blocks });

  if (kind === "project-status" && scopeProject) {
    const p = scopeProject;
    base.meta.title = `Project Status Report — ${p.name}`;
    base.meta.subtitle = `${p.psId} · ${p.scheme} · ${p.sector} · ${p.district}, ${p.state}`;
    const f = computeBudgetForecast(p);
    S("Executive summary",
      { type: "para", text: `${p.name} is currently in the ${p.healthStatus} band with a composite health score of ${p.healthScore}/100, computed from Schedule ${p.scheduleScore} (weight 30%), Budget ${p.budgetScore} (25%), Resources ${p.resourceScore} (20%) and Milestones ${p.milestoneScore} (25%). Physical progress stands at ${p.progress}% against a target date of ${shortDate(p.targetDate)}${p.estimatedEndDate ? `; the current estimated completion is ${shortDate(p.estimatedEndDate)}` : ""}. Expenditure is ${inr(p.spentBudget)} of the sanctioned ${inr(p.totalBudget)}, and the forecast projects a final cost of ${inr(p.projectedBudget)} (${(((p.projectedBudget - p.totalBudget) / p.totalBudget) * 100).toFixed(1)}% versus sanction).` });
    S("Live risk register (faults)",
      { type: "bullets", items: (() => { const reg = deriveRiskRegister(p); return reg.risks.map(r => `[${r.severity} · ${RISK_CATEGORY_META[r.category].label}] ${r.title} — ${r.description} → What to do: ${r.mitigation}${r.sourceDoc ? ` (source: ${r.sourceDoc})` : ""}`); })() });
    S("Delay prediction (model advisory)",
      p.prediction
        ? { type: "bullets", items: [
            `Probability of missing the contractual date: ${Math.round(p.prediction.probability * 100)}% (model ${p.prediction.modelVersion})`,
            `Estimated slip: ${p.prediction.estimatedDays} days · 90% CI ${p.prediction.ciLower}–${p.prediction.ciUpper} days`,
            `Model confidence: ${Math.round(p.prediction.confidence * 100)}%`,
            ...p.prediction.factors.slice(0, 4).map(fc => `${fc.label} (${fc.valueLabel}): ${fc.plainLanguage}`),
            "Rule R10: advisory probability — verification by the responsible officer is required before escalation.",
          ] }
        : { type: "para", text: "No active prediction: the project is not in execution (planning, completed, on-hold or cancelled)." });
    S("Plan of action (recommendations)",
      { type: "bullets", items: buildRecommendedActions(p).map(a => `P${a.priority} · ${a.area} — ${a.title}: ${a.action} (owner: ${a.owner}; ${a.deadline}; expected impact: ${a.expectedImpact})`) });
    S("Milestones",
      { type: "table", head: ["Milestone", "Status", "Planned", "Actual", "Critical", "Progress"], rows: p.milestones.map(m => [m.name, m.status, shortDate(m.plannedDate), m.actualDate ? shortDate(m.actualDate) : "—", m.isCritical ? "YES" : "no", `${m.progress}%`]) });
    S("Budget burn (monthly, ₹ lakh)",
      { type: "table", head: ["Month", "Planned", "Spent", "Variance"], rows: (() => {
        const byM = new Map<string, { planned: number; spent: number }>();
        for (const r of p.budgetRecords) { const k = monthLabel(r.month, r.year); const e = byM.get(k) ?? { planned: 0, spent: 0 }; e.planned += r.planned; e.spent += r.spent; byM.set(k, e); }
        return [...byM.entries()].map(([k, v]) => [k, String(v.planned), String(v.spent), `${v.spent - v.planned > 0 ? "+" : ""}${v.spent - v.planned}`]);
      })() },
      { type: "para", text: `Cost forecast: projected final ${inr(f.projectedFinal)} · overrun ${f.overrunPct}% · mean monthly burn ${inr(f.monthlyBurn)}${f.breachMonth ? ` · sanction breached in ${f.breachMonth}` : ""}.` });
    S("Resources",
      { type: "table", head: ["Resource", "Category", "Allocated", "Utilised", "Status"], rows: p.resources.map(r => [r.name, r.category, `${r.quantity} ${r.unit}`, `${r.utilised}%`, r.status]) });
    S("Active alerts & recommended actions",
      { type: "bullets", items: p.alerts.filter(a => !a.isRead).map(a => `[${a.severity}] ${a.title} — ${a.recommendedAction} (owner: ${a.recommendedOwner}; ${a.recommendedDeadline})`) });
    S("Document vault",
      { type: "table", head: ["File", "Pages", "Status", "Uploaded"], rows: p.documents.map(d => [d.fileName, String(d.totalPages), d.status, shortDate(d.uploadedAt)]) });
  } else if (kind === "executive" || kind === "weekly" || kind === "portfolio-flash") {
    base.meta.title = kind === "weekly" ? "Weekly Portfolio Digest" : kind === "portfolio-flash" ? "Portfolio Flash Report" : "Executive Status Report";
    base.meta.subtitle = `Central-sector portfolio monitoring · ${stats.healthy} healthy · ${stats.atRisk} at-risk · ${stats.critical} critical`;
    S("Portfolio pulse",
      { type: "kv", items: [
        ["Total projects monitored", String(stats.totalProjects)], ["Sanctioned outlay", inr(stats.totalBudget)],
        ["Expenditure to date", inr(stats.totalSpent)], ["Average health", `${stats.avgHealth}/100`],
        ["Distribution", `${stats.healthy} Healthy / ${stats.atRisk} At-Risk / ${stats.critical} Critical`],
        ["Unread alerts", `${stats.alertsUnread} (${stats.criticalAlerts} critical)`],
        ["Projected overrun projects", `${stats.projectedOverruns} above the +10% band`],
      ] });
    S("Projects requiring attention",
      { type: "table", head: ["Project", "Health", "Delay prob", "Overrun", "Recommended action"], rows: exceptions.map(p => [
        p.name.replace(/,.*$/, ""), `${p.healthScore} (${p.healthStatus})`,
        p.prediction ? `${Math.round(p.prediction.probability * 100)}%` : "—",
        `${(((p.projectedBudget - p.totalBudget) / p.totalBudget) * 100).toFixed(1)}%`,
        (p.alerts.find(a => !a.isRead) ?? p.alerts[0])?.recommendedAction.slice(0, 90) ?? "monitor weekly",
      ]) });
    S("Risk register highlights (faults)",
      { type: "bullets", items: exceptions.slice(0, 8).flatMap(p => deriveRiskRegister(p).risks.slice(0, 3).map(r => `${p.psId} · [${r.severity} · ${RISK_CATEGORY_META[r.category].label}] ${r.title} — ${r.mitigation}`)) });
    S("Budget signals",
      { type: "table", head: ["Project", "Sanction", "Spent", "Projected final", "Band"], rows: projects.filter(p => p.projectedBudget > p.totalBudget * 1.08).map(p => [
        p.name.replace(/,.*$/, ""), inr(p.totalBudget), inr(p.spentBudget), inr(p.projectedBudget),
        p.projectedBudget > p.totalBudget * 1.2 ? "CRITICAL >20%" : "WARNING >10%",
      ]) },
      { type: "para", text: "Threshold rules: projected overrun >10% triggers a WARNING with weekly re-forecast; >20% escalates to the ministry dashboard with a mandatory review note; burn velocity deviation beyond +30% for two consecutive months fires an EARLY_WARNING before the overrun materialises." });
    S("Milestones due next cycle",
      { type: "bullets", items: projects.flatMap(p => p.milestones.filter(m => m.status !== "COMPLETED" && new Date(m.plannedDate) < new Date(Date.now() + 30 * 86400000)).slice(0, 1).map(m => `${p.psId} — ${m.name} (${shortDate(m.plannedDate)}${m.isCritical ? " · CRITICAL PATH" : ""})`)).slice(0, 10) });
    S("Document & data activity",
      { type: "para", text: `${stats.documentsProcessed} documents processed through the smart reading → structuring → validation pipeline across the portfolio. Every ingestion updates dashboards within five minutes and is captured in the audit trail. Exports and intelligence answers are logged with user, role and timestamp.` });
  } else {
    // risk-deep-dive
    base.meta.title = "Risk Deep-Dive Pack";
    base.meta.subtitle = `Full factor explanations, risk registers and mitigations for ${exceptions.length} exception projects`;
    for (const p of exceptions) {
      S(`${p.name} (${p.healthScore} — ${p.healthStatus})`,
        { type: "para", text: `${p.district}, ${p.state} · ${p.scheme} · PM ${p.projectManager} · contractor ${p.contractor}. Progress ${p.progress}% against ${shortDate(p.targetDate)}.` },
        p.prediction
          ? { type: "table", head: ["Factor", "Observed", "Contribution (log-odds)", "Direction"], rows: p.prediction.factors.map(f => [f.label, f.valueLabel, `${f.contribution > 0 ? "+" : ""}${f.contribution.toFixed(2)}`, f.direction]) }
          : { type: "para", text: "No active delay prediction for this project." },
        { type: "bullets", items: deriveRiskRegister(p).risks.map(r => `[${r.severity} · ${RISK_CATEGORY_META[r.category].label}] ${r.title} — impact ${r.impact}/100: ${r.description} → ${r.mitigation}`) },
        { type: "bullets", items: p.alerts.map(a => `[${a.severity}] ${a.title}: ${a.recommendedAction} (owner ${a.recommendedOwner})`) });
    }
  }
  base.meta.generatedAt = generatedAt;
  return base;
}

// ─── CSV ────────────────────────────────────────────────────────────────────
export function downloadCsv(rows: (string | number)[][], fileName: string) {
  const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = rows.map(r => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, fileName);
}

export function projectsToRows(projects: Project[]): (string | number)[][] {
  const head = ["PS ID", "Project", "Department", "Sector", "State", "District", "Status", "Health", "Band", "Schedule", "Budget", "Resources", "Milestones", "Progress %", "Sanction (₹L)", "Spent (₹L)", "Projected (₹L)", "Overrun %", "Delay prob %", "Est. slip (days)", "Target date", "PM", "Contractor"];
  return [head, ...projects.map(p => [
    p.psId, p.name, p.departmentId.replace("dept-", "").toUpperCase(), p.sector, p.state, p.district, p.status,
    p.healthScore, p.healthStatus, p.scheduleScore, p.budgetScore, p.resourceScore, p.milestoneScore, p.progress,
    p.totalBudget, p.spentBudget, p.projectedBudget, (((p.projectedBudget - p.totalBudget) / p.totalBudget) * 100).toFixed(1),
    p.prediction ? Math.round(p.prediction.probability * 100) : "", p.prediction ? p.prediction.estimatedDays : "",
    shortDate(p.targetDate), p.projectManager, p.contractor,
  ])];
}

// ─── Excel (SheetJS) ────────────────────────────────────────────────────────
export async function downloadExcel(doc: ReportDoc, fileName: string, extraSheets: { name: string; rows: (string | number)[][] }[] = []) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  // v4: sheet names must be unique — dedupe on the fly (XLSX throws on duplicates)
  const used = new Set<string>(["Report"]);
  const uniqueName = (raw: string) => {
    let base = (raw.replace(/[\\/?*[\]:]/g, "").slice(0, 25) || "Sheet").trim();
    let name = base, i = 2;
    while (used.has(name)) { name = `${base.slice(0, 23)} ${i++}`; }
    used.add(name);
    return name;
  };
  const meta: (string | number)[][] = [["ProjectAssure — SIH 2026 (SIH26103)"], [doc.meta.title], ["Scope", doc.meta.scope], ["Generated by", doc.meta.generatedBy], ["Generated at", doc.meta.generatedAt], ["Classification", doc.meta.classification], []];
  const ws1 = XLSX.utils.aoa_to_sheet(meta);
  XLSX.utils.sheet_add_aoa(ws1, doc.sections.map(s => [s.title]), { origin: -1 });
  XLSX.utils.book_append_sheet(wb, ws1, "Report");
  for (const s of doc.sections) {
    const rows: (string | number)[][] = [];
    for (const b of s.blocks) {
      if (b.type === "table") { rows.push(b.head); rows.push(...b.rows); rows.push([]); }
      else if (b.type === "bullets") { rows.push(...b.items.map(i => ["•", i])); rows.push([]); }
      else if (b.type === "kv") { rows.push(...b.items.map(([k, v]) => [k, v])); rows.push([]); }
      else { rows.push([b.text]); rows.push([]); }
    }
    const ws = XLSX.utils.aoa_to_sheet([[s.title], [], ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, uniqueName(s.title));
  }
  for (const ex of extraSheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ex.rows), uniqueName(ex.name));
  XLSX.writeFile(wb, fileName, { compression: true });
}

// ─── PDF (jsPDF, hand-rolled tables) ────────────────────────────────────────
export async function downloadPdf(doc: ReportDoc, fileName: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 16;
  const maxW = W - M * 2;
  let y = 0;
  let page = 1;

  const ensure = (h: number) => { if (y + h > H - 18) { footer(); pdf.addPage(); page++; y = M; headerBand(); } };
  const headerBand = () => {
    pdf.setFillColor(...BRAND); pdf.rect(0, 0, W, 4, "F");
    pdf.setFillColor(...ACCENT); pdf.rect(0, 4, W, 1.2, "F");
    pdf.setTextColor(100, 116, 139); pdf.setFontSize(7.5); pdf.setFont("helvetica", "normal");
    pdf.text("ProjectAssure · Intelligence-Powered Predictive Project Monitoring · SIH 2026 (SIH26103)", M, 12);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`${doc.meta.classification}`, W - M, 12, { align: "right" });
    y = 18;
  };
  const footer = () => {
    pdf.setDrawColor(226, 232, 240); pdf.line(M, H - 14, W - M, H - 14);
    pdf.setFontSize(7.5); pdf.setTextColor(148, 163, 184);
    pdf.text(`Generated ${doc.meta.generatedAt} by ${doc.meta.generatedBy} · audit-logged`, M, H - 9);
    pdf.text(`Page ${page}`, W - M, H - 9, { align: "right" });
  };

  headerBand();
  // Title block
  pdf.setFillColor(...BRAND); pdf.rect(M, y, 3, 20, "F");
  pdf.setTextColor(15, 23, 42); pdf.setFont("helvetica", "bold"); pdf.setFontSize(19);
  const titleLines = pdf.splitTextToSize(doc.meta.title, maxW - 8) as string[];
  pdf.text(titleLines, M + 7, y + 8);
  y += Math.max(20, titleLines.length * 8 + 6);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(71, 85, 105);
  pdf.text(pdf.splitTextToSize(doc.meta.subtitle, maxW) as string[], M, y);
  y += 6;
  pdf.setFontSize(8.5); pdf.setTextColor(100, 116, 139);
  pdf.text(`Scope: ${doc.meta.scope}`, M, y); y += 4.5;
  pdf.text(`Generated: ${doc.meta.generatedAt} · by ${doc.meta.generatedBy}`, M, y); y += 8;

  // Health trio legend strip
  pdf.setFillColor(34, 197, 94); pdf.rect(M, y - 2, 22, 3, "F");
  pdf.setFillColor(245, 158, 11); pdf.rect(M + 25, y - 2, 22, 3, "F");
  pdf.setFillColor(239, 68, 68); pdf.rect(M + 50, y - 2, 22, 3, "F");
  pdf.setFontSize(7); pdf.setTextColor(100, 116, 139);
  pdf.text("Healthy ≥75", M, y + 6); pdf.text("At-Risk 50–74", M + 25, y + 6); pdf.text("Critical <50", M + 50, y + 6);
  y += 12;

  for (const s of doc.sections) {
    ensure(16);
    pdf.setFillColor(...BRAND); pdf.rect(M, y - 3.5, maxW, 0.8, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12.5); pdf.setTextColor(...BRAND);
    pdf.text(s.title, M, y + 3);
    y += 9;

    for (const b of s.blocks) {
      if (b.type === "para") {
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5); pdf.setTextColor(51, 65, 85);
        const lines = pdf.splitTextToSize(b.text, maxW) as string[];
        for (const ln of lines) { ensure(5.5); pdf.text(ln, M, y); y += 5; }
        y += 3;
      } else if (b.type === "bullets") {
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5); pdf.setTextColor(51, 65, 85);
        for (const it of b.items) {
          const lines = pdf.splitTextToSize(it, maxW - 6) as string[];
          for (let i = 0; i < lines.length; i++) { ensure(5.5); if (i === 0) { pdf.setFillColor(...ACCENT); pdf.circle(M + 1.6, y - 1.4, 0.9, "F"); } pdf.text(lines[i], M + 5, y); y += 5; }
          y += 1.2;
        }
        y += 2;
      } else if (b.type === "kv") {
        for (const [k, v] of b.items) {
          ensure(6);
          pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.setTextColor(...BRAND);
          pdf.text(`${k}:`, M, y);
          pdf.setFont("helvetica", "normal"); pdf.setTextColor(51, 65, 85);
          const vLines = pdf.splitTextToSize(v, maxW - 55) as string[];
          pdf.text(vLines, M + 55, y);
          y += Math.max(5.4, vLines.length * 5.4);
        }
        y += 2.5;
      } else if (b.type === "table") {
        drawTable(b.head, b.rows);
        y += 4;
      }
    }
    y += 3;
  }
  footer();

  function drawTable(head: string[], rows: string[][]) {
    const colCount = head.length;
    const weights = head.map((h, i) => (i === 0 ? 0.34 : (0.66 / (colCount - 1))));
    // measure column widths by content
    const natural = head.map((h, ci) => Math.max(...[h, ...rows.map(r => r[ci] ?? "")].map(s => (pdf.splitTextToSize(String(s), 500) as string[]).join(" ").length)));
    const totalNat = natural.reduce((a, b) => a + b, 0) || 1;
    const colW = natural.map(n => Math.max(14, (n / totalNat) * maxW * 1.06));
    const scale = maxW / colW.reduce((a, b) => a + b, 0);
    const widths = colW.map(w => w * scale);
    const rowH = (cells: string[]) => {
      const cellLines = cells.map((c, i) => pdf.splitTextToSize(String(c ?? ""), widths[i] - 3) as string[]);
      return Math.max(6, Math.max(...cellLines.map(l => l.length)) * 4.4 + 2.5);
    };
    const drawRow = (cells: string[], isHead: boolean) => {
      const h = rowH(cells);
      ensure(h + 2);
      let x = M;
      if (isHead) { pdf.setFillColor(...BRAND); pdf.rect(M, y, maxW, h, "F"); }
      else { pdf.setFillColor(248, 250, 252); pdf.rect(M, y, maxW, h, "F"); pdf.setDrawColor(226, 232, 240); pdf.rect(M, y, maxW, h); }
      pdf.setFont("helvetica", isHead ? "bold" : "normal"); pdf.setFontSize(isHead ? 8 : 7.8);
      pdf.setTextColor(isHead ? 255 : 51, isHead ? 255 : 65, isHead ? 255 : 85);
      for (let i = 0; i < cells.length; i++) {
        const lines = pdf.splitTextToSize(String(cells[i] ?? ""), widths[i] - 3) as string[];
        let ty = y + 4.6;
        for (const ln of lines) { pdf.text(ln, x + 1.8, ty); ty += 4; }
        x += widths[i];
      }
      y += h;
    };
    drawRow(head, true);
    rows.forEach((r, idx) => drawRow(r, false));
  }

  pdf.save(fileName);
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function reportFileName(kind: ReportKind, scopeProject?: Project): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${scopeProject ? scopeProject.psId : "PORTFOLIO"}-${kind}-${stamp}`;
}

export const REPORT_KINDS: { id: ReportKind; title: string; desc: string; pages: number; formats: ("pdf" | "xlsx" | "csv")[] }[] = [
  { id: "executive", title: "Executive Status Report", desc: "Portfolio-level brief for Secretary review: pulse, exceptions, budget signals, due milestones.", pages: 4, formats: ["pdf", "xlsx", "csv"] },
  { id: "weekly", title: "Weekly Portfolio Digest", desc: "Monday 08:00 IST digest template: attention list, budget bands, document activity.", pages: 3, formats: ["pdf", "xlsx"] },
  { id: "risk-deep-dive", title: "Risk Deep-Dive Pack", desc: "Full driving-factor tables, risk registers and per-project mitigations for every exception.", pages: 8, formats: ["pdf", "xlsx"] },
  { id: "project-status", title: "Project Status Report", desc: "Single-project annexure: health, prediction, milestones, burn, resources, alerts, vault.", pages: 6, formats: ["pdf", "xlsx", "csv"] },
  { id: "portfolio-flash", title: "Portfolio Flash Report", desc: "The flash-report format automated: one page of pulse + one of exceptions.", pages: 2, formats: ["pdf", "csv"] },
];
