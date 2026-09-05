"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { SectionTitle, EmptyState, Md } from "../shared/ui-bits";
import DocPipeline from "../shared/doc-pipeline";
import { REPORT_KINDS, buildReport, downloadPdf, downloadExcel, downloadCsv, projectsToRows, reportFileName, REPORT_TOPICS, DEFAULT_TOPICS, filterReport } from "@/lib/projectassure/reports";
import { inr, relTime, bytes as fmtBytes } from "@/lib/projectassure/format";
import { can } from "@/lib/projectassure/permissions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileText, FileSpreadsheet, FileDown, Mail, UploadCloud, BookOpen, Zap, Trash2, ArrowRight, ListChecks } from "lucide-react";
import type { ReportKind } from "@/lib/projectassure/types";
import { Checkbox } from "@/components/ui/checkbox";
import type { ReportSection } from "@/lib/projectassure/reports";

// v8: flatten a report section into plain text rows (for CSV/Excel sheets)
function sectionRows(s: ReportSection): (string | number)[][] {
  const rows: (string | number)[][] = [];
  for (const b of s.blocks) {
    if (b.type === "para") rows.push([b.text]);
    else if (b.type === "bullets") b.items.forEach(i => rows.push([`• ${i}`]));
    else if (b.type === "kv") b.items.forEach(([k, v]) => rows.push([k, v]));
    else if (b.type === "table") { rows.push(b.head); rows.push(...b.rows); }
  }
  return rows;
}

export default function ReportsView() {
  const user = useApp(s => s.user)!;
  const projects = useApp(s => s.scoped)();
  const stats = useApp(s => s.stats)();
  const recordExport = useApp(s => s.recordExport);
  const navigate = useApp(s => s.navigate);
  const openProject = useApp(s => s.openProject);
  const queueEmail = useApp(s => s.queueEmail);
  const deleteDocument = useApp(s => s.deleteDocument);
  const userRole = user.role;

  const [targetId, setTargetId] = useState(projects.find(p => p.healthStatus !== "HEALTHY")?.id ?? projects[0]?.id ?? "");
  const [kind, setKind] = useState<ReportKind>("project-status");
  const [topics, setTopics] = useState<string[]>(DEFAULT_TOPICS);
  const target = projects.find(p => p.id === targetId) ?? projects[0];
  const deepDive = kind === "risk-deep-dive";   // this pack always carries the full register
  const toggleTopic = (id: string) => setTopics(ts => ts.includes(id) ? ts.filter(x => x !== id) : [...ts, id]);

  const vault = projects.flatMap(p => p.documents.map(d => ({ ...d, project: p }))).sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt)).slice(0, 14);

  const doExport = async (format: "pdf" | "xlsx" | "csv") => {
    if (!target) return;
    const full = buildReport(kind, projects, stats, user, kind === "project-status" ? target : undefined);
    const doc = deepDive ? full : filterReport(full, topics);
    const fn = reportFileName(kind, kind === "project-status" ? target : undefined);
    if (format === "pdf") await downloadPdf(doc, fn);
    else if (format === "xlsx") await downloadExcel(doc, fn, [{ name: "Data", rows: projectsToRows(projects) }, ...doc.sections.map(s => ({ name: s.title.replace(/[\\/?*\[\]:]/g, "").slice(0, 28), rows: [[s.title], ...sectionRows(s)] }))]);
    else downloadCsv(doc.sections.flatMap(s => sectionRows(s)), fn);
    recordExport(REPORT_KINDS.find(r => r.id === kind)?.title ?? kind, format, `${target.psId} — ${target.name} · ${deepDive ? "full pack" : `${topics.length} topic(s)`}`);
    toast.success(`${format.toUpperCase()} report generated`, { description: `${fn}.${format} · ${doc.sections.length} section(s) · ${deepDive ? "full deep-dive pack" : "your selected matter only"} · audit-logged` });
  };

  const emailIt = async () => {
    if (!target) return;
    const fn = reportFileName(kind, kind === "project-status" ? target : undefined);
    const msg = await queueEmail({ to: user.email, toName: user.name, template: "report_delivery", reportName: `${fn}.pdf`, project: target, projectId: target.id, attachments: [{ name: `${fn}.pdf`, kind: "pdf", sizeKb: 296 }], send: true });
    toast.success(msg.status === "SENT" ? "Emailed via email service" : "Queued to the demo outbox", { description: `To ${msg.to} · preview in the Email Centre` });
    navigate("email-center");
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight">Reports & Documents</h1>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">Paper → platform ingestion, the document vault, and the report factory — every artifact is audit-logged and emailable</p>
      </div>

      {/* ingestion */}
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border bg-card p-5">
          <SectionTitle icon={UploadCloud} sub="upload a field report for a project — the 4-stage pipeline runs live">Ingestion pipeline (paper → platform)</SectionTitle>
          {target ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger className="h-9 w-full text-[12.5px] sm:w-[380px]"><SelectValue placeholder="Choose target project" /></SelectTrigger>
                  <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.psId} — {p.name.slice(0, 44)}{p.healthStatus !== "HEALTHY" ? " ⚠" : ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <DocPipeline project={target} />
            </>
          ) : <EmptyState icon={FileText} title="No projects in scope" />}
        </div>

        <div className="rounded-xl border bg-gradient-to-b from-[#072b49] to-[#0b426e] p-5 text-white">
          <div className="flex items-center gap-2 text-[13px] font-bold"><Zap className="h-4 w-4 text-[#7cc8fb]" />How a report becomes data</div>
          <ul className="mt-3 space-y-2.5 text-[11.5px] leading-relaxed text-white/80">
            <li><strong className="text-white">1 · Upload</strong> — the file is received securely and its integrity is checked before anything else runs.</li>
            <li><strong className="text-white">2 · Read</strong> — digital pages and scans are read (English + Hindi); hard-to-read pages carry a confidence score.</li>
            <li><strong className="text-white">3 · Extract</strong> — the Smart structuring step turns free text into strict typed fields; spreadsheets are read with type checks.</li>
            <li><strong className="text-white">4 · Validate</strong> — ranges and cross-field rules (e.g. monthly spend ≤ total, ordered dates); low confidence goes to human review.</li>
            <li><strong className="text-white">5 · Sync</strong> — dashboards, predictions and search refresh automatically, and the project owner is notified.</li>
          </ul>
          <div className="mt-4 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[10.5px] leading-relaxed text-white/70">
            In this prototype, text and spreadsheet files are parsed for real in your browser; other formats run the same stages as a clearly-badged demo with real progress and confidence scores.
          </div>
        </div>
      </div>

      {/* report factory */}
      <div className="rounded-xl border bg-card p-5">
        <SectionTitle icon={FileText} sub="branded, audit-logged, emailable — pick exactly what goes in, then export">Report factory</SectionTitle>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Report type</div>
            <Select value={kind} onValueChange={v => setKind(v as ReportKind)}>
              <SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>{REPORT_KINDS.map(r => <SelectItem key={r.id} value={r.id}>{r.title} · ~{r.pages}p</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {kind === "project-status" && (
            <div className="min-w-[220px] flex-1">
              <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Project scope</div>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.psId} — {p.name.slice(0, 40)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={() => doExport("pdf")} className="bg-gradient-to-r from-[#0b426e] to-[#0c93e7]"><FileText className="h-4 w-4" />PDF</Button>
            <Button variant="outline" onClick={() => doExport("xlsx")}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
            <Button variant="outline" onClick={() => doExport("csv")}><FileDown className="h-4 w-4" />CSV</Button>
            {can(user, "email:send") && <Button variant="outline" onClick={emailIt}><Mail className="h-4 w-4" />Email</Button>}
          </div>
        </div>

        {/* v8: WHAT TO EXPORT — multi-select, recommended set pre-checked */}
        {deepDive ? (
          <div className="mt-3 rounded-lg border bg-muted/40 px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Risk deep-dive pack:</strong> this report always carries the full register — factor tables, every risk with its mitigation, and the alert log — so no selection is needed.
          </div>
        ) : (
          <div className="mt-3 rounded-xl border bg-muted/25 p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-[11.5px] font-bold"><ListChecks className="h-3.5 w-3.5 text-[#0c93e7] dark:text-[#36adf6]" />What to export</div>
              <span className="text-[10.5px] text-muted-foreground">recommended matter is pre-selected — tick more or untick to slim the file</span>
              <div className="ml-auto flex gap-1.5">
                <button onClick={() => setTopics(DEFAULT_TOPICS)} className="rounded-full border px-2.5 py-1 text-[10px] font-bold text-muted-foreground transition hover:bg-muted">Recommended only</button>
                <button onClick={() => setTopics(REPORT_TOPICS.map(t => t.id))} className="rounded-full border px-2.5 py-1 text-[10px] font-bold text-muted-foreground transition hover:bg-muted">Everything</button>
              </div>
            </div>
            <div className="mt-2.5 grid gap-1.5 sm:grid-cols-3">
              {REPORT_TOPICS.map(t => {
                const on = topics.includes(t.id);
                return (
                  <label key={t.id} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 transition", on ? "border-[#0c93e7]/40 bg-[#e0effe]/50 dark:bg-[#0c93e7]/10" : "hover:bg-muted/40")}>
                    <Checkbox checked={on} onCheckedChange={() => toggleTopic(t.id)} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-semibold">{t.label}{t.recommended && <span className="rounded-full bg-[#0c93e7]/15 px-1.5 py-0.5 text-[8.5px] font-bold text-[#015ca0] dark:text-[#7cc8fb]">RECOMMENDED</span>}</span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">{t.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {REPORT_KINDS.slice(0, 3).map(r => (
            <div key={r.id} className="rounded-lg border bg-muted/25 p-3">
              <div className="text-[12px] font-bold">{r.title}</div>
              <div className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{r.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* vault */}
      <div className="rounded-xl border bg-card p-5">
        <SectionTitle icon={BookOpen} sub={`${vault.length} most recent across the portfolio · every doc is searchable`}>Document vault</SectionTitle>
        <div className="grid gap-2.5 md:grid-cols-2">
          {vault.map(d => (
            <motion.div key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="group rounded-xl border p-3.5">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e0effe] text-[9px] font-bold text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]">{d.fileType.toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold">{d.fileName}</div>
                  <div className="text-[10px] text-muted-foreground">{fmtBytes(d.fileSize)} · {d.totalPages}p · {d.status} · {relTime(d.uploadedAt)}</div>
                </div>
                {userRole === "ADMIN" && <button onClick={() => { deleteDocument(d.project.id, d.id); toast.info("Document deleted", { description: "Soft-delete · search index purged · audit-logged" }); }} className="rounded-md border p-1.5 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="h-3 w-3 text-rose-500" /></button>}
              </div>
              {d.summary && <div className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{d.summary}</div>}
              <button onClick={() => openProject(d.project.id, "documents")} className="mt-2 flex items-center gap-1 text-[10.5px] font-semibold text-[#0c93e7] hover:underline dark:text-[#36adf6]">{d.project.psId} · {d.project.name.replace(/,.*$/, "")}<ArrowRight className="h-3 w-3" /></button>
            </motion.div>
          ))}
        </div>
        {vault.length === 0 && <EmptyState icon={BookOpen} title="Vault is empty" body="Ingest a report above — it will appear here with its extracted fields and enter the search index." />}
      </div>
    </div>
  );
}
