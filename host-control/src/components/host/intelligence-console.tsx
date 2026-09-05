"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuit, Send, FileUp, FileText, Download, Settings2,
  Sparkles, Trash2, Paperclip, X, Activity, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAdminStore } from "@/store/admin-store";
import { cn, downloadText, downloadPDF, extractFileText, nextId, fmtDateTime } from "@/lib/utils";
import type { ChatMessage } from "@/lib/host/types";

const QUICK_PROMPTS = [
  { label: "Top 3 risks across portfolio?", q: "What are the top 3 risks across the portfolio today? Cite project names and health scores." },
  { label: "Which approvals need attention today?", q: "Which approvals need my attention today? Sort by risk score." },
  { label: "Forecast Q3 budget", q: "Forecast the portfolio's Q3 (Jul-Sep) budget outturn. Give the projected figure, variance %, and the two projects driving 60% of the overrun signal." },
  { label: "Summarise Bharatmala P-4", q: "Summarise the Bharatmala P-4 (Karur-Dindigul) project — status, key risks, and the single approval that unblocks it." },
  { label: "Compare top 3 critical projects", q: "Compare the top 3 critical projects by health score, variance, delay days and pending approvals. Use a small markdown table." },
  { label: "What changed this week?", q: "What changed in the portfolio this week? List alerts, approvals, and budget movements." },
];

interface Attachment {
  name: string;
  sizeKB: number;
  preview: string;
  fileType: string;
}

export function IntelligenceConsole() {
  const {
    chat, addChatMessage, clearChat,
    universalMode, setUniversalMode,
    aiTemperature, aiMaxTokens, aiModel, setAiSettings,
    aiStatus, snapshot, projects, alerts, approvals,
    pushActivity,
  } = useAdminStore();

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat, busy]);

  const buildContext = () => {
    if (!snapshot) return "";
    const portfolioBrief = `PORTFOLIO SNAPSHOT (live as of ${new Date().toLocaleString("en-IN")}):
- Total projects: ${snapshot.totalProjects} (demo + ${snapshot.freshProjects} fresh-user)
- Total sanctioned: ₹${(snapshot.totalSanctionedL / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr
- Total spent: ₹${(snapshot.totalSpentL / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr (${((snapshot.totalSpentL / snapshot.totalSanctionedL) * 100).toFixed(1)}% burn)
- Projected outturn: ₹${(snapshot.totalProjectedL / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr
- Portfolio variance: ${snapshot.portfolioVariancePct >= 0 ? "+" : ""}${snapshot.portfolioVariancePct.toFixed(2)}% vs proportional
- Open alerts: ${snapshot.openAlerts} · Critical projects: ${snapshot.criticalProjects} · At-risk: ${snapshot.atRiskProjects} · Healthy: ${snapshot.healthyProjects}
- Pending approvals: ${snapshot.pendingApprovals}

TOP 5 AT-RISK PROJECTS:
${snapshot.topRisky.map((p, i) => `${i + 1}. ${p.name} — health ${p.healthScore} (${p.healthStatus}), variance ${p.variancePct >= 0 ? "+" : ""}${p.variancePct.toFixed(1)}%, delay ${p.delayDays}d, ${p.sector}/${p.state}`).join("\n")}

TOP 5 BUDGET OVERRUNS:
${snapshot.topOverruns.map((p, i) => `${i + 1}. ${p.name} — variance ${p.variancePct >= 0 ? "+" : ""}${p.variancePct.toFixed(1)}%, spent ₹${(p.spentBudgetL / 100).toFixed(2)} Cr of ₹${(p.totalBudgetL / 100).toFixed(2)} Cr sanctioned`).join("\n")}

PENDING APPROVALS QUEUE (${approvals.filter(a => a.status === "PENDING").length} items):
${approvals.filter(a => a.status === "PENDING").map(a => {
  const val = a.amountL ? `₹${(a.amountL / 100).toFixed(1)} Cr` : a.durationDays ? `${a.durationDays}d EoT` : a.procurementValueL ? `₹${(a.procurementValueL / 100).toFixed(1)} Cr procurement` : "—";
  return `- ${a.type.replace(/_/g, " ")} · ${a.projectName} · ${val} · risk ${a.riskScore} · requested by ${a.requester}`;
}).join("\n")}

LIVE ALERTS (last 8):
${alerts.slice(0, 8).map(a => `- [${a.severity}] ${a.title} — ${a.projectName} (${a.type})`).join("\n")}
`;
    return portfolioBrief;
  };

  const handleSend = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setBusy(true);
    const userMsg: ChatMessage = {
      id: nextId("m"), role: "user", content: q, timestamp: new Date().toISOString(),
      universal: universalMode,
      attachments: attachments.map(a => ({ name: a.name, sizeKB: a.sizeKB, preview: a.preview.slice(0, 200) })),
    };
    addChatMessage(userMsg);
    setInput("");
    const sentAttachments = attachments;
    setAttachments([]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          universal: universalMode,
          context: universalMode ? undefined : buildContext(),
          attachments: sentAttachments,
          temperature: aiTemperature,
          maxTokens: aiMaxTokens,
          user: { name: "Arun Kulkarni", role: "ADMIN" },
        }),
      });
      const json = await res.json();
      const assistantMsg: ChatMessage = {
        id: nextId("m"), role: "assistant", content: json.answer || "(no answer)", timestamp: new Date().toISOString(),
        provider: json.provider, model: json.model, tokens: json.tokens, universal: universalMode,
      };
      addChatMessage(assistantMsg);
      pushActivity({
        id: nextId("ev"),
        timestamp: new Date().toISOString(),
        kind: "ai",
        message: `Assure Intelligence answered${universalMode ? " (universal)" : ""} · ${json.provider === "built-in" ? "built-in engine" : "live provider"} · ${json.tokens || 0} tokens`,
      });
    } catch (e: any) {
      toast.error("Intelligence call failed", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const added: Attachment[] = [];
    for (const f of Array.from(files)) {
      try {
        const text = await extractFileText(f);
        added.push({
          name: f.name,
          sizeKB: +(f.size / 1024).toFixed(1),
          preview: text.slice(0, 1800),
          fileType: f.type || f.name.split(".").pop() || "unknown",
        });
      } catch (e: any) {
        toast.error(`Failed to read ${f.name}`, { description: e?.message });
      }
    }
    setAttachments(a => [...a, ...added]);
    toast.success(`${added.length} file(s) attached`);
  };

  const exportConversation = (format: "md" | "txt" | "pdf") => {
    if (!chat.length) {
      toast.error("No conversation to export");
      return;
    }
    const title = `ProjectAssure Host Control · Intelligence Conversation · ${fmtDateTime()}`;
    const body = chat.map(m => {
      const head = `[${fmtDateTime(m.timestamp)}] ${m.role.toUpperCase()}${m.universal ? " (universal)" : ""}${m.provider ? ` · ${m.provider}` : ""}${m.tokens ? ` · ${m.tokens} tokens` : ""}`;
      const atts = m.attachments?.length ? `\n  attachments: ${m.attachments.map(a => a.name).join(", ")}` : "";
      return `${head}\n${m.content}${atts}`;
    }).join("\n\n---\n\n");

    if (format === "pdf") {
      downloadPDF(`pa-intelligence-${Date.now()}.pdf`, title, body);
    } else if (format === "md") {
      downloadText(`pa-intelligence-${Date.now()}.md`, `# ${title}\n\n${body}`, "text/markdown");
    } else {
      downloadText(`pa-intelligence-${Date.now()}.txt`, `${title}\n\n${body}`, "text/plain");
    }
    toast.success(`Conversation exported as ${format.toUpperCase()}`);
  };

  const totalTokens = chat.reduce((s, m) => s + (m.tokens || 0), 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* ─── Chat panel ──────────────────────────────────────────────────────── */}
      <Card className="flex flex-col h-[calc(100vh-12rem)]">
        <CardHeader className="flex-row items-center justify-between flex-none border-b">
          <div className="flex items-center gap-2">
            <div className="relative flex size-2.5">
              <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60", aiStatus?.connected ? "bg-emerald-400 animate-ping" : "bg-amber-400")} />
              <span className={cn("relative inline-flex size-2.5 rounded-full", aiStatus?.connected ? "bg-emerald-500" : "bg-amber-500")} />
            </div>
            <div>
              <CardTitle className="text-base">Assure Intelligence · Host Console</CardTitle>
              <CardDescription className="text-xs">{aiStatus?.label ?? "checking…"} · {universalMode ? "Universal mode" : "Project-specific (grounded)"}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="size-3.5" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportConversation("md")}>Markdown (.md)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportConversation("txt")}>Plain text (.txt)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportConversation("pdf")}>PDF (.pdf)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm" onClick={() => { clearChat(); toast.success("Conversation cleared"); }} className="gap-1.5 text-muted-foreground">
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </CardHeader>

        {/* Quick prompts */}
        <div className="flex-none border-b px-4 py-2 flex items-center gap-2 overflow-x-auto custom-scrollbar">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">Quick prompts:</span>
          {QUICK_PROMPTS.map((p, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              className="h-7 shrink-0 text-xs gap-1"
              onClick={() => { setInput(p.q); }}
            >
              <Sparkles className="size-3 text-brand-500" /> {p.label}
            </Button>
          ))}
        </div>

        {/* Conversation */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-4">
          {chat.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground gap-3">
              <BrainCircuit className="size-10 text-brand-400" />
              <div className="font-medium text-foreground">Ask anything about the portfolio.</div>
              <div className="max-w-md text-xs">
                {universalMode
                  ? "Universal mode — answer any question about portfolio management, governance, project monitoring, or general administrative queries. Project context optional."
                  : "Project-specific mode — every answer is grounded on the live portfolio snapshot. Numbers come from the mirror, not the model."}
                <br />Try one of the quick prompts above, or upload documents as evidence.
              </div>
            </div>
          ) : chat.map(m => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex gap-3", m.role === "user" ? "justify-end" : "")}
            >
              {m.role === "assistant" && (
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  <BrainCircuit className="size-4" />
                </div>
              )}
              <div className={cn(
                "max-w-[80%] rounded-lg border p-3",
                m.role === "user" ? "bg-primary/5 border-primary/20" : "bg-card",
              )}>
                {m.role === "assistant" && (
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] text-muted-foreground">
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {m.provider === "built-in" ? "built-in engine" : (m.provider ?? "live")}
                    </Badge>
                    {m.universal && <Badge variant="outline" className="text-[9px] px-1 py-0 border-violet-300 text-violet-700 bg-violet-50 dark:bg-violet-500/15 dark:text-violet-300">universal</Badge>}
                    {m.tokens && <span className="tabular">{m.tokens} tok</span>}
                  </div>
                )}
                <div className="text-sm leading-relaxed whitespace-pre-wrap pa-md">{m.content}</div>
                {m.attachments && m.attachments.length > 0 && (
                  <div className="mt-2 pt-2 border-t flex flex-wrap gap-1">
                    {m.attachments.map((a, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                        <Paperclip className="size-2.5" /> {a.name} ({a.sizeKB} KB)
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {busy && (
            <div className="flex gap-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                <BrainCircuit className="size-4" />
              </div>
              <div className="rounded-lg border bg-card p-3 flex items-center gap-1">
                <span className="typing-dot inline-block size-1.5 rounded-full bg-brand-500" />
                <span className="typing-dot inline-block size-1.5 rounded-full bg-brand-500" />
                <span className="typing-dot inline-block size-1.5 rounded-full bg-brand-500" />
              </div>
            </div>
          )}
        </div>

        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="flex-none border-t px-4 py-2 flex flex-wrap gap-1.5">
            {attachments.map((a, i) => (
              <Badge key={i} variant="secondary" className="gap-1 text-xs">
                <Paperclip className="size-3" /> {a.name} ({a.sizeKB} KB)
                <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="ml-1 hover:text-destructive">
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex-none border-t p-3 space-y-2">
          <div
            className={cn(
              "rounded-lg border-2 border-dashed transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-muted",
            )}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
          >
            <div className="flex items-start gap-2 p-2">
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 shrink-0 text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="size-3.5" /> Attach
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
              />
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder={universalMode ? "Ask anything — portfolio, governance, project monitoring, general admin…" : "Ask a portfolio-grounded question — every number cited comes from the live mirror…"}
                rows={2}
                className="border-0 shadow-none focus-visible:ring-0 resize-none bg-transparent"
              />
              <Button size="sm" onClick={handleSend} disabled={busy || !input.trim()} className="gap-1 shrink-0">
                <Send className="size-3.5" /> Send
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="size-3" /> {chat.length} messages · {totalTokens} tokens used</span>
            <span>Enter to send · Shift+Enter for newline</span>
          </div>
        </div>
      </Card>

      {/* ─── Settings panel ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Settings2 className="size-4" /> Mode & Provider</CardTitle>
            <CardDescription>Switch between grounded portfolio mode and universal Q&A.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Universal mode</div>
                <div className="text-[10px] text-muted-foreground">Free-form Q&A without portfolio grounding.</div>
              </div>
              <Switch checked={universalMode} onCheckedChange={setUniversalMode} />
            </div>
            <Separator />
            <div className="space-y-1.5">
              <Label className="text-xs">Provider status</Label>
              <div className="flex items-center gap-2 rounded-md border p-2">
                <span className={cn("size-2 rounded-full", aiStatus?.connected ? "bg-emerald-500" : "bg-amber-500")} />
                <div className="text-xs flex-1">{aiStatus?.label ?? "checking…"}</div>
                <Badge variant="outline" className="text-[10px]">{aiStatus?.tier ?? "—"}</Badge>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Model</Label>
              <Select value={aiModel} onValueChange={(v) => setAiSettings({ model: v })}>
                <SelectTrigger className="w-full h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (first live)</SelectItem>
                  <SelectItem value="gemini">Gemini</SelectItem>
                  <SelectItem value="groq">Groq</SelectItem>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="builtin">Built-in engine</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generation Settings</CardTitle>
            <CardDescription>Tune the answer length and creativity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center justify-between">
                <span>Temperature</span>
                <span className="tabular text-brand-700">{aiTemperature.toFixed(2)}</span>
              </Label>
              <input
                type="range" min={0} max={1} step={0.05}
                value={aiTemperature}
                onChange={(e) => setAiSettings({ temperature: parseFloat(e.target.value) })}
                className="w-full accent-primary"
              />
              <div className="text-[10px] text-muted-foreground flex justify-between">
                <span>Precise (0.0)</span><span>Balanced (0.5)</span><span>Creative (1.0)</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center justify-between">
                <span>Max tokens</span>
                <span className="tabular text-brand-700">{aiMaxTokens}</span>
              </Label>
              <input
                type="range" min={256} max={2048} step={64}
                value={aiMaxTokens}
                onChange={(e) => setAiSettings({ maxTokens: parseInt(e.target.value) })}
                className="w-full accent-primary"
              />
              <div className="text-[10px] text-muted-foreground">256 (short) → 2048 (full report)</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Activity className="size-4" /> Session Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Messages</span><span className="tabular font-medium">{chat.length}</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Tokens used</span><span className="tabular font-medium">{totalTokens}</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Attachments</span><span className="tabular font-medium">{chat.reduce((s, m) => s + (m.attachments?.length || 0), 0)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Live provider</span><span className="font-medium">{aiStatus?.connected ? "Yes" : "No (built-in)"}</span></div>
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-1 text-xs font-medium"><FileText className="size-3.5 text-brand-600" /> Universal vs Grounded</div>
            <div className="text-[11px] text-muted-foreground leading-snug">
              <strong>Grounded</strong> (default): every figure cited comes from the live portfolio mirror — projects, approvals, alerts, budget. Switch to{" "}
              <strong>Universal</strong> for general programme-management / governance questions without portfolio grounding.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
