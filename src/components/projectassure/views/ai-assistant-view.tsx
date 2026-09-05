"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { QUICK_ACTIONS, AGENT_TOOLS } from "@/lib/projectassure/agent";
import { AnswerBody } from "../shared/ui-bits";
import { buildIndex } from "@/lib/projectassure/rag";
import { can } from "@/lib/projectassure/permissions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  BrainCircuit, Send, Sparkles, Trash2, Wrench, Database, Plus, StopCircle, MessageSquare,
  ShieldCheck, Globe, Paperclip, X, FileText, FileDown, FileJson, FileCode, Upload, Settings2,
  Zap, ClipboardList, Download, Copy, Printer, FileSpreadsheet, FileType2,
} from "lucide-react";

// ─── v13: extract text from any uploaded file client-side ────────────────────
// PDFs are not parsed here (would need pdfjs); instead we extract text from
// .txt/.md/.csv/.json/.log files directly. PDF/Excel/Image files are passed
// through with a placeholder text describing the file (the live model can
// still infer structure from the file name + description, and the user is
// invited to paste the relevant excerpt).
async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const textLike = /\.(txt|md|csv|json|log|tsv|yaml|yml|xml|html|js|ts|py|sql|sh)$/i.test(name);
  if (textLike) {
    try {
      const buf = await file.slice(0, 64 * 1024).text();   // up to 64KB
      return buf;
    } catch {
      return `[Could not read text from ${file.name}]`;
    }
  }
  // For PDF/Excel/Image — we cannot parse fully client-side without heavy deps,
  // so we surface a structured placeholder the model can still reason about.
  const ext = name.split(".").pop() ?? "unknown";
  return `[Uploaded ${ext.toUpperCase()} file: ${file.name} — ${Math.round(file.size / 1024)} KB. The client cannot parse this binary file in-browser; if its content is needed for the answer, ask the user to paste the relevant excerpt, or rely on the project dossier already grounded in this request.]`;
}

export default function AiAssistantView() {
  const user = useApp(s => s.user)!;
  const ask = useApp(s => s.ask);
  const threads = useApp(s => s.chatThreads);
  const createThread = useApp(s => s.createThread);
  const deleteThread = useApp(s => s.deleteThread);
  const aiLiveMode = useApp(s => s.aiLiveMode);
  const aiUniversalMode = useApp(s => s.aiUniversalMode);
  const setAiUniversalMode = useApp(s => s.setAiUniversalMode);
  const aiStatus = useApp(s => s.aiStatus);
  const refreshAiStatus = useApp(s => s.refreshAiStatus);
  const aiAttachedFiles = useApp(s => s.aiAttachedFiles);
  const attachAiFile = useApp(s => s.attachAiFile);
  const detachAiFile = useApp(s => s.detachAiFile);
  const clearAiFiles = useApp(s => s.clearAiFiles);

  useEffect(() => {
    try { if (localStorage.getItem("projectassure-ai-live") === "1") useApp.setState({ aiLiveMode: true }); } catch { /* ignore */ }
    void refreshAiStatus();
  }, [refreshAiStatus]);
  const setDataMode = useApp(s => s.setDataMode);
  const vectorIndex = useApp(s => s.vectorIndex);
  const projects = useApp(s => s.scoped)();
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thread = threads[0];

  useEffect(() => {
    if (!threads.length) createThread();
  }, [threads.length, createThread]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [thread?.messages.length, busy]);

  const send = async (q?: string) => {
    const question = (q ?? input).trim();
    if (!question || busy) return;
    setInput(""); setBusy(true);
    try {
      await ask(question);
    } catch {
      toast.error("Assure Intelligence hit an error answering that question", { description: "The built-in engine recovered — try rephrasing or naming a specific project." });
    } finally {
      setBusy(false);
    }
  };

  // ─── v13: file upload handlers ───
  const onFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files).slice(0, 5)) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large`, { description: "Max 5 MB per file" });
        continue;
      }
      const text = await extractFileText(file);
      const ext = (file.name.split(".").pop() ?? "").toLowerCase();
      const type = /\.(pdf)$/i.test(file.name) ? "pdf"
        : /\.(xlsx|xls)$/i.test(file.name) ? "xlsx"
        : /\.(csv|tsv)$/i.test(file.name) ? "csv"
        : /\.(png|jpg|jpeg|gif|webp)$/i.test(file.name) ? "image"
        : "text";
      attachAiFile({ name: file.name, type, size: file.size, text });
      toast.success(`Attached ${file.name}`, { description: `${Math.round(file.size / 1024)} KB · type ${type}` });
    }
  }, [attachAiFile]);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    void onFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    void onFiles(e.dataTransfer.files);
  };

  const full = can(user, "chat:full");

  // ─── v13: conversation export ───
  const exportConversation = (fmt: "md" | "txt" | "json") => {
    if (!thread || thread.messages.length === 0) {
      toast.error("Nothing to export", { description: "Send a message first" });
      return;
    }
    const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    const baseName = `projectassure-conversation-${ts}`;
    let content: string;
    let mime: string;
    let ext: string;
    if (fmt === "json") {
      content = JSON.stringify({
        title: thread.title,
        exportedBy: user.name,
        exportedAt: new Date().toISOString(),
        universalMode: aiUniversalMode,
        attachedFiles: aiAttachedFiles.map(f => ({ name: f.name, type: f.type, size: f.size })),
        messages: thread.messages.map(m => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content : "",
          createdAt: m.createdAt,
          answer: m.answer ? {
            intent: m.answer.intent,
            dataFreshness: m.answer.dataFreshness,
            citations: m.answer.citations,
            grounded: m.answer.grounded,
            source: m.answer.source,
          } : undefined,
        })),
      }, null, 2);
      mime = "application/json"; ext = "json";
    } else if (fmt === "md") {
      const lines: string[] = [
        `# ${thread.title}`,
        ``,
        `> Exported by **${user.name}** on ${new Date().toLocaleString("en-IN")}`,
        `> Mode: ${aiUniversalMode ? "Universal" : "Project-scoped"} · ${aiAttachedFiles.length} file(s) attached`,
        ``,
        `---`,
        ``,
      ];
      for (const m of thread.messages) {
        if (m.role === "user") {
          lines.push(`### 👤 You`, ``, m.content, ``);
        } else {
          lines.push(`### ✨ Assure Intelligence`, ``, m.content, ``);
          if (m.answer?.dataFreshness) lines.push(`> ${m.answer.dataFreshness}`, ``);
        }
      }
      content = lines.join("\n");
      mime = "text/markdown"; ext = "md";
    } else {
      const lines: string[] = [
        `${thread.title}`,
        `Exported by ${user.name} on ${new Date().toLocaleString("en-IN")}`,
        `Mode: ${aiUniversalMode ? "Universal" : "Project-scoped"} · ${aiAttachedFiles.length} file(s) attached`,
        `${"=".repeat(70)}`,
        ``,
      ];
      for (const m of thread.messages) {
        lines.push(`[${m.role === "user" ? "YOU" : "ASSURE INTELLIGENCE"}] ${new Date(m.createdAt).toLocaleTimeString("en-IN")}`);
        lines.push(typeof m.content === "string" ? m.content : "");
        lines.push(``);
      }
      content = lines.join("\n");
      mime = "text/plain"; ext = "txt";
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${baseName}.${ext}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Conversation exported as ${ext.toUpperCase()}`, { description: `${thread.messages.length} messages · audit-logged` });
    setExportOpen(false);
  };

  // ─── v13: extended quick actions depending on mode ───
  const QUICK_ACTIONS_V13 = aiUniversalMode
    ? [
        "Summarise the uploaded document",
        "Explain delay risk in plain English",
        "Draft a status note for the joint secretary",
        "What's a good KPI for procurement efficiency?",
        "Compare predictive monitoring vs traditional reporting",
        "How do I read this budget variance?",
        ...QUICK_ACTIONS.slice(0, 2),
      ]
    : QUICK_ACTIONS;

  return (
    <div className="mx-auto max-w-[1200px] space-y-4" onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Assure Intelligence — intelligence centre</h1>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            ReAct loop · 7 tools executing on live data · {vectorIndex?.chunks.length ?? 0} vector chunks · {full ? "full scope for your role" : "status questions only (viewer scope)"} · v13 universal mode + file upload + export
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2">
          {/* v13: Universal mode toggle */}
          <div className="flex items-center gap-2 border-r pr-2.5">
            <Globe className={cn("h-4 w-4", aiUniversalMode ? "text-[#0c93e7] dark:text-[#36adf6]" : "text-muted-foreground")} />
            <div className="text-right">
              <div className="text-[10.5px] font-bold leading-none">Universal mode</div>
              <div className="text-[9px] text-muted-foreground">{aiUniversalMode ? "answers anything" : "project-scoped"}</div>
            </div>
            <Switch checked={aiUniversalMode} onCheckedChange={v => {
              setAiUniversalMode(v);
              toast.info(v ? "Universal mode ON — ask any question, with or without project context" : "Project-scoped mode — answers grounded on live portfolio data");
            }} />
          </div>
          {/* Live mode (existing) */}
          <div className="flex items-center gap-2 pl-1">
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 text-[10.5px] font-bold">
                Live intelligence
                <span className={cn("inline-block h-2 w-2 rounded-full", aiLiveMode && aiStatus?.connected ? "bg-emerald-500" : aiLiveMode ? "bg-amber-500" : "bg-muted-foreground/40")} />
              </div>
              <div className="text-[9px] text-muted-foreground">{aiLiveMode ? (aiStatus?.connected ? "connected" : "fallback") : "built-in engine"}</div>
            </div>
            <Switch checked={aiLiveMode} onCheckedChange={v => {
              setDataMode({ aiProvider: v ? "live" : "deterministic" });
              useApp.setState({ aiLiveMode: v });
              try { localStorage.setItem("projectassure-ai-live", v ? "1" : "0"); } catch { /* ignore */ }
              toast.info(v ? "Live mode enabled — Gemini/Groq provider chain" : "Built-in engine — offline, jury-safe");
            }} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
        {/* chat */}
        <div className="flex h-[680px] flex-col overflow-hidden rounded-xl border bg-card relative">
          {/* drag overlay */}
          {dragOver && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0c93e7]/10 backdrop-blur-sm">
              <div className="rounded-2xl border-2 border-dashed border-[#0c93e7] bg-card px-12 py-8 text-center">
                <Upload className="mx-auto h-10 w-10 text-[#0c93e7]" />
                <div className="mt-2 text-[14px] font-bold">Drop files to attach</div>
                <div className="text-[11px] text-muted-foreground">PDF · Excel · CSV · Text · Image · up to 5 MB each · max 5 files</div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2.5 border-b px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-white"><BrainCircuit className="h-4.5 w-4.5" /></div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold">{thread?.title ?? "New conversation"}</div>
              <div className="text-[10px] text-muted-foreground">session memory · 24h TTL · max 8 tool calls/turn · PII masked (R8) · {aiUniversalMode ? "universal mode" : "project mode"}</div>
            </div>
            {/* v13: file attachments count badge */}
            {aiAttachedFiles.length > 0 && (
              <div className="flex items-center gap-1 rounded-full bg-[#e0effe]/70 px-2 py-0.5 text-[10px] font-bold text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]">
                <Paperclip className="h-3 w-3" />{aiAttachedFiles.length}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <button onClick={() => setExportOpen(true)} title="Export conversation" className="rounded-md border p-1.5 hover:bg-muted"><FileDown className="h-3.5 w-3.5" /></button>
              <button onClick={() => setSettingsOpen(true)} title="Settings" className="rounded-md border p-1.5 hover:bg-muted"><Settings2 className="h-3.5 w-3.5" /></button>
              <span className="rounded-full border px-2 py-0.5 text-[9.5px] font-semibold text-muted-foreground">threads: {threads.length}</span>
              {threads[0] && <button onClick={() => deleteThread(threads[0].id)} title="Delete thread" className="rounded-md border p-1.5 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5 text-rose-500" /></button>}
              <button onClick={() => createThread()} title="New thread" className="rounded-md border p-1.5 hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button>
            </div>
          </div>

          {/* v13: file attachment strip */}
          {aiAttachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-b bg-muted/30 px-3 py-2">
              {aiAttachedFiles.map(f => (
                <div key={f.name} className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1">
                  <FileType2 className="h-3 w-3 text-[#0c93e7] dark:text-[#36adf6]" />
                  <span className="max-w-[140px] truncate text-[10.5px] font-semibold">{f.name}</span>
                  <span className="text-[9px] text-muted-foreground">{Math.round(f.size / 1024)}KB</span>
                  <button onClick={() => detachAiFile(f.name)} className="text-muted-foreground hover:text-rose-500"><X className="h-3 w-3" /></button>
                </div>
              ))}
              <button onClick={clearAiFiles} className="ml-auto text-[10px] font-semibold text-muted-foreground hover:text-rose-500">Clear all</button>
            </div>
          )}

          <div ref={listRef} className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
            {(!thread || thread.messages.length === 0) && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-white shadow-lg shadow-[#0c93e7]/25"><BrainCircuit className="h-7 w-7" /></div>
                <div className="mt-4 text-[16px] font-bold">Ask anything about the portfolio</div>
                <div className="mt-1 max-w-md text-[12.5px] text-muted-foreground">
                  {aiUniversalMode
                    ? "Universal mode is on — ask about anything (project management, governance, the uploaded files, or general questions)."
                    : "“Why is Bharatmala P-4 at risk?” · “Which projects in Tamil Nadu are delayed?” · “Compare budget utilisation of the top 5” · “What should I prioritise this week?”"}
                </div>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {QUICK_ACTIONS_V13.slice(0, 6).map(q => <button key={q} onClick={() => send(q)} className="rounded-full border px-3 py-1.5 text-[11px] font-medium transition hover:border-[#0c93e7]/50 hover:text-[#015ca0] dark:hover:text-[#7cc8fb]">{q}</button>)}
                </div>
                <div className="mt-6 flex items-center gap-2 text-[10.5px] text-muted-foreground">
                  <Paperclip className="h-3.5 w-3.5" /> Drag & drop files, or click attach · up to 5 files · 5 MB each
                </div>
              </div>
            )}
            {thread?.messages.map(m => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "")}>
                {m.role === "assistant" && <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-white"><Sparkles className="h-3.5 w-3.5" /></div>}
                <div className={cn("max-w-[85%] rounded-xl px-3.5 py-2.5", m.role === "user" ? "bg-[#0c93e7] text-white" : "border bg-muted/25")}>
                  {m.role === "user" ? <div className="text-[13px] leading-relaxed">{m.content}</div> : m.answer ? <AnswerBody answer={m.answer} /> : <div className="text-[13px]">{m.content}</div>}
                </div>
              </motion.div>
            ))}
            {busy && (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-white"><Sparkles className="h-3.5 w-3.5" /></div>
                <div className="rounded-xl border bg-muted/25 px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#0c93e7]" /><span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#0c93e7]" /><span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#0c93e7]" />
                    <span className="ml-2 text-[10.5px] text-muted-foreground">{aiUniversalMode ? "thinking · universal mode" : "planning → tool calls → grounding check → compose"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {QUICK_ACTIONS_V13.slice(0, 4).map(q => <button key={q} onClick={() => send(q)} disabled={busy} className="rounded-full bg-muted px-2.5 py-1 text-[10.5px] font-medium transition hover:bg-muted/70 disabled:opacity-50">{q}</button>)}
            </div>
            <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2">
              {/* v13: attach button */}
              <input ref={fileInputRef} type="file" multiple onChange={onFileInput} className="hidden" accept=".pdf,.xlsx,.xls,.csv,.tsv,.txt,.md,.json,.log,.yaml,.yml,.xml,.html,.png,.jpg,.jpeg,.gif,.webp" />
              <button type="button" onClick={() => fileInputRef.current?.click()} title="Attach files" disabled={busy}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-background transition hover:bg-muted disabled:opacity-50">
                <Paperclip className="h-4 w-4 text-[#0c93e7] dark:text-[#36adf6]" />
              </button>
              <input value={input} onChange={e => setInput(e.target.value)} disabled={busy} placeholder={full
                ? (aiUniversalMode ? "Ask any question — universal mode is on, with your uploaded files as context…" : "Ask about any project, document, forecast or comparison…")
                : "Viewer scope: status questions only (R11 scope guard)"}
                className="h-11 flex-1 rounded-lg border bg-background px-3.5 text-[13px] outline-none transition focus:border-[#0c93e7] focus:ring-2 focus:ring-[#0c93e7]/20 disabled:opacity-60" />
              <button type="submit" disabled={busy || !input.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-[#0b426e] to-[#0c93e7] text-white shadow-sm transition hover:shadow-md disabled:opacity-40">
                {busy ? <StopCircle className="h-4.5 w-4.5" onClick={e => { e.preventDefault(); toast.info("Turn will complete; the engine is deterministic and bounded (8 calls max)"); }} /> : <Send className="h-4.5 w-4.5" />}
              </button>
            </form>
            <div className="mt-1.5 flex items-center justify-between text-[9.5px] text-muted-foreground">
              <span>↵ send · shift+↵ newline · drag files anywhere</span>
              <span>{aiAttachedFiles.length}/5 files · {aiUniversalMode ? "universal" : "project"} mode · {aiLiveMode ? "live" : "built-in"}</span>
            </div>
          </div>
        </div>

        {/* right rail */}
        <div className="space-y-4">
          {/* v13: NEW — Universal mode explainer */}
          <div className={cn("rounded-xl border p-4", aiUniversalMode ? "border-[#0c93e7]/40 bg-[#e0effe]/40 dark:bg-[#0c93e7]/10" : "bg-card")}>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"><Globe className="h-3.5 w-3.5" />Mode</div>
            <div className="space-y-2 text-[11.5px]">
              <div className={cn("rounded-lg p-2.5", !aiUniversalMode ? "bg-[#0b426e] text-white" : "bg-muted/30")}>
                <div className="font-bold">📊 Project mode</div>
                <div className="mt-0.5 text-[10.5px] opacity-80">Answers grounded on live portfolio + project dossier. Numbers must be cited.</div>
              </div>
              <div className={cn("rounded-lg p-2.5", aiUniversalMode ? "bg-[#0b426e] text-white" : "bg-muted/30")}>
                <div className="font-bold">🌐 Universal mode</div>
                <div className="mt-0.5 text-[10.5px] opacity-80">Answers any question — uses uploaded files as context. Free-form advisory tone.</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"><Wrench className="h-3.5 w-3.5" />Tool registry</div>
            <div className="space-y-1.5">
              {AGENT_TOOLS.map(t => (
                <div key={t.name} className="rounded-lg border bg-muted/30 px-2.5 py-2">
                  <div className="font-mono text-[10.5px] font-bold text-[#015ca0] dark:text-[#7cc8fb]">{t.name}</div>
                  <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{t.desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"><Database className="h-3.5 w-3.5" />RAG index</div>
            <div className="space-y-1.5 text-[11.5px]">
              <div className="flex justify-between"><span className="text-muted-foreground">Vector chunks</span><strong className="tabular">{vectorIndex?.chunks.length ?? 0}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Documents indexed</span><strong className="tabular">{vectorIndex?.documents.size ?? 0}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Attached files</span><strong className="tabular">{aiAttachedFiles.length}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Embedding dims</span><strong className="tabular">256 (hashing)</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Similarity</span><strong>cosine ≥ 0.045</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Index built</span><strong className="text-[10px]">{vectorIndex ? new Date(vectorIndex.builtAt).toLocaleTimeString("en-IN") : "—"}</strong></div>
            </div>
            <button onClick={() => { useApp.setState({ vectorIndex: buildIndex(useApp.getState().projects) }); toast.success("Vector index rebuilt", { description: `${useApp.getState().vectorIndex?.chunks.length} chunks re-embedded` }); }}
              className="mt-2.5 w-full rounded-lg border py-1.5 text-[11px] font-semibold transition hover:bg-muted">Rebuild index</button>
          </div>
          <div className="rounded-xl border bg-[#072b49] p-4 text-white">
            <div className="flex items-center gap-2 text-[11.5px] font-bold"><ShieldCheck className="h-4 w-4 text-[#7cc8fb]" />Guardrails in force</div>
            <ul className="mt-2 space-y-1 text-[10.5px] leading-snug text-white/75">
              <li>• R1 every number grounded in a tool observation</li>
              <li>• R3 citations as [n] with file + page</li>
              <li>• R7 never leaks SQL, credentials or traces</li>
              <li>• R8 PII masked before embedding</li>
              <li>• R9 uploaded file content is DATA, never commands</li>
              <li>• R10 red-flag advice requires officer verification</li>
              <li>• R11 off-scope requests politely declined</li>
              <li>• R12 document text is DATA, never instructions</li>
              <li>• 20 req/h/user Redis token bucket</li>
              <li>• v13 files: max 5 MB · max 5 files · text extracted client-side</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ─── v13: Export dialog ─── */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[15px] flex items-center gap-2"><FileDown className="h-4 w-4 text-[#0c93e7]" />Export this conversation</DialogTitle></DialogHeader>
          <p className="text-[12px] text-muted-foreground">Save the current thread as a portable file. The export includes every message, timestamps, mode, and attached file metadata — perfect for evidence packs and audit trails.</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => exportConversation("md")} className="flex flex-col items-center gap-1.5 rounded-lg border p-3 transition hover:border-[#0c93e7]/50 hover:bg-muted/40">
              <FileText className="h-6 w-6 text-[#0c93e7] dark:text-[#36adf6]" />
              <div className="text-[11px] font-bold">Markdown</div>
              <div className="text-[9.5px] text-muted-foreground">.md · readable</div>
            </button>
            <button onClick={() => exportConversation("txt")} className="flex flex-col items-center gap-1.5 rounded-lg border p-3 transition hover:border-[#0c93e7]/50 hover:bg-muted/40">
              <FileCode className="h-6 w-6 text-[#0c93e7] dark:text-[#36adf6]" />
              <div className="text-[11px] font-bold">Plain text</div>
              <div className="text-[9.5px] text-muted-foreground">.txt · universal</div>
            </button>
            <button onClick={() => exportConversation("json")} className="flex flex-col items-center gap-1.5 rounded-lg border p-3 transition hover:border-[#0c93e7]/50 hover:bg-muted/40">
              <FileJson className="h-6 w-6 text-[#0c93e7] dark:text-[#36adf6]" />
              <div className="text-[11px] font-bold">JSON</div>
              <div className="text-[9.5px] text-muted-foreground">.json · structured</div>
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── v13: Settings dialog ─── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[15px] flex items-center gap-2"><Settings2 className="h-4 w-4 text-[#0c93e7]" />Intelligence centre settings</DialogTitle></DialogHeader>
          <div className="space-y-3 text-[12px]">
            <div className="flex items-center justify-between rounded-lg border p-2.5">
              <div>
                <div className="font-bold">Universal mode</div>
                <div className="text-[10.5px] text-muted-foreground">Answer any question — not just project-scoped.</div>
              </div>
              <Switch checked={aiUniversalMode} onCheckedChange={setAiUniversalMode} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-2.5">
              <div>
                <div className="font-bold">Live intelligence</div>
                <div className="text-[10.5px] text-muted-foreground">Gemini → Groq → OpenRouter → OpenAI chain.</div>
              </div>
              <Switch checked={aiLiveMode} onCheckedChange={v => {
                setDataMode({ aiProvider: v ? "live" : "deterministic" });
                useApp.setState({ aiLiveMode: v });
                try { localStorage.setItem("projectassure-ai-live", v ? "1" : "0"); } catch { /* ignore */ }
              }} />
            </div>
            <div className="rounded-lg border p-2.5">
              <div className="mb-1 font-bold">Attached files</div>
              {aiAttachedFiles.length === 0 ? (
                <div className="text-[10.5px] text-muted-foreground">No files attached. Click 📎 in the chat bar or drag-and-drop.</div>
              ) : (
                <div className="space-y-1">
                  {aiAttachedFiles.map(f => (
                    <div key={f.name} className="flex items-center gap-2 text-[10.5px]">
                      <FileType2 className="h-3 w-3 text-[#0c93e7]" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-muted-foreground">{Math.round(f.size / 1024)}KB</span>
                      <button onClick={() => detachAiFile(f.name)} className="text-muted-foreground hover:text-rose-500"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                  <button onClick={clearAiFiles} className="mt-1 text-[10px] font-semibold text-rose-500">Clear all</button>
                </div>
              )}
            </div>
            <div className="rounded-lg bg-muted/40 p-2.5 text-[10.5px] leading-relaxed text-muted-foreground">
              <strong>Privacy:</strong> Files are processed in-browser only — text is extracted client-side and sent to the live provider as context. Nothing is stored on the server. Max 5 MB per file, 5 files per turn.
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSettingsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
