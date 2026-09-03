"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2, Cpu, FileScan, FileText, Loader2, Sparkles, UploadCloud,
} from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { timeAgo } from "@/lib/projectassure/format";
import { SectionTitle } from "../shared/ui-bits";
import { toast } from "sonner";

const STAGES = [
  { key: "upload", label: "Upload received", detail: "Vercel Blob · 10 MB cap · pdf/xlsx/png/jpg", icon: UploadCloud, ms: 900 },
  { key: "ocr", label: "OCR text extraction", detail: "Tesseract eng+hin · pdfplumber + PyMuPDF", icon: FileScan, ms: 1600 },
  { key: "genai", label: "GenAI structuring", detail: "GPT-4o extraction → Zod validation", icon: Sparkles, ms: 1900 },
  { key: "sync", label: "Dashboard auto-update", detail: "Health recompute + embeddings → vector index", icon: Cpu, ms: 1200 },
];

interface UploadState { fileName: string; stage: number; done: boolean; projectId: string; }

export function ReportsView() {
  const projects = useAppStore((s) => s.projects);
  const openProject = useAppStore((s) => s.openProject);
  const [dragOver, setDragOver] = useState(false);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [targetProject, setTargetProject] = useState(projects.find((p) => p.healthStatus !== "HEALTHY")?.id ?? projects[0]?.id ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const startPipeline = useCallback((fileName: string) => {
    timers.current.forEach(clearTimeout);
    const st: UploadState = { fileName, stage: 0, done: false, projectId: targetProject };
    setUpload(st);
    let acc = 0;
    STAGES.forEach((s, i) => {
      acc += s.ms;
      timers.current.push(setTimeout(() => {
        setUpload((u) => (u ? { ...u, stage: i + 1 } : u));
        if (i === STAGES.length - 1) {
          setUpload((u) => (u ? { ...u, done: true } : u));
          toast.success("Report processed in <60s", { description: `${fileName} → fields auto-populated, health recomputed, summary generated` });
        }
      }, acc));
    });
  }, [targetProject]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    startPipeline(f?.name ?? "MPR-September-Bharatmala-P4.pdf");
  }, [startPipeline]);

  const target = projects.find((p) => p.id === targetProject);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports & Document Intelligence</h1>
        <p className="text-sm text-muted-foreground">Paper to platform in &lt;60 seconds · OCR + GenAI extraction · zero manual data entry</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        {/* upload zone */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <SectionTitle
            title="Upload a monitoring report"
            sub="Simulates the full ingestion pipeline"
            right={
              <select value={targetProject} onChange={(e) => setTargetProject(e.target.value)} className="max-w-[220px] rounded-md border border-input bg-background px-2 py-1.5 text-xs">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            }
          />
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-all ${dragOver ? "border-[#0c93e7] bg-[#f0f7ff] dark:bg-[#064f85]/15" : "border-border hover:border-[#0c93e7]/60 hover:bg-muted/40"}`}
          >
            <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform ${dragOver ? "scale-110" : ""} bg-[#0c93e7]/10 text-[#0c93e7]`}>
              <UploadCloud className="h-7 w-7" />
            </div>
            <p className="font-semibold">Drop a PDF / Excel / scanned report here</p>
            <p className="mt-1 text-xs text-muted-foreground">or click to browse · any file works in the demo (nothing leaves your device)</p>
            <input
              ref={fileRef} type="file" className="hidden" accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg"
              onChange={(e) => startPipeline(e.target.files?.[0]?.name ?? "Monthly-Progress-Report.pdf")}
            />
            <button
              onClick={(e) => { e.stopPropagation(); startPipeline("MPR-September-Bharatmala-P4.pdf"); }}
              className="mt-4 rounded-md bg-[#0c93e7] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#0b426e]"
            >
              Or simulate a 15-page scanned PDF
            </button>
          </div>

          {/* pipeline */}
          {upload && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-[#dc2626]" />{upload.fileName}</p>
                {upload.done
                  ? <span className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-bold text-[#15803d] dark:bg-green-500/15 dark:text-green-300"><CheckCircle2 className="h-3 w-3" />PROCESSED</span>
                  : <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0c93e7]"><Loader2 className="h-3 w-3 animate-spin" />PROCESSING</span>}
              </div>
              <div className="space-y-2.5">
                {STAGES.map((s, i) => {
                  const done = upload.stage > i;
                  const active = upload.stage === i && !upload.done;
                  return (
                    <div key={s.key} className={`flex items-center gap-3 rounded-md border p-2.5 transition-all ${done ? "border-[#22c55e]/50 bg-[#dcfce7]/40 dark:bg-green-500/5" : active ? "border-[#bae0fd] bg-[#f0f7ff]" : "border-border opacity-50"}`}>
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${done ? "bg-[#22c55e] text-white" : active ? "bg-[#0c93e7] text-white" : "bg-muted text-muted-foreground"}`}>
                        {done ? <CheckCircle2 className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : <s.icon className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold">{s.label}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{s.detail}</p>
                      </div>
                      {done && <span className="text-[10px] font-bold text-[#16a34a]">✓ {Math.round(s.ms / 100) / 10}s</span>}
                    </div>
                  );
                })}
              </div>
              {upload.done && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 rounded-md bg-muted/60 p-3 text-xs leading-relaxed">
                  <p className="font-semibold text-[#0c93e7]">🤖 GPT-4o summary</p>
                  <p className="mt-1 text-muted-foreground">
                    Progress figures reconciled with dashboard within ±2%. 3 cost lines flagged for review (steel +12% MoM). No contractual deviations detected. 27 fields auto-populated from 15 pages — physical progress updated to dashboard, health score recomputed.
                  </p>
                  <button onClick={() => openProject(upload.projectId)} className="mt-2 rounded-md bg-[#0c93e7] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#0b426e]">
                    View updated project → {target?.name.split(" ").slice(0, 2).join(" ")}
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </div>

        {/* processed library */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <SectionTitle title="Document vault" sub={`${projects.flatMap((p) => p.documents).length} processed documents indexed (RAG-ready)`} />
          <div className="mt-3 max-h-[480px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {projects.flatMap((p) => p.documents.map((d) => ({ ...d, projectName: p.name, pid: p.id })))
              .sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))
              .slice(0, 12)
              .map((d) => (
                <button key={d.id} onClick={() => openProject(d.pid, "documents")} className="block w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-2 text-xs font-semibold"><FileText className="h-3.5 w-3.5 shrink-0 text-[#dc2626]" /><span className="truncate">{d.fileName}</span></p>
                    <span className="shrink-0 rounded-full bg-[#dcfce7] px-1.5 py-0.5 text-[9px] font-bold text-[#15803d] dark:bg-green-500/15 dark:text-green-300">PROCESSED</span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">{d.projectName} · {Math.round(d.fileSize / 1024)} KB · {timeAgo(d.uploadedAt)}</p>
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
