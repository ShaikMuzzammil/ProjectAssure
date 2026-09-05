"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { QUICK_ACTIONS } from "@/lib/projectassure/agent";
import { AnswerBody } from "./ui-bits";
import { Sparkles, Send, X, BrainCircuit, Minus, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AiChatPanel() {
  const aiOpen = useApp(s => s.aiOpen);
  const setAiOpen = useApp(s => s.setAiOpen);
  const ask = useApp(s => s.ask);
  const aiLiveMode = useApp(s => s.aiLiveMode);
  const aiStatus = useApp(s => s.aiStatus);
  const refreshAiStatus = useApp(s => s.refreshAiStatus);
  const aiSeedQuestion = useApp(s => s.aiSeedQuestion);
  const clearAiSeed = useApp(s => s.clearAiSeed);
  const aiContextProjectId = useApp(s => s.aiContextProjectId);
  const setAiContext = useApp(s => s.setAiContext);
  const ctxProject = useApp(s => s.aiContextProjectId ? s.projects.find(p => p.id === s.aiContextProjectId) : undefined);
  const threads = useApp(s => s.chatThreads);
  const thread = threads[0];
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const run = useCallback(async (q: string) => {
    if (!q.trim() || busy) return;
    setBusy(true);
    try {
      await ask(q);
    } catch {
      // never leave the panel stuck busy (the “AI not working” symptom)
    } finally {
      setBusy(false);
    }
  }, [ask, busy, clearAiSeed]);

  useEffect(() => {
    if (aiSeedQuestion && aiOpen) {
      const t = setTimeout(() => { void run(aiSeedQuestion).finally(() => clearAiSeed()); }, 80);
      return () => clearTimeout(t);
    }
  }, [aiSeedQuestion, aiOpen, run, clearAiSeed]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [thread?.messages.length, busy]);

  // v11: make sure the panel knows whether the live service is connected
  useEffect(() => { if (aiOpen) void refreshAiStatus(); }, [aiOpen, refreshAiStatus]);

  return (
    <AnimatePresence>
      {aiOpen && (
        <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l bg-background/97 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-2.5 border-b px-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-white"><BrainCircuit className="h-4.5 w-4.5" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[13px] font-bold">
                Assure Intelligence
                {aiLiveMode && (
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8.5px] font-bold", aiStatus?.connected ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400")}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", aiStatus?.connected ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
                    {aiStatus?.connected ? "LIVE" : "CONNECTING"}
                  </span>
                )}
              </div>
              <div className="text-[9.5px] text-muted-foreground">{aiLiveMode ? (aiStatus?.connected ? "live service · grounded on the full project dossier" : "live service · auto-fallback to built-in engine") : "built-in engine · cited · grounded · transparent"}</div>
            </div>
            <button onClick={() => setAiOpen(false)} className="rounded-md border p-1.5 transition hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
          </div>

          {ctxProject && (
            <div className="flex items-center gap-2 border-b bg-[#0c93e7]/10 px-4 py-2 dark:bg-[#0c93e7]/15">
              <Target className="h-3.5 w-3.5 shrink-0 text-[#0c93e7]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11.5px] font-semibold">Scoped to: {ctxProject.name}</div>
                <div className="text-[9.5px] text-muted-foreground">Answers and recommendations are for THIS project · {ctxProject.psId}</div>
              </div>
              <button onClick={() => setAiContext(null)} title="Remove project scope" className="rounded-md border p-1 transition hover:bg-muted"><X className="h-3 w-3" /></button>
            </div>
          )}

          <div ref={listRef} className="custom-scrollbar flex-1 space-y-3.5 overflow-y-auto p-4">
            {(!thread || thread.messages.length === 0) && (
              <div className="pt-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-white shadow-lg"><Sparkles className="h-6 w-6" /></div>
                <div className="mt-3 text-[14px] font-bold">{ctxProject ? `Ask anything about ${ctxProject.name.replace(/,.*$/, "")}` : "Grounded answers, cited sources"}</div>
                <div className="mt-1 text-[11.5px] text-muted-foreground">{ctxProject ? "You'll get the full Intelligence recommended system: actions, root causes, KPIs and the cost of doing nothing." : "Every number comes from a live tool call over portfolio data."}</div>
                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                  {(ctxProject
                    ? ["Give me the recommended action plan", "Why is this project in its current band?", "What happens if we do nothing?", "Draft a status report for this project"]
                    : QUICK_ACTIONS.slice(0, 4)
                  ).map(q => <button key={q} onClick={() => run(q)} className="rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition hover:border-[#0c93e7]/50">{q}</button>)}
                </div>
              </div>
            )}
            {thread?.messages.slice(-8).map(m => (
              <div key={m.id} className={cn("flex gap-2.5", m.role === "user" && "justify-end")}>
                {m.role === "assistant" && <div className="mt-0.5 flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-white"><Sparkles className="h-3 w-3" /></div>}
                <div className={cn("max-w-[88%] rounded-xl px-3 py-2", m.role === "user" ? "bg-[#0c93e7] text-white" : "border bg-muted/25")}>
                  {m.role === "user"
                    ? <div className="text-[12.5px] leading-relaxed">{m.content}</div>
                    : m.answer ? <AnswerBody answer={m.answer} /> : <div className="text-[12.5px]">{m.content}</div>}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex gap-2.5">
                <div className="mt-0.5 flex h-6.5 w-6.5 items-center justify-center rounded-lg bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-white"><Sparkles className="h-3 w-3" /></div>
                <div className="rounded-xl border bg-muted/25 px-3.5 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#0c93e7]" /><span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#0c93e7]" /><span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#0c93e7]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t p-3">
            <form onSubmit={e => { e.preventDefault(); run(input); setInput(""); }} className="flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)} disabled={busy} placeholder={ctxProject ? `Ask about ${ctxProject.name.replace(/,.*$/, "")}…` : "Ask about any project…"}
                className="h-10 flex-1 rounded-lg border bg-background px-3 text-[12.5px] outline-none transition focus:border-[#0c93e7] disabled:opacity-60" />
              <button type="submit" disabled={busy || !input.trim()} className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-[#0b426e] to-[#0c93e7] text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>
            </form>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
