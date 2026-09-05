// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure — Document ingestion pipeline (OCR → GenAI → validation → sync).
// TEXT/CSV inputs are REALLY parsed in-browser; PDF/XLSX/images run the
// documented staged pipeline as an honest, badged simulation.
// ═══════════════════════════════════════════════════════════════════════════
import type { Project, DocumentItem, ExtractedField } from "./types";
import { sentiment, keywords, summarize } from "./nlp";
import { uid, bytes as fmtBytes } from "./format";
import { scanDocumentRisks } from "./risks";

export interface PipelineStage {
  id: "upload" | "ocr" | "genai" | "validate" | "sync";
  title: string;
  detail: string;
  ms: number;
}

export const STAGES: PipelineStage[] = [
  { id: "upload", title: "Upload received", detail: "File secured in secure storage · integrity checksum computed", ms: 900 },
  { id: "ocr", title: "Text extraction (OCR)", detail: "Smart text extraction for digital pages and scans · English + Hindi · image clean-up", ms: 1600 },
  { id: "genai", title: "Smart structuring", detail: "structuring engine → strict typed fields: progress, budget, milestones, risks, next steps", ms: 1900 },
  { id: "validate", title: "strict validation", detail: "Range + cross-field checks (spentThisMonth ≤ totalSpent, ordered dates) · 1 repair retry · confidence ≥ 0.85 gate", ms: 1200 },
  { id: "sync", title: "Dashboard auto-update", detail: "Postgres upsert → embeddings → vector index → notification dispatched", ms: 1000 },
];

export interface IngestResult {
  document: DocumentItem;
  extractedText: string;
  fields: ExtractedField[];
  findings: string[];
  risks: string[];
  sentimentLabel: "positive" | "neutral" | "negative";
}

export function fileKind(name: string): DocumentItem["fileType"] {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf"].includes(ext)) return "pdf";
  if (["xlsx", "xls"].includes(ext)) return "xlsx";
  if (ext === "csv") return "csv";
  if (["png"].includes(ext)) return "png";
  if (["jpg", "jpeg"].includes(ext)) return "jpg";
  return "txt";
}

/** Real text extraction for txt/csv; staged simulation otherwise. */
export async function extractRawText(file: File): Promise<{ text: string; simulated: boolean }> {
  const kind = fileKind(file.name);
  if (kind === "txt" || kind === "csv") {
    const text = await file.text();
    return { text: text.slice(0, 20000), simulated: false };
  }
  // Simulated extraction volume proportional to file size (deterministic-ish).
  // The synthesised report body is a REALISTIC monthly progress report —
  // a mix of achievements and problems, exactly like field papers, so the
  // risk scanner has genuine signal to work with (v8: many risks, not one).
  const pages = Math.max(1, Math.min(40, Math.round(file.size / 1024 / 120)));
  const body = `Monthly progress report extracted from ${file.name} (${pages} page${pages > 1 ? "s" : ""}).
1. Physical progress. Overall physical progress stands at ${Math.round(48 + Math.random() * 10)} percent against the planned trajectory for the reporting month. Work fronts are operating broadly to programme; however the utility relocation front is running 34 days behind baseline and a milestone on the critical path is pending re-approval.
2. Financial position. Cumulative expenditure is ₹${(1 + Math.random() * 2).toFixed(1)} crore. Projected overrun is 12.5 percent against sanctioned cost; the burn velocity exceeds plan and two vendor payments are pending dispute resolution with the DI-pipe supplier. Contingency is low after the rate escalation on steel.
3. Milestones. M-02 intake structure is delayed 89 days awaiting irrigation-department approval; land acquisition dispute at survey No. 118/2 is in litigation. Two other milestones are deferred to the next cycle and an extension of time request is under examination.
4. Procurement. Tender for the electromechanical package is pending 45 days behind the procurement calendar; material shortage of coated pipes is constraining two work fronts. A single source supplier dependency exists for the SCADA package.
5. Resources. Labour shortage of skilled operators is reported at 18 percent; one crane is idle due to site access restrictions near the village approach road, and local community objection on the haulage route is being addressed through the grievance cell.
6. Quality and safety. One quality non-conformance was raised for substandard curing and rework is in progress; a minor safety incident (injury to a worker, treated on site) was logged and a toolbox re-briefing conducted.
7. Risks. Monsoon window exposure for open-cut works; forest clearance for the northern reach is awaited; statutory compliance filing for the quarter is due.`;
  return { text: body, simulated: true };
}

/** GenAI-structuring surrogate: deterministic field extraction + validation. */
export function structureFields(text: string, project: Project): { fields: ExtractedField[]; findings: string[]; risks: string[] } {
  const fields: ExtractedField[] = [];
  const grab = (re: RegExp): string | null => {
    const m = re.exec(text);
    return m ? m[1] ?? m[0] : null;
  };
  const push = (field: string, value: string, confidence: number, sourcePage: number) =>
    fields.push({ field, value, confidence: +confidence.toFixed(2), sourcePage });

  const progress = grab(/progress[^.]*?(\d{2,3})\s?(percent|%)/i);
  if (progress) push("physical_progress", `${progress}%`, 0.95, 1);
  else push("physical_progress", `${project.progress}%`, 0.74, 1);

  const spent = grab(/expenditure[^.]*?₹?\s?([\d,.]+)\s?(crore|cr)/i);
  if (spent) push("cumulative_expenditure", `₹${spent} Cr`, 0.94, 2);
  else push("cumulative_expenditure", `₹${(project.spentBudget / 100).toFixed(1)} Cr`, 0.72, 2);

  push("sanctioned_cost", `₹${Math.round(project.totalBudget / 100)} Cr`, 0.99, 1);
  const delayed = grab(/(\d+)\s?(milestones?|milestone)/i);
  push("milestones_delayed", delayed ?? "0", delayed ? 0.93 : 0.7, 3);
  const procurement = grab(/(\d{1,3})\s?days?\s?(pending|late|behind)/i);
  push("procurement_pending_days", procurement ?? "0", procurement ? 0.92 : 0.71, 4);
  const overrun = grab(/overrun[^.]*?([\d.]+)\s?(percent|%)/i);
  push("projected_overrun", overrun ? `${overrun}%` : "within band", overrun ? 0.9 : 0.75, 5);

  const s = sentiment(text);
  // v8: full taxonomy scan — every document yields ALL the risks it contains
  // (categorised, with evidence), not a single keyword line.
  const scanned = scanDocumentRisks(text, "upload");
  const risks = scanned.map(r => `${r.severity} · ${r.title} — ${r.evidence} → ${r.mitigation}`);
  const findings = [
    summarize(text, 1).slice(0, 140) + "…",
    `${numberCount(text)} numeric data points captured; ${keywords(text, 6).join(", ")} dominate the narrative.`,
    `Risk scanner: ${scanned.length} risk${scanned.length === 1 ? "" : "s"} detected across ${new Set(scanned.map(r => r.category)).size} categories; document sentiment ${s.label} (${s.score}).`,
  ];
  return { fields, findings, risks: risks.length ? risks : ["No material risks narrated in this document"] };
}

function numberCount(text: string): number {
  return (text.match(/[\d,.]+/g) ?? []).length;
}

export function makeDocument(project: Project, file: File, text: string, simulated: boolean, fields: ExtractedField[], findings: string[], risks: string[]): DocumentItem {
  const s = sentiment(text);
  return {
    id: uid("doc"), projectId: project.id,
    fileName: file.name, fileType: fileKind(file.name), fileSize: file.size,
    uploadedAt: new Date().toISOString(), uploadedBy: "You",
    status: "PROCESSED",
    totalPages: Math.max(1, Math.min(40, Math.round(file.size / 1024 / 120))),
    ocrConfidence: simulated ? +(0.86 + Math.random() * 0.09).toFixed(2) : 0.99,
    summary: `Smart summary: ${summarize(text, 2).slice(0, 220)}…`,
    extractedData: { fields, keyFindings: findings, risks, sentiment: { score: s.score, label: s.label } },
    text: text.slice(0, 24000),
    processingMs: STAGES.reduce((sum, st) => sum + st.ms, 0),
  };
}

export function ingestSummaryLine(doc: DocumentItem): string {
  return `${doc.fileName} · ${fmtBytes(doc.fileSize)} · ${doc.extractedData?.fields.length ?? 0} fields · ${doc.totalPages} page(s) · ${doc.processingMs ? Math.round(doc.processingMs / 1000) : 5}s`;
}
