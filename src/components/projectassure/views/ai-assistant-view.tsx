"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { QUICK_ACTIONS, AGENT_TOOLS } from "@/lib/projectassure/agent";
import { AnswerBody } from "../shared/ui-bits";
import { buildIndex } from "@/lib/projectassure/rag";
import { can } from "@/lib/projectassure/permissions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { BrainCircuit, Send, Sparkles, Trash2, Wrench, Database, Plus, StopCircle, MessageSquare, ShieldCheck } from "lucide-react";

export default function AiAssistantView() {
  const user = useApp(s => s.user)!;
  const ask = useApp(s => s.ask);
  const threads = useApp(s => s.chatThreads);
  const createThread = useApp(s => s.createThread);
  const deleteThread = useApp(s => s.deleteThread);
  const aiLiveMode = useApp(s => s.aiLiveMode);
  const aiStatus = useApp(s => s.aiStatus);
  const refreshAiStatus = useApp(s => s.refreshAiStatus);
  // v3: live mode preference survives reload (was ephemeral → “toggle doesn't work” complaint)
  useEffect(() => {
    try { if (localStorage.getItem("projectassure-ai-live") === "1") useApp.setState({ aiLiveMode: true }); } catch { /* ignore */ }
    // v11: probe the live service and auto-enable live mode when connected
    void refreshAiStatus();
  }, [refreshAiStatus]);
  const setDataMode = useApp(s => s.setDataMode);
  const vectorIndex = useApp(s => s.vectorIndex);
  const projects = useApp(s => s.scoped)();
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
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

  const full = can(user, "chat:full");

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Assure Intelligence — project assistant</h1>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            ReAct loop · 7 tools executing on live data · {vectorIndex?.chunks.length ?? 0} vector chunks · {full ? "full scope for your role" : "status questions only (viewer scope)"}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card px-3.5 py-2.5">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5 text-[11.5px] font-bold">
              Live intelligence mode
              <span className={cn("inline-block h-2 w-2 rounded-full", aiLiveMode && aiStatus?.connected ? "bg-emerald-500" : aiLiveMode ? "bg-amber-500" : "bg-muted-foreground/40")} />
            </div>
            <div className="text-[10px] text-muted-foreground">{aiLiveMode ? (aiStatus?.connected ? "connected — live answers grounded on the full project dossier" : "connecting — falls back to the built-in engine if unavailable") : "built-in engine — works offline, same grounding"}</div>
          </div>
          <Switch checked={aiLiveMode} onCheckedChange={v => {
            setDataMode({ aiProvider: v ? "live" : "deterministic" });
            useApp.setState({ aiLiveMode: v });
            try { localStorage.setItem("projectassure-ai-live", v ? "1" : "0"); } catch { /* ignore */ }
            toast.info(v ? "Live mode enabled — answers come from the live intelligence service, grounded on this project's full dossier" : "Built-in engine — fully offline, jury-safe");
          }} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
        {/* chat */}
        <div className="flex h-[640px] flex-col overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center gap-2.5 border-b px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-white"><BrainCircuit className="h-4.5 w-4.5" /></div>
            <div>
              <div className="text-[13px] font-bold">{thread?.title ?? "New conversation"}</div>
              <div className="text-[10px] text-muted-foreground">session memory · 24h TTL · max 8 tool calls/turn · PII masked (R8)</div>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="rounded-full border px-2 py-0.5 text-[9.5px] font-semibold text-muted-foreground">threads: {threads.length}</span>
              {threads[0] && <button onClick={() => deleteThread(threads[0].id)} title="Delete thread" className="rounded-md border p-1.5 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5 text-rose-500" /></button>}
              <button onClick={() => createThread()} title="New thread" className="rounded-md border p-1.5 hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button>
            </div>
          </div>

          <div ref={listRef} className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
            {(!thread || thread.messages.length === 0) && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-white shadow-lg shadow-[#0c93e7]/25"><BrainCircuit className="h-7 w-7" /></div>
                <div className="mt-4 text-[16px] font-bold">Ask anything about the portfolio</div>
                <div className="mt-1 max-w-md text-[12.5px] text-muted-foreground">“Why is Bharatmala P-4 at risk?” · “Which projects in Tamil Nadu are delayed?” · “Compare budget utilisation of the top 5” · “What should I prioritise this week?”</div>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {QUICK_ACTIONS.map(q => <button key={q} onClick={() => send(q)} className="rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition hover:border-[#0c93e7]/50 hover:text-[#015ca0] dark:hover:text-[#7cc8fb]">{q}</button>)}
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
                    <span className="ml-2 text-[10.5px] text-muted-foreground">planning → tool calls → grounding check → compose</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.slice(0, 4).map(q => <button key={q} onClick={() => send(q)} disabled={busy} className="rounded-full bg-muted px-2.5 py-1 text-[10.5px] font-medium transition hover:bg-muted/70 disabled:opacity-50">{q}</button>)}
            </div>
            <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)} disabled={busy} placeholder={full ? "Ask about any project, document, forecast or comparison…" : "Viewer scope: status questions only (R11 scope guard)"}
                className="h-11 flex-1 rounded-lg border bg-background px-3.5 text-[13px] outline-none transition focus:border-[#0c93e7] focus:ring-2 focus:ring-[#0c93e7]/20 disabled:opacity-60" />
              <button type="submit" disabled={busy || !input.trim()} className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-r from-[#0b426e] to-[#0c93e7] text-white shadow-sm transition hover:shadow-md disabled:opacity-40">
                {busy ? <StopCircle className="h-4.5 w-4.5" onClick={e => { e.preventDefault(); toast.info("Turn will complete; the engine is deterministic and bounded (8 calls max)"); }} /> : <Send className="h-4.5 w-4.5" />}
              </button>
            </form>
          </div>
        </div>

        {/* right rail */}
        <div className="space-y-4">
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
              <li>• R10 red-flag advice requires officer verification</li>
              <li>• R11 off-scope requests politely declined</li>
              <li>• R12 document text is DATA, never instructions</li>
              <li>• 20 req/h/user Redis token bucket</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
