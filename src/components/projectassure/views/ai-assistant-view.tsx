"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, BrainCircuit, Send, ShieldCheck, Sparkles, StopCircle, Wrench, X } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { answerQuestion, QUICK_ACTIONS, type AiAnswer } from "@/lib/projectassure/ai";
import { toast } from "sonner";

interface Msg { role: "user" | "assistant"; text?: string; answer?: AiAnswer; streaming?: boolean; }

export function AiAssistantView() {
  const projects = useAppStore((s) => s.projects);
  const seed = useAppStore((s) => s.aiSeedQuestion);
  const clearSeed = useAppStore((s) => s.clearAiSeed);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Namaste! I'm **Assure AI** — your agentic monitoring assistant. I reason over the live portfolio database with 6 tools (query, detail, predict, search documents, compare, report) and always show my sources.\n\nAsk me anything — for example *\"Why is Bharatmala P-4 at risk?\"* — or tap a quick action below.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const run = (question: string) => {
    if (!question.trim() || busy) return;
    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }, { role: "assistant", streaming: true }]);

    const thinkDelay = 500 + Math.random() * 600;
    setTimeout(() => {
      const ans = answerQuestion(question, projects);
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", answer: ans }]);
      setBusy(false);
    }, thinkDelay);
  };

  useEffect(() => {
    if (!seed) return;
    const q = seed;
    const t = setTimeout(() => { run(q); clearSeed(); }, 80);
    return () => clearTimeout(t);
  }, [seed]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* header */}
      <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-[#f0f7ff] to-white px-5 py-3.5 dark:from-[#064f85]/25 dark:to-transparent">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0c93e7]/10 text-[#0c93e7]"><BrainCircuit className="h-5 w-5" /></div>
          <div>
            <p className="flex items-center gap-2 font-semibold">Assure AI <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-bold text-[#15803d] dark:bg-green-500/15 dark:text-green-300">● ONLINE</span></p>
            <p className="text-xs text-muted-foreground">Agentic reasoning · GPT-4o-class pipeline (simulated) · Gemini fallback · RAG citations</p>
          </div>
        </div>
        <div className="hidden gap-2 text-[10px] sm:flex">
          {["query_projects", "get_project_detail", "run_delay_prediction", "search_documents", "compare_portfolio", "generate_report"].map((t) => (
            <span key={t} className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-muted-foreground">{t}</span>
          ))}
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto p-5 custom-scrollbar">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end pa-slide-in-right">
              <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-[#0c93e7] px-4 py-2.5 text-sm text-white shadow-sm">{m.text}</div>
            </div>
          ) : m.streaming ? (
            <div key={i} className="flex items-start gap-2.5 pa-fade-up">
              <BotAvatar />
              <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-border bg-muted/60 px-4 py-3.5">
                <span className="h-2 w-2 rounded-full bg-[#0c93e7] pa-typing-dot" />
                <span className="h-2 w-2 rounded-full bg-[#0c93e7] pa-typing-dot" />
                <span className="h-2 w-2 rounded-full bg-[#0c93e7] pa-typing-dot" />
                <span className="ml-1 text-xs text-muted-foreground">thinking · calling tools…</span>
              </div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2.5 pa-fade-up">
              <BotAvatar />
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-muted/40 p-4 shadow-sm">
                {m.answer ? <AnswerBody answer={m.answer} /> : <Md text={m.text ?? ""} />}
              </div>
            </div>
          )
        )}
      </div>

      {/* quick actions */}
      <div className="flex gap-2 overflow-x-auto border-t border-border px-5 py-2.5 custom-scrollbar">
        {QUICK_ACTIONS.map((qa) => (
          <button key={qa} onClick={() => run(qa)} disabled={busy} className="whitespace-nowrap rounded-full border border-[#bae0fd] bg-[#f0f7ff] px-3 py-1.5 text-xs font-medium text-[#015ca0] transition-colors hover:bg-[#e0effe] disabled:opacity-50 dark:border-[#064f85] dark:bg-[#064f85]/15 dark:text-sky-300">
            {qa}
          </button>
        ))}
      </div>

      {/* composer */}
      <form
        onSubmit={(e) => { e.preventDefault(); run(input); }}
        className="flex items-center gap-2 border-t border-border p-3.5"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything — e.g. Which water projects are behind schedule?"
          className="flex-1 rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#0c93e7]/50"
        />
        {busy ? (
          <button type="button" onClick={() => toast("Stopped — trace cleared")} className="rounded-xl border border-input p-3 text-muted-foreground hover:bg-muted"><StopCircle className="h-5 w-5" /></button>
        ) : (
          <button type="submit" disabled={!input.trim()} className="rounded-xl bg-[#0c93e7] p-3 text-white shadow-sm transition-all hover:bg-[#0b426e] active:scale-95 disabled:opacity-40"><Send className="h-5 w-5" /></button>
        )}
      </form>
    </div>
  );
}

function BotAvatar() {
  return <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0c93e7] to-[#0b426e] text-white shadow"><Sparkles className="h-4 w-4" /></div>;
}

export function AnswerBody({ answer }: { answer: AiAnswer }) {
  return (
    <div>
      {/* tool trace */}
      {answer.toolCalls.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {answer.toolCalls.map((t, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-[#bae0fd]/70 bg-[#f0f7ff] px-3 py-1.5 text-[11px] dark:border-[#064f85] dark:bg-[#064f85]/15">
              <Wrench className="h-3 w-3 shrink-0 text-[#0c93e7]" />
              <span className="font-mono font-semibold text-[#015ca0] dark:text-sky-300">{t.tool}</span>
              <span className="truncate font-mono text-muted-foreground">{t.args}</span>
              <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">{t.durationMs}ms</span>
            </div>
          ))}
        </div>
      )}
      {/* markdown-ish body */}
      <Md text={answer.answer} />
      {/* citations */}
      {answer.citations.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-2.5">
          {answer.citations.map((c) => (
              <span key={c.n} className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground" title={c.detail}>
              <BookOpen className="h-3 w-3 text-[#0c93e7]" />
              <span className="font-bold text-[#0c93e7]">[{c.n}]</span> <span className="truncate">{c.label}</span>
            </span>
          ))}
        </div>
      )}
      <p className="mt-2.5 flex items-center gap-1 text-[10px] text-muted-foreground"><ShieldCheck className="h-3 w-3" />{answer.dataFreshness} · intent: {answer.intent}</p>
    </div>
  );
}

/** tiny markdown renderer: **bold**, *italic*, tables, lists, headings */
function Md({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let tableRows: string[][] = [];

  const flushTable = (key: number) => {
    if (!tableRows.length) return;
    const [head, ...rows] = tableRows;
    out.push(
      <div key={`t${key}`} className="my-2 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/60"><tr>{head.map((h, i) => <th key={i} className="px-2.5 py-1.5 text-left font-semibold">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border/60">{r.map((c, j) => <td key={j} className="px-2.5 py-1.5">{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
    tableRows = [];
  };

  lines.forEach((line, i) => {
    if (line.trim().startsWith("|")) {
      const cells = line.split("|").slice(1, -1).map((s) => s.trim());
      if (cells.every((c) => /^-+$/.test(c.replace(/\s/g, "")))) return; // separator
      tableRows.push(cells);
      return;
    }
    flushTable(i);
    if (!line.trim()) { out.push(<div key={i} className="h-2" />); return; }
    if (line.startsWith("**") && line.endsWith("**")) {
      out.push(<p key={i} className="mb-1 text-sm font-bold">{inline(line)}</p>); return;
    }
    if (line.startsWith("- ")) {
      out.push(<p key={i} className="flex gap-2 text-sm leading-relaxed"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#0c93e7]" /><span>{inline(line.slice(2))}</span></p>); return;
    }
    if (/^\d+\. /.test(line)) {
      const n = line.match(/^(\d+)\. /)![1];
      out.push(<p key={i} className="flex gap-2 text-sm leading-relaxed"><span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#e0effe] text-[9px] font-bold text-[#015ca0]">{n}</span><span>{inline(line.replace(/^\d+\. /, ""))}</span></p>); return;
    }
    out.push(<p key={i} className="text-sm leading-relaxed">{inline(line)}</p>);
  });
  flushTable(999);
  return <div className="space-y-0.5">{out}</div>;
}

function inline(s: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) parts.push(<strong key={k++} className="font-bold">{tok.slice(2, -2)}</strong>);
    else parts.push(<em key={k++} className="italic">{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}
