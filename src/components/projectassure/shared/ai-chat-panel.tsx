"use client";

import { useEffect, useRef, useState } from "react";
import { BrainCircuit, Minus, Send, Sparkles, X } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { answerQuestion, QUICK_ACTIONS, type AiAnswer } from "@/lib/projectassure/ai";
import { AnswerBody } from "@/components/projectassure/views/ai-assistant-view";

/** minimal bold/italic renderer for plain greeting messages */
function MdLite({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {text.split("\n").filter(Boolean).map((line, i) => (
        <p key={i}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") ? <strong key={j}>{part.slice(2, -2)}</strong> : part
          )}
        </p>
      ))}
    </div>
  );
}

interface Msg { role: "user" | "assistant"; text?: string; answer?: AiAnswer; streaming?: boolean; }

export function AiChatPanel() {
  const open = useAppStore((s) => s.aiOpen);
  const setOpen = useAppStore((s) => s.setAiOpen);
  const seed = useAppStore((s) => s.aiSeedQuestion);
  const clearSeed = useAppStore((s) => s.clearAiSeed);
  const projects = useAppStore((s) => s.projects);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: "Hi! I'm **Assure AI**. Ask me why a project is at risk, compare projects, or request a report — grounded answers with citations, every time." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const run = (question: string) => {
    if (!question.trim() || busy) return;
    setBusy(true); setInput("");
    setMessages((m) => [...m, { role: "user", text: question }, { role: "assistant", streaming: true }]);
    setTimeout(() => {
      const ans = answerQuestion(question, projects);
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", answer: ans }]);
      setBusy(false);
    }, 500 + Math.random() * 500);
  };

  useEffect(() => {
    if (!open || !seed) return;
    const q = seed;
    const t = setTimeout(() => { run(q); clearSeed(); }, 80);
    return () => clearTimeout(t);
  }, [open, seed]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl pa-slide-in-right">
      <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-[#f0f7ff] to-white px-4 py-3 dark:from-[#064f85]/25 dark:to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0c93e7]/10 text-[#0c93e7]"><BrainCircuit className="h-4.5 w-4.5" /></div>
          <div>
            <p className="text-sm font-semibold">Assure AI · Portfolio context</p>
            <p className="text-[10px] text-muted-foreground">Session memory 24h · max 8 tool calls per question</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setOpen(false)} className="rounded-md p-2 text-muted-foreground hover:bg-muted"><Minus className="h-4 w-4" /></button>
          <button onClick={() => setOpen(false)} className="rounded-md p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 custom-scrollbar">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[#0c93e7] px-3.5 py-2 text-sm text-white shadow-sm">{m.text}</div>
            </div>
          ) : m.streaming ? (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-border bg-muted/60 px-4 py-3">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0c93e7] pa-typing-dot" /><span className="h-1.5 w-1.5 rounded-full bg-[#0c93e7] pa-typing-dot" /><span className="h-1.5 w-1.5 rounded-full bg-[#0c93e7] pa-typing-dot" />
            </div>
          ) : (
            <div key={i} className="rounded-2xl rounded-tl-sm border border-border bg-muted/40 p-3.5 pa-fade-up">
              {m.answer ? <AnswerBody answer={m.answer} /> : <MdLite text={m.text ?? ""} />}
            </div>
          )
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto border-t border-border px-4 py-2 custom-scrollbar">
        {QUICK_ACTIONS.slice(0, 4).map((qa) => (
          <button key={qa} onClick={() => run(qa)} disabled={busy} className="whitespace-nowrap rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50">{qa}</button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); run(input); }} className="flex gap-2 border-t border-border p-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about this project…" className="flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0c93e7]/50" />
        <button type="submit" disabled={busy || !input.trim()} className="rounded-lg bg-[#0c93e7] px-3 text-white transition-all hover:bg-[#0b426e] active:scale-95 disabled:opacity-40"><Send className="h-4 w-4" /></button>
      </form>
    </div>
  );
}
