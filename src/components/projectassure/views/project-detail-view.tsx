"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { ComposedChart, Line, Area, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, ReferenceLine, ResponsiveContainer, BarChart, Bar } from "recharts";
import { useApp } from "@/store/app-store";
import { HealthRing, HealthBadge, StatusBadge, SectionTitle, MsBadge, ProgressBar, Md, EmptyState, InfoTip, PipelineStrip } from "../shared/ui-bits";
import { buildRecommendedActions, projectNoActionImpact, buildRootCauseTree, buildExecutiveSummary, seedKpis, fmtDate } from "@/lib/projectassure/recommendations";
import { deriveRiskRegister, RISK_CATEGORY_META, type RiskCategory } from "@/lib/projectassure/risks";
import { ACTION_AREA_META } from "@/lib/projectassure/types";
import { can, canTouchProject, SEVERITY_RANK } from "@/lib/projectassure/permissions";
import GanttTimeline from "../shared/gantt";
import DocPipeline from "../shared/doc-pipeline";
import { recomputeProject } from "@/lib/projectassure/engine";
import { computeBudgetForecast, extractFeatures, FEATURE_LABELS } from "@/lib/projectassure/ml";
import { buildReport, downloadPdf, downloadExcel, reportFileName, REPORT_TOPICS, DEFAULT_TOPICS, filterReport } from "@/lib/projectassure/reports";
import { inr, shortDate, relTime, monthLabel } from "@/lib/projectassure/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ChevronRight, Sparkles, FileText, Mail, RefreshCw, Play, Flag, KanbanSquare, IndianRupee, Users2,
  FolderOpen, ShieldAlert, History, FlaskConical, Pencil, Plus, Trash2, Check, Loader2, TrendingDown,
  Target, ListChecks, GitBranch, Gauge as GaugeIcon, ClipboardList, Network,
} from "lucide-react";
import type { Task, TaskStatus, Milestone } from "@/lib/projectassure/types";

const TABS = [
  { id: "overview", label: "Overview", icon: FolderOpen },
  { id: "milestones", label: "Milestones", icon: Flag },
  { id: "tasks", label: "Tasks (Kanban)", icon: KanbanSquare },
  { id: "budget", label: "Budget", icon: IndianRupee },
  { id: "resources", label: "Resources", icon: Users2 },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "actions", label: "Plan of Action", icon: Target },
  { id: "risk", label: "Risk & Intelligence", icon: ShieldAlert },
  { id: "alerts", label: "Alerts", icon: ShieldAlert },
  { id: "audit", label: "Audit", icon: History },
];

export default function ProjectDetailView() {
  const user = useApp(s => s.user)!;
  const route = useApp(s => s.route);
  const projects = useApp(s => s.projects);
  const navigate = useApp(s => s.navigate);
  const setDetailTab = useApp(s => s.setDetailTab);
  const openProject = useApp(s => s.openProject);
  const runPrediction = useApp(s => s.runPrediction);
  const askAi = useApp(s => s.askAi);
  const moveTask = useApp(s => s.moveTask);
  const setMilestoneStatus = useApp(s => s.setMilestoneStatus);
  const addMilestone = useApp(s => s.addMilestone);
  const markAlertRead = useApp(s => s.markAlertRead);
  const acknowledgeAlert = useApp(s => s.acknowledgeAlert);
  const updateResource = useApp(s => s.updateResource);
  const deleteDocument = useApp(s => s.deleteDocument);
  const updateProject = useApp(s => s.updateProject);
  const recordExport = useApp(s => s.recordExport);
  const queueEmail = useApp(s => s.queueEmail);

  const p = projects.find(x => x.id === route.projectId);
  const [tab, setTab] = useState(route.detailTab ?? "overview");
  const [predicting, setPredicting] = useState(false);
  const [msDialog, setMsDialog] = useState(false);
  const [ackAlert, setAckAlert] = useState<string | null>(null);
  const [ackNote, setAckNote] = useState("");
  const [emailing, setEmailing] = useState(false);
  const [topics, setTopics] = useState<string[]>(DEFAULT_TOPICS);
  const toggleTopic = (id: string) => setTopics(ts => ts.includes(id) ? ts.filter(x => x !== id) : [...ts, id]);
  const forecast = useMemo(() => (p ? computeBudgetForecast(p) : null), [p]);

  if (!p) return <EmptyState icon={FolderOpen} title="Project not found" body="It may have been cancelled or is outside your RBAC scope." action={<Button size="sm" onClick={() => navigate("projects")}>Back to projects</Button>} />;

  const editable = canTouchProject(user, p.projectManager);
  const canEdit = editable;

  const doPredict = async () => {
    setPredicting(true);
    await new Promise(r => setTimeout(r, 1400));
    runPrediction(p.id);
    setPredicting(false);
    setTab("risk");
    toast.success("Prediction re-run complete", { description: `p=${Math.round((useApp.getState().projects.find(x => x.id === p.id)?.prediction?.probability ?? 0) * 100)}% · factors recomputed from live data · audit-logged` });
  };

  const exportPdf = async () => {
    const stats = useApp.getState().stats();
    const doc = filterReport(buildReport("project-status", [p], { ...stats, totalProjects: 1 }, user, p), topics);
    await downloadPdf(doc, reportFileName("project-status", p));
    recordExport("Project status report", "pdf", `${p.psId} — ${p.name} · ${topics.length} topic(s)`);
    toast.success("PDF status report exported", { description: `${doc.sections.length} section(s) — your selected matter only · audit-logged` });
  };
  const exportExcel = async () => {
    const stats = useApp.getState().stats();
    const doc = filterReport(buildReport("project-status", [p], { ...stats, totalProjects: 1 }, user, p), topics);
    await downloadExcel(doc, reportFileName("project-status", p), [{ name: "Milestones", rows: [["Milestone", "Status", "Planned", "Critical", "Progress"], ...p.milestones.map(m => [m.name, m.status, shortDate(m.plannedDate), m.isCritical ? "YES" : "", `${m.progress}%`])] }]);
    recordExport("Project status report", "xlsx", `${p.psId} — ${p.name}`);
    toast.success("Excel status report exported");
  };
  const emailReport = async () => {
    setEmailing(true);
    const stats = useApp.getState().stats();
    const doc = filterReport(buildReport("project-status", [p], { ...stats, totalProjects: 1 }, user, p), topics);
    const fn = reportFileName("project-status", p);
    const msg = await queueEmail({ to: user.email, toName: user.name, template: "report_delivery", reportName: `${fn}.pdf`, project: p, projectId: p.id, attachments: [{ name: `${fn}.pdf`, kind: "pdf", sizeKb: 268 }], send: true });
    setEmailing(false);
    toast.success(msg.status === "SENT" ? "Report emailed (email service)" : "Report queued to the demo outbox", { description: `To: ${msg.to} · ${doc.sections.length} section(s) — your selected matter only · open the Email Centre to preview` });
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      {/* breadcrumb */}
      <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        <button onClick={() => navigate("dashboard")} className="hover:text-foreground">Command Centre</button>
        <ChevronRight className="h-3 w-3" />
        <button onClick={() => navigate("projects")} className="hover:text-foreground">Projects</button>
        <ChevronRight className="h-3 w-3" />
        <span className="font-semibold text-foreground">{p.name.replace(/,.*$/, "")}</span>
      </div>

      {/* header */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start gap-4">
          <HealthRing score={p.healthScore} size={84} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[18px] font-bold tracking-tight">{p.name}</h1>
              <HealthBadge status={p.healthStatus} />
              <StatusBadge status={p.status} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
              <span className="font-mono">{p.psId}</span>
              <span>{p.district}, {p.state} · {p.sector} · {p.scheme}</span>
              <span>PM {p.projectManager} · {p.contractor}</span>
              <span>Target {shortDate(p.targetDate)}{p.estimatedEndDate ? ` · est. completion ${shortDate(p.estimatedEndDate)}` : ""}</span>
            </div>
            {p.story && (
              <div className="mt-2.5 rounded-lg border-l-[3px] border-[#0c93e7] bg-[#e0effe]/40 px-3 py-2 text-[11.5px] leading-relaxed text-foreground/80 dark:bg-[#0c93e7]/8">
                <strong>Field story:</strong> {p.story.narrative}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <button onClick={doPredict} disabled={predicting} className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0b426e] to-[#0c93e7] px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-60">
                {predicting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}{predicting ? "Scoring…" : "Run prediction"}
              </button>
              <button onClick={exportPdf} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition hover:border-[#0c93e7]/40"><FileText className="h-3.5 w-3.5" />PDF</button>
              <button onClick={exportExcel} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition hover:border-[#0c93e7]/40"><FileText className="h-3.5 w-3.5" />Excel</button>
              <button onClick={emailReport} disabled={emailing} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition hover:border-[#0c93e7]/40"><Mail className="h-3.5 w-3.5" />{emailing ? "Sending…" : "Email report"}</button>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 rounded-lg border border-[#0c93e7]/40 bg-[#e0effe]/50 px-3 py-2 text-[12.5px] font-semibold text-[#015ca0] transition dark:bg-[#0c93e7]/10 dark:text-[#7cc8fb]" title="Choose what goes into the exported file">
                    <ListChecks className="h-3.5 w-3.5" />What to export · {topics.length}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-3">
                  <div className="text-[12px] font-bold">What to export</div>
                  <div className="mt-0.5 text-[10.5px] text-muted-foreground">Recommended matter is pre-selected — tick more or untick to slim the file.</div>
                  <div className="mt-2 space-y-1">
                    {REPORT_TOPICS.map(t => (
                      <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-muted">
                        <Checkbox checked={topics.includes(t.id)} onCheckedChange={() => toggleTopic(t.id)} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold">{t.label}{t.recommended && <span className="rounded-full bg-[#0c93e7]/15 px-1.5 py-0.5 text-[8px] font-bold text-[#015ca0] dark:text-[#7cc8fb]">REC</span>}</span>
                          <span className="block text-[9.5px] text-muted-foreground">{t.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <button onClick={() => setTopics(DEFAULT_TOPICS)} className="flex-1 rounded-lg border py-1.5 text-[10.5px] font-bold text-muted-foreground hover:bg-muted">Recommended only</button>
                    <button onClick={() => setTopics(REPORT_TOPICS.map(t => t.id))} className="flex-1 rounded-lg border py-1.5 text-[10.5px] font-bold text-muted-foreground hover:bg-muted">Everything</button>
                  </div>
                </PopoverContent>
              </Popover>
              <button onClick={() => askAi(`Give me the recommended action plan and detailed assessment for ${p.name.replace(/,.*$/, "")}`, p.id)} title="Opens Assure Intelligence scoped to THIS project — full recommended system" className="flex items-center gap-1.5 rounded-lg border border-[#0c93e7]/40 bg-[#e0effe]/60 px-3 py-2 text-[12.5px] font-semibold text-[#015ca0] transition dark:bg-[#0c93e7]/10 dark:text-[#7cc8fb]"><Sparkles className="h-3.5 w-3.5" />Ask Intelligence</button>
            </div>
            {p.prediction && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                <div className="relative h-11 w-11 shrink-0">
                  <svg viewBox="0 0 44 44" className="-rotate-90">
                    <circle cx="22" cy="22" r="18" fill="none" className="stroke-border" strokeWidth="6" />
                    <circle cx="22" cy="22" r="18" fill="none" stroke={p.prediction.probability > 0.7 ? "#ef4444" : p.prediction.probability > 0.45 ? "#f59e0b" : "#22c55e"} strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 18 * p.prediction.probability} 999`} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular">{Math.round(p.prediction.probability * 100)}%</span>
                </div>
                <div className="text-[11px] leading-snug">
                  <div className="font-semibold">{p.prediction.isBaseline ? "Baseline (pre-execution) prediction" : "Delay prediction"} · {p.prediction.modelVersion}</div>
                  <div className="text-muted-foreground">{p.prediction.estimatedDays}-day slip · 90% CI {p.prediction.ciLower}–{p.prediction.ciUpper} · conf {Math.round(p.prediction.confidence * 100)}%{p.prediction.isBaseline ? " · sharpens once execution data flows in" : ""}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* v4: how this screen works */}
        <div className="mt-3">
          <PipelineStrip steps={[
            { label: "Evidence (docs, milestones, budget)", hint: "Everything recorded on this project — uploaded documents, milestone states, budget lines — feeds the engine." },
            { label: "Health engine 30/25/20/25", hint: "Schedule, Budget, Resources, Milestones → composite 0–100, recomputed after every change." },
            { label: "Prediction (18 features)", hint: "Delay probability with factor analysis-style factor explanation — Planning projects get a baseline, Active projects full scoring." },
            { label: "Plan of Action", hint: "Recommended actions with owners/deadlines, trackable as interventions through the 7-step lifecycle." },
          ]} />
        </div>

        {/* health dimensions */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {([["Schedule", p.scheduleScore, "30%"], ["Budget", p.budgetScore, "25%"], ["Resources", p.resourceScore, "20%"], ["Milestones", p.milestoneScore, "25%"]] as const).map(([l, v, w]) => (
            <div key={l} className="rounded-lg border bg-muted/25 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{l} <span className="text-muted-foreground/60">· weight {w}</span></span>
                <span className="text-[15px] font-bold tabular" style={{ color: v >= 75 ? "#22c55e" : v >= 50 ? "#f59e0b" : "#ef4444" }}>{Math.round(v)}</span>
              </div>
              <ProgressBar value={v} className="mt-1.5 h-1.5" />
            </div>
          ))}
        </div>
      </div>

      {/* tabs */}
      <div className="custom-scrollbar flex gap-1 overflow-x-auto rounded-xl border bg-card p-1.5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setDetailTab(t.id); }}
            className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition",
              tab === t.id ? "bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]" : "text-muted-foreground hover:bg-muted")}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
            {t.id === "alerts" && p.alerts.filter(a => !a.isRead).length > 0 && <span className="rounded-full bg-[#ef4444] px-1.5 text-[9px] font-bold text-white">{p.alerts.filter(a => !a.isRead).length}</span>}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {tab === "overview" && <OverviewTab p={p} onTab={setTab} />}
          {tab === "milestones" && <MilestonesTab p={p} editable={canEdit} onStatus={(mid, st) => { const r = setMilestoneStatus(p.id, mid, st); if (!r.ok) toast.error("State machine rejection", { description: r.error }); else toast.success("Milestone updated", { description: "Legal transition applied · health & prediction recomputed" }); }} onAdd={() => setMsDialog(true)} />}
          {tab === "tasks" && <TasksTab p={p} editable={canEdit} onMove={(tid, st) => moveTask(p.id, tid, st)} />}
          {tab === "budget" && <BudgetTab p={p} forecast={forecast!} editable={canEdit} />}
          {tab === "resources" && <ResourcesTab p={p} editable={canEdit} onUpdate={(rid, u) => updateResource(p.id, rid, u)} />}
          {tab === "documents" && <DocumentsTab p={p} onDelete={d => { if (user.role === "ADMIN") { deleteDocument(p.id, d); toast.info("Document deleted", { description: "Soft-delete · embeddings purged · audit-logged" }); } }} />}
          {tab === "actions" && <ActionsTab p={p} onAsk={(q) => askAi(q)} />}
          {tab === "risk" && <RiskTab p={p} onPredict={doPredict} predicting={predicting} />}
          {tab === "alerts" && <AlertsTab p={p} onAck={id => { setAckAlert(id); setAckNote(""); }} onRead={id => markAlertRead(p.id, id)} />}
          {tab === "audit" && <AuditTab p={p} />}
        </motion.div>
      </AnimatePresence>

      {/* milestone dialog */}
      <MilestoneDialog open={msDialog} onClose={() => setMsDialog(false)} onAdd={m => { addMilestone(p.id, m); setMsDialog(false); toast.success("Milestone added", { description: "Gantt & critical path recalculated" }); }} />

      {/* ack dialog */}
      <Dialog open={!!ackAlert} onOpenChange={o => !o && setAckAlert(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[15px]">Acknowledge alert with action note</DialogTitle></DialogHeader>
          <p className="text-[12px] text-muted-foreground">Acknowledgement records the action taken, the officer and the timestamp — this closes the R10 human-verification loop and is written to the append-only audit trail.</p>
          <Textarea value={ackNote} onChange={e => setAckNote(e.target.value)} placeholder="e.g., Verified with EE (video call 11:40); revised baseline requested for 5 Oct; steel dispatch confirmed in writing." className="min-h-24 text-[12.5px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAckAlert(null)}>Cancel</Button>
            <Button disabled={ackNote.trim().length < 8} onClick={() => { acknowledgeAlert(p.id, ackAlert!, ackNote); setAckAlert(null); toast.success("Alert acknowledged", { description: "Action recorded · R10 loop closed · audit-logged" }); }}><Check className="h-4 w-4" />Acknowledge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── OVERVIEW ────────────────────────────────────────────────────────────────
function OverviewTab({ p, onTab }: { p: NonNullable<ReturnType<typeof useApp.getState>["projects"][number]>; onTab: (t: string) => void }) {
  const features = extractFeatures(p);
  const elapsed = features.elapsed_ratio;
  const exec = buildExecutiveSummary(p);
  const kpis = p.kpis ?? seedKpis(p);
  const reg = useMemo(() => deriveRiskRegister(p), [p]);
  const VERDICT_STYLE = {
    GOOD: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/25 dark:bg-emerald-500/10",
    WATCH: "border-sky-200 bg-sky-50/60 dark:border-sky-500/25 dark:bg-sky-500/10",
    ATTENTION: "border-amber-200 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-500/10",
    CRITICAL: "border-rose-200 bg-rose-50/60 dark:border-rose-500/25 dark:bg-rose-500/10",
  } as const;
  return (
    <div className="space-y-4">
      {/* Executive summary — plain language, first thing an authority reads */}
      <div className={cn("rounded-xl border p-5", VERDICT_STYLE[exec.verdict])}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-bold tracking-tight">Executive summary</span>
          <span className="rounded-full bg-background px-2.5 py-0.5 text-[10.5px] font-bold shadow-sm">{exec.headline}</span>
          <button onClick={() => onTab("actions")} className="ml-auto flex items-center gap-1 rounded-lg bg-background px-3 py-1.5 text-[11px] font-bold shadow-sm transition hover:scale-[1.02]">
            <Target className="h-3.5 w-3.5" />See the plan of action →
          </button>
        </div>
        <ul className="mt-2.5 space-y-1">
          {exec.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" />{b}
            </li>
          ))}
        </ul>
        <div className="mt-2.5 text-[12px] font-semibold"><InfoTip label="What to do next" body="The recommended response from the intelligence engine, based on this project's own numbers." />{exec.recommendation}</div>
      </div>

      {/* v8: LIVE RISK REGISTER summary — the first thing an officer counts */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SectionTitle icon={ShieldAlert} sub={`${reg.counts.total} live risks · ${reg.counts.documents} from documents · ${reg.counts.engine} from engine signals · ${reg.counts.context} from project context`}>Live risk register</SectionTitle>
          <button onClick={() => onTab("risk")} className="ml-auto flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[11px] font-bold transition hover:border-[#0c93e7]/40">Open full register →</button>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["Overall", reg.overallRisk, reg.riskLevel], ["Time", reg.scheduleRisk, ""], ["Money", reg.budgetRisk, ""], ["People & machines", reg.resourceRisk, ""]].map(([k, v, lv]) => (
            <div key={k as string} className="rounded-lg border bg-muted/25 p-2.5 text-center">
              <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{k}{lv ? ` · ${lv}` : ""}</div>
              <div className="mt-0.5 text-[17px] font-bold tabular" style={{ color: (v as number) > 70 ? "#ef4444" : (v as number) > 45 ? "#f59e0b" : "#22c55e" }}>{v as number}</div>
            </div>
          ))}
        </div>
        <div className="mt-2.5 space-y-1.5">
          {reg.risks.slice(0, 4).map(r => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold", r.severity === "CRITICAL" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300" : r.severity === "HIGH" ? "bg-orange-500/15 text-orange-700 dark:text-orange-300" : r.severity === "MEDIUM" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-sky-500/15 text-sky-700 dark:text-sky-300")}>{r.severity}</span>
              <span className="text-[12px] font-semibold">{r.title}</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold">{RISK_CATEGORY_META[r.category as RiskCategory].label}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{r.source === "document" ? `from ${r.sourceDoc}` : r.source === "engine" ? "live signal" : "project context"}</span>
            </div>
          ))}
          {reg.risks.length > 4 && <button onClick={() => onTab("risk")} className="w-full rounded-lg border border-dashed py-2 text-[11px] font-semibold text-muted-foreground transition hover:border-[#0c93e7]/40 hover:text-foreground">+ {reg.risks.length - 4} more risks on the register →</button>}
        </div>
      </div>

      {/* KPI strip — target vs actual in plain numbers */}
      <div className="rounded-xl border bg-card p-4">
        <SectionTitle icon={GaugeIcon} sub="delivery indicators: target vs actual — what the project produces on the ground">Project KPIs</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-3">
          {kpis.map(k => {
            const pct = k.target > 0 ? Math.round((k.actual / k.target) * 100) : 0;
            return (
              <div key={k.id} className="rounded-lg border bg-muted/25 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold">{k.name}</span>
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[9.5px] font-bold", pct >= 90 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : pct >= 60 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-rose-500/15 text-rose-700 dark:text-rose-300")}>{pct}%</span>
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-[16px] font-bold tabular">{k.actual.toLocaleString("en-IN")}</span>
                  <span className="text-[10.5px] text-muted-foreground">of {k.target.toLocaleString("en-IN")} {k.unit}</span>
                </div>
                <ProgressBar value={Math.min(100, pct)} className="mt-1.5 h-1" />
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
          <SectionTitle icon={FolderOpen} sub={`${p.progress}% physical · ${(elapsed * 100).toFixed(0)}% elapsed · ${features.days_behind_schedule} days behind`}>About & key facts</SectionTitle>
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">{p.description}</p>
          <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[["Sanction", inr(p.totalBudget)], ["Spent", inr(p.spentBudget)], ["Projected", inr(p.projectedBudget)], ["Team", `${p.teamSize} persons`],
              ["Milestones", `${p.milestones.length} total`], ["Delayed MS", `${p.milestones.filter(m => m.status === "DELAYED" || m.status === "BLOCKED").length}`], ["Tasks", `${p.tasks.length}`], ["Documents", `${p.documents.length}`]].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-muted/40 p-2.5"><div className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">{k}</div><div className="mt-0.5 text-[13.5px] font-bold tabular">{v}</div></div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <SectionTitle icon={ShieldAlert} sub="worst first, click to acknowledge">Recent alerts</SectionTitle>
            <div className="space-y-2">
              {p.alerts.slice(0, 3).map(a => (
                <div key={a.id} className="rounded-lg border p-2.5">
                  <div className="flex items-center gap-2"><span className={cn("h-1.5 w-1.5 rounded-full", a.severity === "CRITICAL" ? "bg-[#ef4444]" : a.severity === "HIGH" ? "bg-[#f97316]" : "bg-[#f59e0b]")} /><span className="text-[11.5px] font-bold leading-snug">{a.title}</span>{!a.isRead && <span className="ml-auto rounded bg-[#ef4444] px-1 text-[8.5px] font-bold text-white">UNREAD</span>}</div>
                  <div className="mt-1 line-clamp-2 text-[10.5px] text-muted-foreground">{a.recommendedAction}</div>
                </div>
              ))}
              {p.alerts.length === 0 && <div className="text-[11.5px] text-muted-foreground">No alerts — monitoring continues on the 6-hour cron.</div>}
            </div>
            <button onClick={() => onTab("alerts")} className="mt-2.5 w-full rounded-lg border py-2 text-[11.5px] font-semibold transition hover:bg-muted">All {p.alerts.length} alerts →</button>
          </div>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-5">
        <SectionTitle icon={KanbanSquare} sub="task-level bars · dependency edges · critical path · today marker">Gantt timeline</SectionTitle>
        <GanttTimeline project={p} />
      </div>
    </div>
  );
}

// ─── PLAN OF ACTION (v3): recommended actions + root cause + no-action impact ─
function ActionsTab({ p, onAsk }: { p: NonNullable<ReturnType<typeof useApp.getState>["projects"][number]>; onAsk: (q: string) => void }) {
  const user = useApp(s => s.user)!;
  const createIntervention = useApp(s => s.createIntervention);
  const navigate = useApp(s => s.navigate);
  const acts = buildRecommendedActions(p);
  const impact = projectNoActionImpact(p);
  const tree = buildRootCauseTree(p);

  const PRIORITY_META = {
    1: { label: "Do first", cls: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30" },
    2: { label: "This month", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" },
    3: { label: "Routine", cls: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30" },
  } as const;

  return (
    <div className="space-y-4">
      {/* intro strip */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-[15px] font-bold"><ListChecks className="h-4 w-4 text-[#0c93e7]" />What should the authority do?</h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {acts.length} recommended actions generated from this project's own numbers — each with what is happening, why it matters, the action, its owner and its deadline.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate("interventions")} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11.5px] font-semibold transition hover:bg-muted"><ClipboardList className="h-3.5 w-3.5" />Interventions Centre →</button>
            <button onClick={() => onAsk(`Why is ${p.name.replace(/,.*$/, "")} at risk and what should I do first?`)} className="flex items-center gap-1.5 rounded-lg border border-[#0c93e7]/40 bg-[#e0effe]/60 px-3 py-1.5 text-[11.5px] font-semibold text-[#015ca0] transition dark:bg-[#0c93e7]/10 dark:text-[#7cc8fb]"><Sparkles className="h-3.5 w-3.5" />Ask Assure Intelligence</button>
          </div>
        </div>
      </div>

      {/* recommended actions */}
      <div className="space-y-2.5">
        {acts.map(a => {
          const pm = PRIORITY_META[a.priority];
          const area = ACTION_AREA_META[a.area];
          return (
            <div key={a.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-bold", pm.cls)}>{pm.label}</span>
                <span title={area.hint} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">{area.icon} {area.label}</span>
                <span className="text-[13px] font-bold">{a.title}</span>
              </div>
              <div className="mt-2.5 grid gap-2 md:grid-cols-3">
                <div className="rounded-lg bg-muted/40 p-2.5">
                  <div className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground"><InfoTip label="What is happening" body="The measured fact, straight from the project data." />What</div>
                  <div className="mt-0.5 text-[11.5px] leading-relaxed">{a.what}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2.5">
                  <div className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground"><InfoTip label="Why it matters" body="The plain-language consequence of ignoring this." />Why it matters</div>
                  <div className="mt-0.5 text-[11.5px] leading-relaxed">{a.why}</div>
                </div>
                <div className="rounded-lg border border-[#0c93e7]/25 bg-[#e0effe]/40 p-2.5 dark:bg-[#0c93e7]/10">
                  <div className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-[#015ca0] dark:text-[#7cc8fb]">Do this</div>
                  <div className="mt-0.5 text-[11.5px] leading-relaxed font-medium">{a.action}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">Owner: <strong className="text-foreground">{a.owner}</strong> · deadline: <strong className="text-foreground">{a.deadline}</strong></div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10.5px] text-muted-foreground">Expected impact: <strong className="text-foreground">{a.expectedImpact}</strong></span>
                {can(user, "intervention:manage") && (
                  <Button size="sm" variant="outline" onClick={() => {
                    const iv = createIntervention(p.id, a.title, a.what, a.why, a.priority === 1 ? "HIGH" : a.priority === 2 ? "MEDIUM" : "LOW", [a.action]);
                    if (iv) toast.success(`Tracked as intervention ${iv.code}`, { description: `Assigned to ${iv.assignedTo} · follow it to closure in the Interventions Centre` });
                  }}><ClipboardList className="h-3.5 w-3.5" />Track as intervention</Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* no-action impact */}
      <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-5 dark:border-amber-500/25 dark:bg-amber-500/5">
        <SectionTitle icon={TrendingDown} sub="the cost of waiting — same drift rates the prediction model uses">What happens if we do nothing?</SectionTitle>
        <div className="grid gap-2.5 sm:grid-cols-4">
          {[
            { label: "Risk today", v: impact.riskToday, cls: impact.riskToday > 50 ? "text-rose-600 dark:text-rose-400" : "" },
            { label: "In 30 days", v: impact.risk30, cls: "text-amber-600 dark:text-amber-400" },
            { label: "In 60 days", v: impact.risk60, cls: "text-amber-600 dark:text-amber-400" },
            { label: "In 90 days", v: impact.risk90, cls: "text-rose-600 dark:text-rose-400" },
          ].map(t => (
            <div key={t.label} className="rounded-lg border bg-background p-3">
              <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">{t.label}</div>
              <div className={cn("mt-0.5 text-[20px] font-bold tabular", t.cls)}>{t.v}<span className="ml-0.5 text-[10px] font-normal text-muted-foreground">/100 risk</span></div>
            </div>
          ))}
        </div>
        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border bg-background p-3 text-[12px]">Projected final cost if untouched: <strong>{inr(impact.cost90)}</strong> <span className="text-muted-foreground">(today's estimate {inr(impact.costToday)})</span></div>
          <div className="rounded-lg border bg-background p-3 text-[12px]">Expected delay if untouched: <strong>{impact.delay90} days</strong> <span className="text-muted-foreground">(today {impact.delayToday} days)</span></div>
        </div>
        <p className="mt-2.5 text-[11.5px] leading-relaxed">{impact.narrative}</p>
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[11.5px] font-semibold text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
          With the recommended interventions applied, the 90-day risk estimate drops to ≈ {impact.riskWithIntervention}/100.
        </div>
      </div>

      {/* root-cause tree */}
      <div className="rounded-xl border bg-card p-5">
        <SectionTitle icon={GitBranch} sub="why is this project behind? — cause, not symptom">Root-cause analysis</SectionTitle>
        <div className="custom-scrollbar overflow-x-auto">
          <div className="min-w-[560px] space-y-2">
            <div className="rounded-lg bg-[#072b49] px-3 py-2 text-[12px] font-bold text-white">{tree.label}</div>
            <div className="grid grid-cols-3 gap-2">
              {tree.children.map(c => (
                <div key={c.id} className="rounded-lg border p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] font-bold">{c.label}</span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular">{c.weight}%</span>
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {c.children.map(cc => (
                      <div key={cc.id} className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1 text-[10.5px]">
                        <span className="truncate">{cc.label}</span>
                        <span className="shrink-0 tabular text-muted-foreground">{cc.weight}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-[10.5px] leading-relaxed text-muted-foreground">
              Weights derive from the prediction model's factor contributions (schedule / resource / approval mix). Attack the highest branch first — that is where recovery time is cheapest.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MILESTONES ──────────────────────────────────────────────────────────────
function MilestonesTab({ p, editable, onStatus, onAdd }: { p: NonNullable<ReturnType<typeof useApp.getState>["projects"][number]>; editable: boolean; onStatus: (mid: string, st: Milestone["status"]) => void; onAdd: () => void }) {
  const NEXT: Record<Milestone["status"], Milestone["status"][]> = {
    PENDING: ["IN_PROGRESS"], IN_PROGRESS: ["COMPLETED", "DELAYED", "PENDING"], COMPLETED: [], DELAYED: ["IN_PROGRESS", "COMPLETED"], BLOCKED: ["IN_PROGRESS", "PENDING"],
  };
  return (
    <div className="rounded-xl border bg-card p-5">
      <SectionTitle icon={Flag} sub="state-machine validated transitions (409 on illegal moves)" right={editable && <Button size="sm" onClick={onAdd}><Plus className="h-3.5 w-3.5" />Add milestone</Button>}>Milestones</SectionTitle>
      <div className="space-y-2">
        {[...p.milestones].sort((a, b) => a.order - b.order).map(m => {
          const late = m.actualDate && new Date(m.actualDate) > new Date(m.plannedDate);
          return (
            <div key={m.id} className={cn("flex flex-wrap items-center gap-3 rounded-lg border p-3", m.isCritical && (m.status === "DELAYED" || m.status === "BLOCKED") && "border-rose-200 bg-rose-50/40 dark:border-rose-500/25 dark:bg-rose-500/5")}>
              <div className="flex items-center gap-2 w-8 shrink-0 justify-center">
                {m.isCritical ? <span className="text-[13px] text-[#ef4444]" title="Critical path — zero float">◆</span> : <span className="text-[10px] text-muted-foreground">○</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12.5px] font-semibold">{m.name}</span>
                  <MsBadge status={m.status} />
                  {late && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9.5px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{Math.round((new Date(m.actualDate!).getTime() - new Date(m.plannedDate).getTime()) / 86400000)}d late</span>}
                </div>
                <div className="mt-0.5 text-[10.5px] text-muted-foreground">Planned {shortDate(m.plannedDate)}{m.actualDate ? ` · actual ${shortDate(m.actualDate)}` : ""} · weight {m.weight}</div>
                <ProgressBar value={m.progress} className="mt-1.5 h-1.5 max-w-48" />
              </div>
              {editable && NEXT[m.status].length > 0 && (
                <Select onValueChange={v => onStatus(m.id, v as Milestone["status"])}>
                  <SelectTrigger className="h-8 w-36 text-[11px]"><span className="text-muted-foreground">Transition →</span></SelectTrigger>
                  <SelectContent>{NEXT[m.status].map(s => <SelectItem key={s} value={s}>{m.status} → {s}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MilestoneDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (m: Omit<Milestone, "id" | "projectId" | "order">) => void }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10));
  const [critical, setCritical] = useState(false);
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-[15px]">Add milestone</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-[11.5px]">Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Transmission line energisation" className="text-[13px]" /></div>
          <div><Label className="text-[11.5px]">Planned date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="text-[13px]" /></div>
          <div className="flex items-center justify-between rounded-lg border p-3"><div><div className="text-[12.5px] font-semibold">Critical-path milestone</div><div className="text-[10.5px] text-muted-foreground">Zero float — slip moves the end date directly</div></div><Switch checked={critical} onCheckedChange={setCritical} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={name.length < 4} className="bg-gradient-to-r from-[#0b426e] to-[#0c93e7]" onClick={() => onAdd({ name, status: "PENDING", plannedDate: new Date(date).toISOString(), weight: critical ? 1.5 : 1, isCritical: critical, progress: 0 })}>Add milestone</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── TASKS (Kanban) ──────────────────────────────────────────────────────────
const COLUMNS: { id: TaskStatus; label: string; hint: string }[] = [
  { id: "NOT_STARTED", label: "Backlog", hint: "not started" },
  { id: "IN_PROGRESS", label: "In progress", hint: "WIP ≤ 5 rule" },
  { id: "BLOCKED", label: "Blocked", hint: "dependency wait" },
  { id: "COMPLETED", label: "Done", hint: "closure + QA" },
];

function TasksTab({ p, editable, onMove }: { p: NonNullable<ReturnType<typeof useApp.getState>["projects"][number]>; editable: boolean; onMove: (tid: string, st: TaskStatus) => void }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const col = e.over?.id as TaskStatus | undefined;
    if (col && editable) onMove(id, col);
    else if (col && !editable) toast.error("RBAC: your role cannot move tasks on this project");
    setActiveId(null);
  };
  return (
    <DndContext onDragStart={e => setActiveId(String(e.active.id))} onDragEnd={onDragEnd}>
      <div className="grid gap-3 md:grid-cols-4">
        {COLUMNS.map(col => {
          const items = p.tasks.filter(t => t.status === col.id);
          return <KanbanColumn key={col.id} col={col} items={items} editable={editable} activeId={activeId} />;
        })}
      </div>
      <div className="mt-3 rounded-lg border bg-muted/30 px-3.5 py-2.5 text-[11px] text-muted-foreground">
        Drag cards between columns (dnd-kit) — every move recomputes the health engine, logs <span className="font-mono">task:moved</span> to the audit trail and broadcasts to the project room. WIP limit: 5 in-progress tasks per assignee (production rule).
      </div>
    </DndContext>
  );
}

function KanbanColumn({ col, items, editable, activeId }: { col: typeof COLUMNS[number]; items: Task[]; editable: boolean; activeId: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const color = { NOT_STARTED: "#94a3b8", IN_PROGRESS: "#0c93e7", BLOCKED: "#ef4444", COMPLETED: "#22c55e", CANCELLED: "#64748b" }[col.id];
  return (
    <div ref={setNodeRef} className={cn("rounded-xl border bg-card p-2.5 transition", isOver && editable && "border-[#0c93e7] ring-2 ring-[#0c93e7]/25")}>
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="text-[12px] font-bold">{col.label}</span>
        <span className="ml-auto rounded-full bg-muted px-1.5 text-[10px] font-bold tabular">{items.length}</span>
      </div>
      <div className="custom-scrollbar max-h-[420px] space-y-2 overflow-y-auto pr-0.5">
        {items.map(t => <KanbanCard key={t.id} t={t} draggable={editable} dim={activeId === t.id} />)}
        {items.length === 0 && <div className="rounded-lg border border-dashed py-6 text-center text-[10.5px] text-muted-foreground">empty</div>}
      </div>
      <div className="mt-1.5 px-1 text-[9.5px] text-muted-foreground">{col.hint}</div>
    </div>
  );
}

function KanbanCard({ t, draggable, dim }: { t: Task; draggable: boolean; dim: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: t.id, disabled: !draggable });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      className={cn("cursor-grab touch-none rounded-lg border bg-card p-2.5 shadow-sm transition active:cursor-grabbing", isDragging && "opacity-50 ring-2 ring-[#0c93e7]", dim && "opacity-40", t.isCritical && "border-l-[3px] border-[#ef4444]")}>
      <div className="text-[11.5px] font-semibold leading-snug">{t.name}</div>
      <div className="mt-1.5 flex items-center justify-between text-[9.5px] text-muted-foreground">
        <span className="flex items-center gap-1"><Users2 className="h-3 w-3" />{t.assignee}</span>
        <span className="tabular">{t.progress}%</span>
      </div>
      <ProgressBar value={t.progress} className="mt-1 h-1" />
      {t.dependsOn.length > 0 && <div className="mt-1.5 flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[9px] text-muted-foreground"><TrendingDown className="h-2.5 w-2.5" />{t.dependsOn.length} dependency</div>}
    </div>
  );
}

// ─── BUDGET ──────────────────────────────────────────────────────────────────
function BudgetTab({ p, forecast, editable }: { p: NonNullable<ReturnType<typeof useApp.getState>["projects"][number]>; forecast: ReturnType<typeof computeBudgetForecast>; editable: boolean }) {
  const addBudgetRecord = useApp(s => s.addBudgetRecord);
  const addBudgetOpen = useApp.getState; // placeholder
  const [dialog, setDialog] = useState(false);
  const [month, setMonth] = useState(9);
  type BudgetCat = "CONSTRUCTION" | "MATERIALS" | "HUMAN_RESOURCES" | "EQUIPMENT" | "OTHER";
  const [category, setCategory] = useState<BudgetCat>("CONSTRUCTION");
  const [planned, setPlanned] = useState(300);
  const [spent, setSpent] = useState(310);

  const byMonth = useMemo(() => {
    const m = new Map<string, { planned: number; spent: number }>();
    for (const r of p.budgetRecords) { const k = monthLabel(r.month, r.year); const e = m.get(k) ?? { planned: 0, spent: 0 }; e.planned += r.planned; e.spent += r.spent; m.set(k, e); }
    return [...m.entries()].map(([k, v]) => ({ month: k, ...v }));
  }, [p.budgetRecords]);

  const chart = [...byMonth.map(b => ({ month: b.month, planned: Math.round(b.planned), actual: Math.round(b.spent), projected: null as number | null, lower: null as number | null, upper: null as number | null })),
  ...forecast.points.filter(x => x.actual === null).map(x => ({ month: monthLabel(x.month, x.year), planned: null as number | null, actual: null, projected: x.projected, lower: x.lower, upper: x.upper }))];

  const overrunPct = ((p.projectedBudget - p.totalBudget) / p.totalBudget) * 100;
  const categories = useMemo(() => {
    const m = new Map<string, { planned: number; spent: number }>();
    for (const r of p.budgetRecords) { const e = m.get(r.category) ?? { planned: 0, spent: 0 }; e.planned += r.planned; e.spent += r.spent; m.set(r.category, e); }
    return [...m.entries()];
  }, [p.budgetRecords]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[["Sanctioned", inr(p.totalBudget), ""], ["Spent to date", inr(p.spentBudget), `${Math.round(p.spentBudget / p.totalBudget * 100)}%`], ["Projected final", inr(p.projectedBudget), `${overrunPct > 0 ? "+" : ""}${overrunPct.toFixed(1)}%`], ["Monthly burn", inr(forecast.monthlyBurn), forecast.breachMonth ? `breach ${forecast.breachMonth}` : "within sanction"]].map(([k, v, note]) => (
          <div key={k} className="rounded-xl border bg-card p-3.5"><div className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">{k}</div><div className="mt-1 text-[16px] font-bold tabular">{v}</div>{note && <div className={cn("text-[10.5px] font-semibold", overrunPct > 20 && k === "Projected final" ? "text-rose-600 dark:text-rose-400" : overrunPct > 10 && k === "Projected final" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{note}</div>}</div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <SectionTitle icon={IndianRupee} sub="planned (actuals) vs cost projection with 80% band · dashed = sanctioned"
          right={editable && <Button size="sm" onClick={() => setDialog(true)}><Plus className="h-3.5 w-3.5" />Post budget line</Button>}>
          Burn & forecast
        </SectionTitle>
        <div className="h-[300px]">
          <ResponsiveContainer>
            <ComposedChart data={chart} margin={{ top: 8, right: 10, left: -6, bottom: 0 }}>
              <defs>
                <linearGradient id="ci" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.22} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.04} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 9.5, fill: "#64748b" }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={44} />
              <YAxis tick={{ fontSize: 9.5, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 100)}Cr`} />
              <RTooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} formatter={(v: number, n: string) => [inr(v), n]} />
              <ReferenceLine y={p.totalBudget} stroke="#ef4444" strokeDasharray="6 3" label={{ value: "Sanctioned", position: "insideTopRight", fontSize: 9, fill: "#ef4444" }} />
              <Area type="monotone" dataKey="upper" stroke="none" fill="url(#ci)" />
              <Line type="monotone" dataKey="planned" stroke="#0b426e" strokeWidth={2} dot={false} connectNulls animationDuration={800} />
              <Line type="monotone" dataKey="actual" stroke="#22c55e" strokeWidth={2.4} dot={false} connectNulls animationDuration={800} />
              <Line type="monotone" dataKey="projected" stroke="#8b5cf6" strokeWidth={2.2} strokeDasharray="6 3" dot={false} connectNulls animationDuration={800} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <SectionTitle icon={IndianRupee} sub="category totals (₹ lakh)">Category breakdown</SectionTitle>
          <table className="w-full text-[12px]">
            <thead><tr className="border-b text-[9.5px] uppercase tracking-wider text-muted-foreground"><th className="py-2 text-left font-semibold">Category</th><th className="py-2 text-right font-semibold">Planned</th><th className="py-2 text-right font-semibold">Spent</th><th className="py-2 text-right font-semibold">Var</th></tr></thead>
            <tbody>
              {categories.map(([c, v]) => (
                <tr key={c} className="border-b last:border-0"><td className="py-2 font-medium">{c.replace(/_/g, " ")}</td><td className="py-2 text-right tabular">{v.planned.toLocaleString("en-IN")}</td><td className="py-2 text-right tabular">{v.spent.toLocaleString("en-IN")}</td><td className={cn("py-2 text-right tabular font-semibold", v.spent - v.planned > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{v.spent - v.planned > 0 ? "+" : ""}{(v.spent - v.planned).toLocaleString("en-IN")}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <SectionTitle icon={FlaskConical} sub="what the threshold engine does next">Overrun rule engine</SectionTitle>
          <div className="space-y-2.5 text-[12px]">
            <div className={cn("rounded-lg border p-3", overrunPct > 20 ? "border-rose-200 bg-rose-50/50 dark:border-rose-500/25 dark:bg-rose-500/5" : "border opacity-60")}>
              <div className="font-bold text-rose-700 dark:text-rose-300">CRITICAL — projected overrun &gt; 20%</div>
              <div className="text-muted-foreground">Ministry dashboard escalation, mandatory review note, weekly re-forecast.</div>
              <div className="mt-1 font-semibold">{overrunPct > 20 ? `ACTIVE — currently +${overrunPct.toFixed(1)}%` : `inactive (currently +${overrunPct.toFixed(1)}%)`}</div>
            </div>
            <div className={cn("rounded-lg border p-3", overrunPct > 10 && overrunPct <= 20 ? "border-amber-200 bg-amber-50/50 dark:border-amber-500/25 dark:bg-amber-500/5" : "border opacity-60")}>
              <div className="font-bold text-amber-700 dark:text-amber-300">WARNING — projected overrun &gt; 10%</div>
              <div className="text-muted-foreground">Notify PM, weekly re-forecast, amber badge on dashboards.</div>
              <div className="mt-1 font-semibold">{overrunPct > 10 && overrunPct <= 20 ? `ACTIVE — currently +${overrunPct.toFixed(1)}%` : "inactive"}</div>
            </div>
            <div className="rounded-lg border p-3 opacity-60">
              <div className="font-bold">EARLY_WARNING — burn velocity +30% for 2 months</div>
              <div className="text-muted-foreground">Fires before the overrun materialises (Bharatmala is the textbook case: +46% for 2 consecutive months).</div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[15px]">Post budget line</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-[11.5px]">Month</Label><Select value={String(month)} onValueChange={v => setMonth(+v)}><SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger><SelectContent>{[6, 7, 8, 9].map(m => <SelectItem key={m} value={String(m)}>{monthLabel(m, 2026)}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-[11.5px]">Category</Label><Select value={category} onValueChange={v => setCategory(v as BudgetCat)}><SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger><SelectContent>{["CONSTRUCTION", "MATERIALS", "HUMAN_RESOURCES", "EQUIPMENT", "OTHER"].map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><Label className="text-[11.5px]">Planned (₹ lakh) — {planned}</Label><Slider value={[planned]} min={10} max={5000} step={10} onValueChange={v => setPlanned(v[0])} /></div>
            <div><Label className="text-[11.5px]">Spent (₹ lakh) — {spent}</Label><Slider value={[spent]} min={0} max={5000} step={10} onValueChange={v => setSpent(v[0])} /></div>
            <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground">Cross-field validation check: spent must be ≥ 0 and consistent with cumulative spend; posting fires budget:updated and re-runs the overrun rules.</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button className="bg-gradient-to-r from-[#0b426e] to-[#0c93e7]" onClick={() => { addBudgetRecord(p.id, { category, month, year: 2026, planned, spent }); setDialog(false); toast.success("Budget line posted", { description: "Burn chart refreshed · overrun rules re-evaluated · audit-logged" }); }}>Post line</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── RESOURCES ───────────────────────────────────────────────────────────────
function ResourcesTab({ p, editable, onUpdate }: { p: NonNullable<ReturnType<typeof useApp.getState>["projects"][number]>; editable: boolean; onUpdate: (rid: string, utilised: number) => void }) {
  const grouped = { HUMAN: [], EQUIPMENT: [], MATERIAL: [] } as Record<string, typeof p.resources>;
  for (const r of p.resources) grouped[r.category].push(r);
  return (
    <div className="rounded-xl border bg-card p-5">
      <SectionTitle icon={Users2} sub="utilisation drives the Resources sub-score (45% band + 30% bottlenecks + 25% adequacy)">Resources & bottlenecks</SectionTitle>
      {(["HUMAN", "EQUIPMENT", "MATERIAL"] as const).map(cat => (
        <div key={cat} className="mb-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {cat === "HUMAN" ? "Workforce" : cat === "EQUIPMENT" ? "Plant & machinery" : "Materials"}
            <span className="rounded-full bg-muted px-1.5 text-[9.5px]">{grouped[cat].length}</span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {grouped[cat].map(r => (
              <div key={r.id} className={cn("rounded-xl border p-3.5", r.utilised > 90 && "border-amber-300 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-500/5")}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="truncate text-[12.5px] font-semibold">{r.name}</span>{r.utilised > 90 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">BOTTLENECK &gt;90%</span>}</div>
                    <div className="text-[10.5px] text-muted-foreground">{r.quantity} {r.unit} · allocated {r.allocated}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[18px] font-bold tabular" style={{ color: r.utilised > 90 ? "#b45309" : r.utilised < 50 ? "#64748b" : "#15803d" }}>{r.utilised}%</div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">utilised</div>
                  </div>
                </div>
                {editable && <Slider value={[r.utilised]} min={0} max={120} step={2} onValueChange={v => onUpdate(r.id, v[0])} className="mt-2" />}
                {!editable && <ProgressBar value={Math.min(100, r.utilised)} className="mt-2 h-1.5" />}
              </div>
            ))}
            {grouped[cat].length === 0 && <div className="rounded-lg border border-dashed p-4 text-center text-[11px] text-muted-foreground">No {cat.toLowerCase()} allocations</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── DOCUMENTS ───────────────────────────────────────────────────────────────
function DocumentsTab({ p, onDelete }: { p: NonNullable<ReturnType<typeof useApp.getState>["projects"][number]>; onDelete: (id: string) => void }) {
  return (
    <div className="space-y-4">
      {/* v8: upload FIRST — the primary action after creating a project */}
      <div className="rounded-xl border bg-card p-5">
        <SectionTitle icon={FlaskConical} sub="what to upload: monthly progress reports, flash reports, budget/expenditure sheets, tender or contract papers, site photos or scans — PDF, image, spreadsheet or text">Upload a document — the pipeline runs live</SectionTitle>
        <DocPipeline project={p} />
      </div>
      <div className="rounded-xl border bg-card p-5">
        <SectionTitle icon={FileText} sub={`every upload is read, structured, validated and added to the live risk register`}>Document vault ({p.documents.length})</SectionTitle>
        <div className="grid gap-2.5 md:grid-cols-2">
          {p.documents.map(d => (
            <div key={d.id} className="group rounded-xl border p-3.5">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e0effe] text-[9px] font-bold text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]">{d.fileType.toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold">{d.fileName}</div>
                  <div className="text-[10px] text-muted-foreground">{d.totalPages} pages · {Math.round(d.fileSize / 1024)} KB · {d.status} · {relTime(d.uploadedAt)} by {d.uploadedBy}</div>
                </div>
                <button onClick={() => onDelete(d.id)} className="rounded-md border p-1.5 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="h-3 w-3 text-rose-500" /></button>
              </div>
              {d.extractedData && (
                <>
                  <div className="mt-2 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{d.summary}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {d.extractedData.fields.slice(0, 4).map(f => <span key={f.field} className="rounded-full bg-muted px-2 py-0.5 font-mono text-[9px]">{f.field}={f.value.slice(0, 14)}</span>)}
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">conf ≥ {Math.min(...d.extractedData.fields.map(f => f.confidence)).toFixed(2)}</span>
                    {d.extractedData.risks.filter(r => !/^No material/.test(r)).length > 0 && (
                      <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[9px] font-semibold text-rose-700 dark:text-rose-300">{d.extractedData.risks.filter(r => !/^No material/.test(r)).length} risks found</span>
                    )}
                  </div>
                  {/* v8: every risk this document contributed to the register */}
                  {d.extractedData.risks.filter(r => !/^No material/.test(r)).length > 0 && (
                    <details className="mt-2 rounded-lg bg-muted/40 px-2.5 py-1.5">
                      <summary className="cursor-pointer text-[10.5px] font-bold text-foreground/80">Risks extracted from this document ({d.extractedData.risks.filter(r => !/^No material/.test(r)).length})</summary>
                      <ul className="mt-1.5 space-y-1">
                        {d.extractedData.risks.filter(r => !/^No material/.test(r)).map((r, i) => <li key={i} className="text-[10px] leading-relaxed text-muted-foreground">• {r}</li>)}
                      </ul>
                    </details>
                  )}
                </>
              )}
            </div>
          ))}
          {p.documents.length === 0 && <EmptyState icon={FileText} title="No documents yet" body="Upload the project's monthly progress report or budget sheet above — each document feeds the live risk register and sharpens the prediction." />}
        </div>
      </div>
    </div>
  );
}

// ─── RISK & INTELLIGENCE ───────────────────────────────────────────────────────────────
function RiskTab({ p, onPredict, predicting }: { p: NonNullable<ReturnType<typeof useApp.getState>["projects"][number]>; onPredict: () => void; predicting: boolean }) {
  const updateProject = useApp(s => s.updateProject);
  const user = useApp(s => s.user)!;
  const editable = canTouchProject(user, p.projectManager);
  const [wiProgress, setWiProgress] = useState(p.progress);
  const [wiSpent, setWiSpent] = useState(p.spentBudget);
  const [wiApplied, setWiApplied] = useState(false);

  const [catFilter, setCatFilter] = useState<RiskCategory | "all">("all");

  const whatIf = useMemo(() => {
    const sim = recomputeProject({ ...p, progress: wiProgress, spentBudget: wiSpent, budgetRecords: p.budgetRecords }, useApp.getState().thresholds);
    return sim;
  }, [p, wiProgress, wiSpent]);

  // v8: the register is ALWAYS live — documents + engine + context. It is
  // recomputed from this project's own data, so it is never empty and never
  // shows a single lonely line: uploads add document-sourced risks instantly.
  const reg = useMemo(() => deriveRiskRegister(p), [p]);
  const shown = catFilter === "all" ? reg.risks : reg.risks.filter(r => r.category === catFilter);
  const catCounts = (Object.keys(RISK_CATEGORY_META) as RiskCategory[]).map(c => ({ c, n: reg.risks.filter(r => r.category === c).length })).filter(x => x.n > 0);

  const factors = p.prediction?.factors ?? [];
  const maxC = Math.max(0.5, ...factors.map(f => Math.abs(f.contribution)));

  return (
    <div className="space-y-4">
      {/* v8: LIVE REGISTER — many risks, categorised, with mitigations */}
      <div className="rounded-xl border bg-card p-5">
        <SectionTitle icon={ShieldAlert} sub={`${reg.counts.total} live risks · recomputed on every upload and data change · sources: documents ${reg.counts.documents} · engine signals ${reg.counts.engine} · project context ${reg.counts.context}`}
          right={<Button size="sm" disabled={predicting} onClick={onPredict}>{predicting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Re-score</Button>}>
          Live risk register ({reg.riskLevel})
        </SectionTitle>
        <div className="grid grid-cols-4 gap-2">
          {[["Time", reg.scheduleRisk], ["Money", reg.budgetRisk], ["People & machines", reg.resourceRisk], ["Overall", reg.overallRisk]].map(([k, v]) => (
            <div key={k as string} className="rounded-lg border p-2.5 text-center"><div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{k}</div><div className="mt-0.5 text-[16px] font-bold tabular" style={{ color: (v as number) > 70 ? "#ef4444" : (v as number) > 45 ? "#f59e0b" : "#22c55e" }}>{v as number}</div></div>
          ))}
        </div>
        {/* category filter chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button onClick={() => setCatFilter("all")} className={cn("rounded-full px-2.5 py-1 text-[10.5px] font-bold transition", catFilter === "all" ? "bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]" : "border text-muted-foreground hover:bg-muted")}>All · {reg.counts.total}</button>
          {catCounts.map(({ c, n }) => (
            <button key={c} onClick={() => setCatFilter(c)} title={RISK_CATEGORY_META[c].hint}
              className={cn("rounded-full px-2.5 py-1 text-[10.5px] font-bold transition", catFilter === c ? "bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]" : "border text-muted-foreground hover:bg-muted")}>
              {RISK_CATEGORY_META[c].label} · {n}
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {shown.map(r => (
            <div key={r.id} className="rounded-xl border p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", r.severity === "CRITICAL" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300" : r.severity === "HIGH" ? "bg-orange-500/15 text-orange-700 dark:text-orange-300" : r.severity === "MEDIUM" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-sky-500/15 text-sky-700 dark:text-sky-300")}>{r.severity}</span>
                <span className="text-[12.5px] font-bold">{r.title}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[9.5px] font-semibold">{RISK_CATEGORY_META[r.category].label}</span>
                <span className="ml-auto flex items-center gap-1.5 text-[9.5px] text-muted-foreground">
                  <span className="rounded-full border px-1.5 py-0.5">{r.source === "document" ? `📄 ${r.sourceDoc}` : r.source === "engine" ? "⚙ live signal" : "🗂 project context"}</span>
                </span>
              </div>
              <div className="mt-1.5 grid gap-2 text-[11px] leading-relaxed text-muted-foreground sm:grid-cols-3">
                <div><strong className="text-foreground/80">What it means:</strong> {r.description}</div>
                <div><strong className="text-foreground/80">What we saw:</strong> <em className="text-[10.5px]">{r.evidence}</em></div>
                <div><strong className="text-foreground/80">What to do:</strong> {r.mitigation}</div>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex flex-1 items-center gap-1.5"><span className="text-[9px] font-bold uppercase text-muted-foreground">Impact</span><ProgressBar value={r.impact} className="h-1.5 flex-1" /></div>
                <div className="flex flex-1 items-center gap-1.5"><span className="text-[9px] font-bold uppercase text-muted-foreground">Likelihood</span><ProgressBar value={r.likelihood} className="h-1.5 flex-1" /></div>
              </div>
            </div>
          ))}
          {shown.length === 0 && <EmptyState icon={ShieldAlert} title="No risks in this category" body="Switch the category filter back to All — the register always holds the full set." />}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <SectionTitle icon={ShieldAlert} sub={`${p.prediction?.modelVersion ?? "no active prediction"} · factor analysis-style log-odds contributions · green reduces risk, red raises it`}
          right={<Button size="sm" disabled={predicting} onClick={onPredict}>{predicting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Re-run prediction</Button>}>
          Factor waterfall (explainability)
        </SectionTitle>
        {factors.length === 0 ? <EmptyState icon={ShieldAlert} title="No prediction for this project yet" body="Press “Run prediction” above — Planning projects get a baseline (pre-execution) risk score; Active projects get the full 18-signal model output." /> : (
          <div className="space-y-2">
            {factors.map(f => {
              const w = (Math.abs(f.contribution) / maxC) * 50;
              const raises = f.contribution > 0;
              return (
                <div key={f.feature} className="grid grid-cols-[170px_1fr] items-center gap-3">
                  <div className="text-right text-[11px] font-semibold leading-tight">{f.label}<div className="text-[9.5px] font-normal text-muted-foreground">{f.valueLabel}</div></div>
                  <div className="relative h-6">
                    <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                    <motion.div initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                      className={cn("absolute top-1 h-4 rounded-sm", raises ? "left-1/2 bg-gradient-to-r from-[#f59e0b] to-[#ef4444]" : "right-1/2 bg-gradient-to-l from-[#0c93e7] to-[#22c55e]")} />
                    <span className="absolute top-1 text-[9.5px] font-bold tabular" style={{ [raises ? "left" : "right"]: `calc(50% + ${w}% + 4px)` } as React.CSSProperties}>{f.contribution > 0 ? "+" : ""}{f.contribution.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
            <div className="mt-3 space-y-1.5 rounded-lg bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
              {factors.slice(0, 3).map(f => <div key={f.feature}>• <strong className="text-foreground">{f.label}</strong> ({f.valueLabel}): {f.plainLanguage}</div>)}
              <div className="pt-1 font-semibold text-foreground/70">R10: advisory probabilities — a human officer must verify before escalation.</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <SectionTitle icon={FlaskConical} sub="adjust inputs → watch health & prediction move (then apply to commit)">What-if simulator</SectionTitle>
          <div className="space-y-4">
            <div><Label className="text-[11.5px]">Physical progress — {wiProgress}% (live: {p.progress}%)</Label><Slider disabled={!editable} value={[wiProgress]} min={0} max={100} step={1} onValueChange={v => { setWiProgress(v[0]); setWiApplied(false); }} /></div>
            <div><Label className="text-[11.5px]">Spent to date — {inr(wiSpent)} (live: {inr(p.spentBudget)})</Label><Slider disabled={!editable} value={[wiSpent]} min={0} max={p.totalBudget * 1.4} step={Math.max(50, Math.round(p.totalBudget / 100))} onValueChange={v => { setWiSpent(v[0]); setWiApplied(false); }} /></div>
            <div className="grid grid-cols-5 gap-2">
              {[["Health", p.healthScore, whatIf.healthScore], ["Sched", p.scheduleScore, whatIf.scheduleScore], ["Budget", p.budgetScore, whatIf.budgetScore], ["Res", p.resourceScore, whatIf.resourceScore], ["Milst", p.milestoneScore, whatIf.milestoneScore]].map(([k, was, now]) => (
                <div key={k as string} className="rounded-lg border p-2 text-center">
                  <div className="text-[9px] font-bold uppercase text-muted-foreground">{k}</div>
                  <div className="text-[15px] font-bold tabular">{Math.round(now as number)}</div>
                  <div className={cn("text-[9px] font-bold tabular", (now as number) > (was as number) ? "text-emerald-600 dark:text-emerald-400" : (now as number) < (was as number) ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>{(now as number) - (was as number) > 0 ? "+" : ""}{((now as number) - (was as number)).toFixed(1)}</div>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
              Prediction preview: <strong className="text-foreground">{whatIf.prediction ? `${Math.round(whatIf.prediction.probability * 100)}% delay probability · ${whatIf.prediction.estimatedDays}-day slip (CI ${whatIf.prediction.ciLower}–${whatIf.prediction.ciUpper})` : "no prediction yet — press Run prediction"}</strong>. Threshold bands use the admin-configured amber/red values.
            </div>
            <Button disabled={!editable || (wiProgress === p.progress && wiSpent === p.spentBudget)} className="w-full bg-gradient-to-r from-[#0b426e] to-[#0c93e7]"
              onClick={() => { updateProject(p.id, { progress: wiProgress, spentBudget: wiSpent }); setWiApplied(true); toast.success("What-if applied", { description: "Live data updated · engine recomputed · alert rules re-evaluated · audit-logged" }); }}>
              {wiApplied ? <><Check className="h-4 w-4" />Applied — recomputed</> : "Apply to live data"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ALERTS ──────────────────────────────────────────────────────────────────
function AlertsTab({ p, onAck, onRead }: { p: NonNullable<ReturnType<typeof useApp.getState>["projects"][number]>; onAck: (id: string) => void; onRead: (id: string) => void }) {
  const sorted = [...p.alerts].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || +new Date(b.createdAt) - +new Date(a.createdAt));
  return (
    <div className="rounded-xl border bg-card p-5">
      <SectionTitle icon={ShieldAlert} sub={`${p.alerts.filter(a => !a.isRead).length} unread · ${p.alerts.filter(a => a.actionTaken).length} acknowledged with action`}>Project alerts</SectionTitle>
      <div className="space-y-2.5">
        {sorted.map(a => (
          <div key={a.id} className={cn("rounded-xl border p-3.5", !a.isRead && "border-l-[3px] border-l-[#0c93e7]")}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", a.severity === "CRITICAL" ? "bg-[#fee2e2] text-[#b91c1c] dark:bg-[#ef4444]/15 dark:text-[#fca5a5]" : a.severity === "HIGH" ? "bg-[#ffedd5] text-[#c2410c] dark:bg-orange-500/15 dark:text-orange-300" : a.severity === "MEDIUM" ? "bg-[#fef3c7] text-[#b45309] dark:bg-amber-500/15 dark:text-amber-300" : "bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]")}>{a.severity}</span>
              <span className="text-[12.5px] font-bold">{a.title}</span>
              <span className="ml-auto text-[10px] tabular text-muted-foreground">{relTime(a.createdAt)}</span>
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">{a.description}</p>
            <div className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-[11px] leading-relaxed">
              <div className="font-semibold text-foreground/80">Recommended action</div>
              <div className="text-muted-foreground">{a.recommendedAction}</div>
              <div className="mt-0.5 text-[10.5px]">Owner: <strong>{a.recommendedOwner}</strong> · deadline: <strong>{a.recommendedDeadline}</strong></div>
            </div>
            {a.actionTaken && (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-[11px] leading-relaxed dark:border-emerald-500/25 dark:bg-emerald-500/5">
                <strong className="text-emerald-700 dark:text-emerald-300">Acknowledged by {a.acknowledgedBy}:</strong> {a.actionTaken}
              </div>
            )}
            <div className="mt-2.5 flex gap-2">
              {!a.isRead && <Button size="sm" variant="outline" onClick={() => onRead(a.id)}>Mark read</Button>}
              {!a.actionTaken && can(useApp.getState().user, "alert:ack") && <Button size="sm" onClick={() => onAck(a.id)}><Check className="h-3.5 w-3.5" />Acknowledge with action…</Button>}
            </div>
          </div>
        ))}
        {sorted.length === 0 && <EmptyState icon={ShieldAlert} title="No alerts on this project" body="All clear — the rule engine keeps watching." />}
      </div>
    </div>
  );
}

// ─── AUDIT ───────────────────────────────────────────────────────────────────
function AuditTab({ p }: { p: NonNullable<ReturnType<typeof useApp.getState>["projects"][number]> }) {
  const globalAudit = useApp(s => s.globalAudit);
  const entries = useMemo(() => {
    const projectEntries = globalAudit.filter(e => e.entityId === p.id || e.details.includes(p.psId));
    return projectEntries.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)).slice(0, 40);
  }, [globalAudit, p.id, p.psId]);

  const ACTION_COLOR: Record<string, string> = {
    CREATE: "#22c55e", UPDATE: "#0c93e7", DELETE: "#ef4444", LOGIN: "#8b5cf6", LOGOUT: "#94a3b8", EXPORT: "#f59e0b",
    AI_ACCEPT: "#14b8a6", AI_OVERRIDE: "#f97316", ALERT_ACK: "#22c55e", EMAIL_SEND: "#8b5cf6", PREDICTION_RUN: "#0c93e7", UPLOAD: "#f59e0b", SETTINGS: "#94a3b8", MODEL_RETRAIN: "#8b5cf6",
  };

  return (
    <div className="rounded-xl border bg-card p-5">
      <SectionTitle icon={History} sub="append-only · who did what, when, with before→after where relevant">Project audit trail</SectionTitle>
      <div className="custom-scrollbar max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
        {entries.map(e => (
          <div key={e.id} className="flex items-start gap-3 rounded-lg border p-2.5">
            <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold" style={{ background: `${ACTION_COLOR[e.action] ?? "#64748b"}18`, color: ACTION_COLOR[e.action] ?? "#64748b" }}>{e.action}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] leading-snug">{e.details}</div>
              <div className="mt-0.5 text-[9.5px] text-muted-foreground">{e.userName} ({e.userRole}) · {relTime(e.timestamp)} · {new Date(e.timestamp).toLocaleString("en-IN")}</div>
            </div>
          </div>
        ))}
        {entries.length === 0 && <EmptyState icon={History} title="No audit entries yet" body="Every mutation on this project will appear here — nothing is editable or deletable." />}
      </div>
    </div>
  );
}
