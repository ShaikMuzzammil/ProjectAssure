"use client";

import React, { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Project, DocumentItem } from "@/lib/projectassure/types";
import { STAGES, extractRawText, structureFields, makeDocument, fileKind } from "@/lib/projectassure/ocr";
import { useApp } from "@/store/app-store";
import { toast } from "sonner";
import { UploadCloud, FileText, ScanText, BrainCircuit, ShieldCheck, RefreshCw, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { bytes as fmtBytes } from "@/lib/projectassure/format";

const STAGE_ICONS = [UploadCloud, ScanText, BrainCircuit, ShieldCheck, RefreshCw];

export default function DocPipeline({ project, compact = false }: { project: Project; compact?: boolean }) {
  const ingestDocument = useApp(s => s.ingestDocument);
  const user = useApp(s => s.user)!;
  const [target, setTarget] = useState<Project>(project);
  const [stage, setStage] = useState(-1); // -1 idle, 0..4 running, 5 done
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<DocumentItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const pickFile = useCallback((f: File | null | undefined) => {
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { toast.error("File exceeds the 25 MB cap (MIME allowlist: PDF/XLSX/CSV/PNG/JPG)"); return; }
    setFile(f); setStage(-1); setResult(null);
  }, []);

  const run = async () => {
    if (!file) return;
    timers.current.forEach(clearTimeout); timers.current = [];
    setResult(null); setStage(0);
    const { text, simulated } = await extractRawText(file);
    STAGES.forEach((s, i) => {
      const t = setTimeout(() => {
        setStage(i);
        if (i === 4) {
          const { fields, findings, risks } = structureFields(text, target);
          const doc = makeDocument(target, file, text, simulated, fields, findings, risks);
          ingestDocument(target.id, doc);
          setResult(doc); setStage(5);
          const sec = (doc.processingMs ?? 5600) / 1000;
          toast.success(`Report processed in ${sec.toFixed(0)}s`, {
            description: `${fields.length} fields validated  · embeddings indexed · dashboard updated · audit-logged`,
          });
        }
      }, STAGES.slice(0, i).reduce((a, s2) => a + s2.ms, 0) + 200);
      timers.current.push(t);
    });
  };

  return (
    <div className="space-y-3.5">
      {!compact && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
          onClick={() => inputRef.current?.click()}
          className={cn("flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-9 text-center transition",
            dragOver ? "border-[#0c93e7] bg-[#e0effe]/50 dark:bg-[#0c93e7]/10" : "border-border hover:border-[#0c93e7]/50 hover:bg-muted/30")}
        >
          <input ref={inputRef} type="file" accept=".pdf,.xlsx,.csv,.png,.jpg,.jpeg,.txt" className="hidden" onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
          <motion.div animate={dragOver ? { y: -4, scale: 1.06 } : {}} className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]">
            <UploadCloud className="h-6 w-6" />
          </motion.div>
          <div className="mt-3 text-[13.5px] font-semibold">Drag & drop a field report — or click to browse</div>
          <div className="mt-1 text-[11.5px] text-muted-foreground">PDF · XLSX · CSV · PNG · JPG · TXT · up to 25 MB · TXT/CSV are parsed for real in-browser</div>
          {file && <div className="mt-3 flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-[11.5px] font-medium"><FileText className="h-3.5 w-3.5 text-[#0c93e7]" />{file.name}<span className="text-muted-foreground">· {fmtBytes(file.size)} · {fileKind(file.name).toUpperCase()}</span></div>}
        </div>
      )}

      {/* pipeline stages */}
      {stage >= 0 && (
        <div className="space-y-1.5 rounded-xl border bg-card p-3.5">
          <div className="pa-scanline rounded-lg">
            <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Ingestion pipeline</span>
              <span className={cn(stage === 5 && "text-emerald-600 dark:text-emerald-400")}>{stage === 5 ? "COMPLETE" : `stage ${stage + 1}/5`}</span>
            </div>
            {STAGES.map((s, i) => {
              const Icon = STAGE_ICONS[i];
              const state = i < stage ? "done" : i === stage ? "active" : "wait";
              return (
                <div key={s.id} className={cn("flex items-start gap-3 rounded-lg px-2.5 py-2 transition", state === "active" && "bg-[#e0effe]/60 dark:bg-[#0c93e7]/10", state === "done" && "opacity-80")}>
                  <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                    state === "done" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : state === "active" ? "bg-[#0c93e7] text-white" : "bg-muted text-muted-foreground")}>
                    {state === "done" ? <Check className="h-4 w-4" /> : state === "active" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold">{s.title}</div>
                    {state !== "wait" && <div className="text-[10.5px] leading-snug text-muted-foreground">{s.detail}</div>}
                  </div>
                  <div className="shrink-0 text-[9.5px] tabular text-muted-foreground">{(s.ms / 1000).toFixed(1)}s</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {file && stage < 0 && (
        <button onClick={run} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0b426e] to-[#0c93e7] py-3 text-[13.5px] font-semibold text-white shadow-sm transition hover:shadow-md">
          <UploadCloud className="h-4 w-4" />Ingest “{file.name.slice(0, 40)}” → read → extract → validate → sync
        </button>
      )}

      {/* result */}
      {result && stage === 5 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/5">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">PROCESSED</span>
            <span className="text-[12.5px] font-semibold">{result.fileName}</span>
            <span className="ml-auto text-[10.5px] tabular text-muted-foreground">{((result.processingMs ?? 5600) / 1000).toFixed(0)}s · read confidence {result.ocrConfidence}</span>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{result.summary}</p>
          {result.extractedData && (
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {result.extractedData.fields.map(f => (
                <div key={f.field} className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-[11px]">
                  <span className="font-mono text-[9.5px] text-muted-foreground">{f.field}</span>
                  <span className="ml-auto font-semibold">{f.value}</span>
                  <span className={cn("rounded px-1 text-[9px] font-bold tabular", f.confidence >= 0.9 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300")}>{f.confidence}</span>
                </div>
              ))}
            </div>
          )}
          {/* v8: every risk this document added to the live register, in full */}
          {result.extractedData && result.extractedData.risks.filter(r => !/^No material/.test(r)).length > 0 && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 dark:border-rose-500/25 dark:bg-rose-500/5">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">RISK SCAN</span>
                <span className="text-[12px] font-bold">{result.extractedData.risks.filter(r => !/^No material/.test(r)).length} risks detected — now on the live register</span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {result.extractedData.risks.filter(r => !/^No material/.test(r)).map((r, i) => (
                  <li key={i} className="text-[10.5px] leading-relaxed text-foreground/80">• {r}</li>
                ))}
              </ul>
              <div className="mt-2 text-[10px] text-muted-foreground">High-severity items also raised alerts · the prediction and risk register re-scored automatically · see the “Risk & Intelligence” tab.</div>
            </div>
          )}
          <div className="mt-2.5 text-[10.5px] text-muted-foreground">
            Sentiment: {result.extractedData?.sentiment.label} ({result.extractedData?.sentiment.score}) · key findings: {result.extractedData?.keyFindings[2] ?? "captured"} · vault & search index updated · uploaded by {user.name}
          </div>
        </motion.div>
      )}
    </div>
  );
}
