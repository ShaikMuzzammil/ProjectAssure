"use client";

// Intelligence Console — AI chat grounded on the LIVE host mirror
// (users/projects/approvals/outbox stats). Provider chain on the server:
// Gemini REST → Groq → sandbox SDK → built-in deterministic engine (honest).

import { useEffect, useRef, useState } from "react";
import { BrainCircuit, Cpu, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, CardHead, Input, PageIntro } from "./ui";
import type { ViewProps } from "./view-props";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: string;
  model?: string;
  note?: string;
  at: string;
}

interface AiStatus {
  ok: boolean;
  providers: { name: string; label: string; configured: boolean }[];
}

const SUGGESTIONS = [
  "How many users and projects are in the portfolio right now?",
  "Which projects are at risk and why?",
  "What is the budget position and overrun situation?",
  "Are there approvals pending? What kind?",
  "Summarise email delivery status.",
  "Is the main app connection healthy?",
];

export function IntelligenceView({ state }: ViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/ai/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AiStatus | null) => setStatus(d))
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const contextNote = state.mirror.stats
    ? `grounded on the live mirror — ${state.mirror.stats.users} users · ${state.mirror.stats.projects} projects · ${state.mirror.stats.openAlerts} open alerts`
    : "no snapshot mirrored yet — answers will say so honestly";

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setQuestion("");
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed, at: new Date().toISOString() };
    setMessages((m) => [...m, userMsg]);
    try {
      const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, history }),
      });
      const data = (await res.json().catch(() => ({}))) as { answer?: string; provider?: string; model?: string; note?: string; error?: string };
      if (res.ok && data.answer) {
        setMessages((m) => [
          ...m,
          { id: crypto.randomUUID(), role: "assistant", content: data.answer!, provider: data.provider, model: data.model, note: data.note, at: new Date().toISOString() },
        ]);
      } else {
        toast.error("Intelligence unavailable", { description: data.error ?? `HTTP ${res.status}` });
      }
    } catch (e) {
      toast.error("Intelligence unavailable", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageIntro
        title="Intelligence Console"
        description={`Ask anything about the platform — answers are ${contextNote}. Provider chain: Gemini → Groq → sandbox SDK → built-in deterministic engine, and every answer is labeled with the provider that produced it.`}
      />

      <div className="grid gap-4 xl:grid-cols-4">
        {/* chat */}
        <Card className="flex min-h-[32rem] flex-col overflow-hidden xl:col-span-3">
          <CardHead
            title="Assure Intelligence · host mode"
            subtitle="grounded answers, short and decidable"
            icon={<BrainCircuit className="h-4 w-4" />}
            right={busy ? <Badge tone="sky">thinking…</Badge> : <Badge tone="green">ready</Badge>}
          />

          <div ref={scrollRef} className="host-scroll min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#072b49] text-white">
                  <Sparkles className="h-6 w-6" aria-hidden />
                </div>
                <p className="max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Numbers come only from the live mirror — nothing is invented. Try one of the prompts below or ask anything about the platform.
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" ? (
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#072b49] text-white" aria-hidden>
                      <Cpu className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                      m.role === "user"
                        ? "bg-[#0c93e7] text-white"
                        : "bg-white text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200"
                    }`}
                  >
                    <Markdownish text={m.content} />
                    {m.role === "assistant" ? (
                      <p className="mt-2 border-t border-slate-100 pt-1.5 text-[9px] uppercase tracking-wider text-slate-400 dark:border-slate-800">
                        {m.provider === "builtin" ? "built-in engine · from the live mirror" : `${m.provider ?? "?"} · ${m.model ?? ""}`}
                      </p>
                    ) : null}
                    {m.note ? (
                      <p className="mt-1 text-[10px] italic leading-relaxed text-amber-600 dark:text-amber-400">{m.note}</p>
                    ) : null}
                  </div>
                  {m.role === "user" ? (
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200" aria-hidden>
                      <User className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                </div>
              ))
            )}
            {busy ? (
              <div className="flex items-center gap-2 px-1 text-[11px] text-slate-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0c93e7]" aria-hidden />
                querying providers / computing from the mirror…
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-100 p-3 dark:border-slate-800">
            {messages.length === 0 ? (
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void ask(s)}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 transition-colors hover:border-[#0c93e7] hover:text-[#0c93e7] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(question);
              }}
            >
              <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about users, projects, budgets, alerts, sync…" aria-label="Question" disabled={busy} />
              <Button type="submit" size="md" loading={busy} disabled={!question.trim()}>
                <Send className="h-3.5 w-3.5" /> Ask
              </Button>
            </form>
          </div>
        </Card>

        {/* provider status */}
        <Card>
          <CardHead title="Providers" subtitle="first working one serves" icon={<Cpu className="h-4 w-4" />} />
          <div className="space-y-2 px-5 py-4">
            {(status?.providers ?? []).map((p) => (
              <div key={p.name} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">{p.name}</p>
                  <p className="truncate text-[10px] text-slate-400">{p.label}</p>
                </div>
                <Badge tone={p.configured ? "green" : "slate"}>{p.configured ? "ready" : "unset"}</Badge>
              </div>
            ))}
            <p className="pt-1 text-[10px] leading-relaxed text-slate-400">
              Add GEMINI_API_KEY (free, Google AI Studio) or GROQ_API_KEY (free) to the host env for full language answers. Without them the built-in engine answers deterministically from the mirror — labeled honestly.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Tiny markdown-lite: **bold**, *italic*, line breaks. Data is escaped. */
function Markdownish({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div>
      {lines.map((line, i) => {
        const escaped = line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const html = escaped
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.+?)\*/g, "<em>$1</em>");
        return html ? <p key={i} dangerouslySetInnerHTML={{ __html: html }} /> : <p key={i}>&nbsp;</p>;
      })}
    </div>
  );
}
