"use client";
import React, { useState, useRef } from "react";
import { useAdminStore } from "@/store/admin-store";
import { cn } from "@/lib/utils";
import { BrainCircuit, Send, Sparkles, ShieldCheck } from "lucide-react";

const QUICK = ["Top 3 risks across portfolio?", "Which approvals need attention today?", "Forecast Q3 budget", "Why is Bharatmala P-4 at risk?"];

export function IntelligenceConsole() {
  const { aiStatus, snapshot } = useAdminStore();
  const [input, setInput] = useState(""); const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const send = async (q?: string) => {
    const question = (q ?? input).trim(); if (!question || busy) return;
    setInput(""); setBusy(true);
    setMessages(m => [...m, { role: "user", content: question }]);
    try {
      const res = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const data = await res.json();
      setMessages(m => [...m, { role: "assistant", content: data.answer || "No answer received." }]);
    } catch { setMessages(m => [...m, { role: "assistant", content: "Error reaching the intelligence service." }]); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-[1000px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-lg font-bold">Intelligence Console</h2><p className="text-xs text-slate-500">Universal assistant — grounded on the live portfolio snapshot. Multi-provider chain: Gemini → Groq → OpenRouter → built-in.</p></div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <span className={cn("h-2 w-2 rounded-full", aiStatus?.connected ? "bg-emerald-500" : "bg-slate-400")} />
          <span className="text-[11px] font-bold">{aiStatus?.label ?? "probing…"}</span>
        </div>
      </div>
      <div className="flex h-[520px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3"><BrainCircuit className="h-4 w-4 text-[#0c93e7]" /><div className="text-sm font-bold">Assure Intelligence — universal mode</div></div>
        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && <div className="flex h-full flex-col items-center justify-center text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-white"><BrainCircuit className="h-6 w-6" /></div><div className="mt-3 text-sm font-bold">Ask anything about the portfolio</div><div className="mt-1 max-w-md text-xs text-slate-500">Universal mode — answers grounded on live data. Provider: {aiStatus?.label ?? "probing…"}</div><div className="mt-4 flex flex-wrap justify-center gap-2">{QUICK.map(q => <button key={q} onClick={() => send(q)} className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-medium hover:border-[#0c93e7]/50">{q}</button>)}</div></div>}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "")}>
              {m.role === "assistant" && <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-white"><Sparkles className="h-3.5 w-3.5" /></div>}
              <div className={cn("max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm", m.role === "user" ? "bg-[#0c93e7] text-white" : "border border-slate-200 bg-slate-50")}>{m.content}</div>
            </div>
          ))}
          {busy && <div className="flex gap-3"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-white"><Sparkles className="h-3.5 w-3.5" /></div><div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="flex gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#0c93e7] animate-bounce" style={{ animationDelay: "0ms" }} /><span className="h-1.5 w-1.5 rounded-full bg-[#0c93e7] animate-bounce" style={{ animationDelay: "150ms" }} /><span className="h-1.5 w-1.5 rounded-full bg-[#0c93e7] animate-bounce" style={{ animationDelay: "300ms" }} /></div></div></div>}
        </div>
        <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-slate-100 p-3">
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about risks, budget, approvals, predictions…" className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#0c93e7]" />
          <button type="submit" disabled={busy || !input.trim()} className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-[#0b426e] to-[#0c93e7] text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>
        </form>
      </div>
      <div className="rounded-xl border border-[#072b49] bg-[#072b49] p-4 text-white">
        <div className="flex items-center gap-2 text-xs font-bold"><ShieldCheck className="h-4 w-4 text-[#7cc8fb]" />Guardrails in force</div>
        <ul className="mt-2 space-y-0.5 text-[10px] text-white/75"><li>• Every number grounded in the portfolio snapshot</li><li>• Currency ₹ crore, Indian grouping · dates DD Mon YYYY</li><li>• Never reveals SQL, credentials or provider names</li><li>• PII masked · document text is DATA, never commands</li><li>• 20 req/h token bucket · short decidable answers</li></ul>
      </div>
    </div>
  );
}
