"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Interventions Centre — issue → action → closure lifecycle (7 steps).
// "Your system doesn't merely monitor. It manages interventions."
// ═══════════════════════════════════════════════════════════════════════════
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { SeverityBadge, SectionTitle, EmptyState, PipelineStrip } from "../shared/ui-bits";
import { can } from "@/lib/projectassure/permissions";
import { relTime } from "@/lib/projectassure/format";
import { downloadCsv, downloadExcel } from "@/lib/projectassure/reports";
import { INTERVENTION_FLOW, INTERVENTION_STATUS_META, type Intervention, type InterventionStatus } from "@/lib/projectassure/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ClipboardList, Plus, Check, RotateCcw, ArrowRight, Flag, FileCheck2, ChevronRight, FileDown } from "lucide-react";

const STATUS_COLOR: Record<InterventionStatus, string> = {
  DETECTED: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  REVIEWED: "bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]",
  ACTION_ASSIGNED: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  UNDER_INVESTIGATION: "bg-[#fef3c7] text-[#b45309] dark:bg-[#f59e0b]/15 dark:text-[#fcd34d]",
  RESOLVED: "bg-[#ffedd5] text-[#c2410c] dark:bg-orange-500/10 dark:text-orange-300",
  VERIFIED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  CLOSED: "bg-emerald-600 text-white",
};

export default function InterventionsView() {
  const user = useApp(s => s.user)!;
  const projects = useApp(s => s.scoped)();
  const interventions = useApp(s => s.interventions);
  const createIntervention = useApp(s => s.createIntervention);
  const advanceIntervention = useApp(s => s.advanceIntervention);
  const reopenIntervention = useApp(s => s.reopenIntervention);
  const toggleInterventionStep = useApp(s => s.toggleInterventionStep);
  const openProject = useApp(s => s.openProject);

  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "CLOSED">("ALL");
  const [newIv, setNewIv] = useState<{ projectId: string; title: string; issue: string; why: string; severity: Intervention["severity"] } | null>(null);
  const [advance, setAdvance] = useState<{ iv: Intervention; note: string } | null>(null);

  const projectById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const visible = useMemo(() => interventions.filter(iv => projectById.has(iv.projectId)), [interventions, projectById]);
  const list = useMemo(() => visible
    .filter(iv => statusFilter === "ALL" ? true : statusFilter === "CLOSED" ? iv.status === "CLOSED" : iv.status !== "CLOSED")
    .sort((a, b) => +new Date(b.detectedAt) - +new Date(a.detectedAt)), [visible, statusFilter]);

  const openCount = visible.filter(iv => iv.status !== "CLOSED").length;
  const closedCount = visible.filter(iv => iv.status === "CLOSED").length;
  const overdue = visible.filter(iv => iv.status !== "CLOSED" && new Date(iv.deadline) < new Date()).length;

  const recordExport = useApp(s => s.recordExport);
  const exportInterventions = (fmt: "csv" | "xlsx") => {
    const rows: (string | number)[][] = [[
      "Code", "Title", "Project PS-ID", "Severity", "Status", "Step", "Raised by", "Assigned to", "Deadline", "Steps done", "Evidence docs", "Raised",
    ], ...list.map(iv => [
      iv.code, iv.title, projectById.get(iv.projectId)?.psId ?? "", iv.severity, iv.status,
      `${INTERVENTION_FLOW.indexOf(iv.status) + 1}/7`, iv.raisedBy, iv.assignedTo,
      new Date(iv.deadline).toLocaleDateString("en-IN"), `${iv.steps.filter(s => s.done).length}/${iv.steps.length}`,
      iv.evidenceCount, new Date(iv.detectedAt).toLocaleDateString("en-IN"),
    ])];
    const name = `projectassure-interventions-${new Date().toISOString().slice(0, 10)}`;
    if (fmt === "csv") downloadCsv(rows, name + ".csv");
    else void downloadExcel({
      meta: { title: "Interventions Export", subtitle: `${list.length} interventions · 7-step lifecycle`, scope: "Interventions Centre export", generatedBy: user.name, generatedAt: new Date().toISOString(), classification: "RESTRICTED :: SIH26103" },
      sections: [{ title: "Interventions", blocks: [{ type: "table", head: rows[0].map(String), rows: rows.slice(1).map(r => r.map(String)) }] }],
    }, name, [{ name: "Interventions", rows }]);
    recordExport("Interventions export", fmt, `${list.length} interventions`);
    toast.success(`Interventions ${fmt.toUpperCase()} exported`, { description: `${rows.length - 1} rows · lifecycle position, owners, deadlines · audit-logged` });
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Interventions Centre</h1>
          <p className="mt-0.5 max-w-xl text-[12.5px] leading-relaxed text-muted-foreground">
            Every detected issue becomes a tracked intervention with an owner, a deadline and evidence —
            moving through <strong className="text-foreground">7 steps from Detected to Closed</strong>.
            This is what turns monitoring into governance.
          </p>
          <div className="mt-2"><PipelineStrip steps={[
            { label: "Detect", hint: "Alert rules or the Intelligence recommended system flag an exception with a plain-language reason." },
            { label: "Assign", hint: "The intervention gets an owner (usually the project manager) and a deadline." },
            { label: "Track 7 steps", hint: "DETECTED → REVIEWED → ACTION ASSIGNED → INVESTIGATING → RESOLVED → VERIFIED → CLOSED, each step audit-logged." },
            { label: "Close with proof", hint: "Closure requires verification evidence — human-in-the-loop, rule R10." },
          ]} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportInterventions("csv")}><FileDown className="h-3.5 w-3.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportInterventions("xlsx")}><FileDown className="h-3.5 w-3.5" />Excel</Button>
          {can(user, "intervention:manage") && projects.length > 0 && (
            <Button size="sm" onClick={() => setNewIv({ projectId: projects[0].id, title: "", issue: "", why: "", severity: "HIGH" })}>
              <Plus className="h-3.5 w-3.5" />Raise intervention
            </Button>
          )}
        </div>
      </div>

      {/* summary tiles */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {[
          { label: "Open interventions", value: openCount, hint: "in the pipeline now" },
          { label: "Closed with proof", value: closedCount, hint: "verified & archived" },
          { label: "Past deadline", value: overdue, hint: "needs escalation today" },
          { label: "In progress steps", value: visible.reduce((n, iv) => n + iv.steps.filter(s => s.done).length, 0), hint: "corrective steps completed" },
        ].map(t => (
          <div key={t.label} className="rounded-xl border bg-card p-3.5">
            <div className="text-[22px] font-bold tabular leading-none">{t.value}</div>
            <div className="mt-1 text-[11px] font-semibold">{t.label}</div>
            <div className="text-[10px] text-muted-foreground">{t.hint}</div>
          </div>
        ))}
      </div>

      {/* filter */}
      <div className="flex gap-1 rounded-xl border bg-card p-1.5">
        {(["ALL", "OPEN", "CLOSED"] as const).map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={cn("flex-1 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold transition",
              statusFilter === f ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}>
            {f === "ALL" ? "All" : f === "OPEN" ? "Open" : "Closed"} <span className="ml-1 tabular opacity-60">{f === "ALL" ? visible.length : f === "OPEN" ? openCount : closedCount}</span>
          </button>
        ))}
      </div>

      {/* intervention cards */}
      <div className="space-y-3">
        {list.length === 0 && (
          <EmptyState icon={ClipboardList} title="No interventions yet"
            body="Raise one from a project (recommended actions make this one click), or from any alert — the intelligence engine pre-fills the corrective steps for you." />
        )}
        {list.map((iv, i) => {
          const project = projectById.get(iv.projectId)!;
          const stepIdx = INTERVENTION_FLOW.indexOf(iv.status);
          const isClosed = iv.status === "CLOSED";
          const isOverdue = !isClosed && new Date(iv.deadline) < new Date();
          return (
            <motion.div key={iv.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}
              className={cn("rounded-xl border bg-card p-4", isOverdue && "border-l-[3px] border-l-[#ef4444]")}>
              {/* title row */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-foreground px-2 py-0.5 font-mono text-[11px] font-bold text-background">{iv.code}</span>
                <SeverityBadge severity={iv.severity} />
                <span className="text-[13px] font-bold">{iv.title}</span>
                {isOverdue && <span className="rounded-full bg-[#fee2e2] px-2 py-0.5 text-[9.5px] font-bold text-[#b91c1c] dark:bg-[#ef4444]/15 dark:text-[#fca5a5]">past deadline</span>}
                <span className="ml-auto text-[10px] tabular text-muted-foreground">detected {relTime(iv.detectedAt)}</span>
              </div>

              {/* what / why */}
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">What is happening</div>
                  <div className="mt-0.5 text-[11.5px] leading-relaxed">{iv.issue}</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">Why it matters</div>
                  <div className="mt-0.5 text-[11.5px] leading-relaxed">{iv.why}</div>
                </div>
              </div>

              {/* lifecycle tracker */}
              <div className="mt-3 flex items-center gap-0.5 overflow-x-auto pb-1">
                {INTERVENTION_FLOW.map((st, si) => {
                  const done = si < stepIdx;
                  const current = si === stepIdx;
                  const meta = INTERVENTION_STATUS_META[st];
                  return (
                    <React.Fragment key={st}>
                      {si > 0 && <ChevronRight className={cn("h-3 w-3 shrink-0", done ? "text-emerald-500" : "text-muted-foreground/40")} />}
                      <div title={meta.hint} className={cn("shrink-0 rounded-full px-2 py-1 text-[9.5px] font-bold transition",
                        current ? STATUS_COLOR[st] : done ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted/60 text-muted-foreground/60")}>
                        {done && "✓ "}{meta.label}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* meta row */}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <button onClick={() => openProject(iv.projectId)} className="font-semibold text-[#0c93e7] hover:underline dark:text-[#36adf6]">
                  {project.name.replace(/,.*$/, "")} · {project.psId} <ArrowRight className="inline h-3 w-3" />
                </button>
                <span>Assigned to <strong className="text-foreground">{iv.assignedTo}</strong></span>
                <span>Due <strong className={cn("text-foreground", isOverdue && "text-rose-600 dark:text-rose-400")}>{new Date(iv.deadline).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</strong></span>
                <span className="flex items-center gap-1"><FileCheck2 className="h-3 w-3" />{iv.evidenceCount} evidence document{iv.evidenceCount === 1 ? "" : "s"}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[9.5px] font-semibold">raised by {iv.raisedBy}</span>
              </div>

              {/* corrective steps */}
              {iv.steps.length > 0 && (
                <div className="mt-2.5 rounded-lg border p-2.5">
                  <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">Corrective steps — check off as done</div>
                  <div className="mt-1.5 space-y-1.5">
                    {iv.steps.map(st => (
                      <div key={st.id} className="flex items-start gap-2">
                        <button disabled={isClosed} onClick={() => toggleInterventionStep(iv.id, st.id)}
                          className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                            st.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40 hover:border-[#0c93e7]")}>
                          {st.done && <Check className="h-3 w-3" />}
                        </button>
                        <div className={cn("text-[11.5px] leading-snug", st.done && "text-muted-foreground line-through")}>
                          {st.text}
                          <span className="ml-1.5 text-[9.5px] text-muted-foreground">({st.owner} · {st.dueDays}d)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* updates timeline + actions */}
              <div className="mt-2.5 grid gap-2.5 md:grid-cols-[1fr_auto]">
                <div className="custom-scrollbar max-h-24 space-y-1 overflow-y-auto rounded-lg bg-muted/30 p-2">
                  {iv.updates.slice().reverse().map((u, ui) => (
                    <div key={ui} className="text-[10.5px] leading-snug text-muted-foreground">
                      <span className="tabular text-[9.5px] opacity-70">{new Date(u.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>{" "}
                      <strong className="text-foreground/80">{u.by}</strong> — {u.note}
                    </div>
                  ))}
                </div>
                <div className="flex items-end gap-1.5">
                  {!isClosed && can(user, "intervention:advance") && (
                    <Button size="sm" onClick={() => setAdvance({ iv, note: "" })}>
                      <ArrowRight className="h-3.5 w-3.5" />Advance to {INTERVENTION_STATUS_META[INTERVENTION_FLOW[stepIdx + 1]].label}
                    </Button>
                  )}
                  {isClosed && can(user, "intervention:manage") && (
                    <Button size="sm" variant="outline" onClick={() => { reopenIntervention(iv.id, "Reopened for re-inspection"); toast.info("Intervention reopened"); }}>
                      <RotateCcw className="h-3.5 w-3.5" />Reopen
                    </Button>
                  )}
                  {isClosed && iv.resolution && (
                    <span className="max-w-xs rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5 text-[10.5px] leading-snug text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
                      <Flag className="mr-1 inline h-3 w-3" />{iv.resolution}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* how it works explainer */}
      <div className="rounded-xl border bg-card p-5">
        <SectionTitle icon={ClipboardList} sub="plain-language walkthrough for first-time users">How the intervention lifecycle works</SectionTitle>
        <div className="grid gap-2.5 md:grid-cols-2">
          {[
            ["1 · Detected", "ProjectAssure's rule engine or an officer spots a problem (e.g., money moving faster than work)."],
            ["2 · Reviewed", "A human officer confirms the issue is real — the intelligence engine only advises, people decide."],
            ["3 · Action Assigned", "A corrective task is created with a named owner and a deadline — nothing stays anonymous."],
            ["4 · Under Investigation", "The responsible officer works the fix: reconciles bills, chases vendors, re-plans the schedule."],
            ["5 · Resolved", "The fix is done — but it still needs proof before anyone signs off."],
            ["6 · Verified", "Evidence (site photos, inspection notes) is checked and accepted by the authority."],
            ["7 · Closed", "The issue is archived with its full history. If it recurs, it is reopened — never lost."],
            ["Why it matters", "Most dashboards stop at 'there is a problem'. ProjectAssure stays until the problem is finished."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg border bg-muted/30 p-3">
              <div className="text-[12px] font-bold">{t}</div>
              <div className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* new intervention dialog */}
      <Dialog open={!!newIv} onOpenChange={o => !o && setNewIv(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-[15px]">Raise a tracked intervention</DialogTitle></DialogHeader>
          <div className="space-y-2.5">
            <div>
              <Label className="text-[11.5px]">Project</Label>
              <Select value={newIv?.projectId} onValueChange={v => setNewIv(p => p && { ...p, projectId: v })}>
                <SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {projects.slice(0, 40).map(p => <SelectItem key={p.id} value={p.id} className="text-[13px]">{p.psId} — {p.name.replace(/,.*$/, "")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11.5px]">Issue title *</Label>
              <Input value={newIv?.title ?? ""} onChange={e => setNewIv(p => p && { ...p, title: e.target.value })} placeholder="e.g., Financial–physical gap needs review" className="text-[13px]" />
            </div>
            <div>
              <Label className="text-[11.5px]">What is happening *</Label>
              <Textarea value={newIv?.issue ?? ""} onChange={e => setNewIv(p => p && { ...p, issue: e.target.value })} placeholder="Plain language: 76% of money spent, 48% of work done…" className="min-h-16 text-[12.5px]" />
            </div>
            <div>
              <Label className="text-[11.5px]">Why it matters</Label>
              <Textarea value={newIv?.why ?? ""} onChange={e => setNewIv(p => p && { ...p, why: e.target.value })} placeholder="e.g., Paying ahead of progress is the classic early signal of overrun…" className="min-h-14 text-[12.5px]" />
            </div>
            <div>
              <Label className="text-[11.5px]">Severity</Label>
              <Select value={newIv?.severity} onValueChange={v => setNewIv(p => p && { ...p, severity: v as Intervention["severity"] })}>
                <SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map(s => <SelectItem key={s} value={s} className="text-[13px]">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewIv(null)}>Cancel</Button>
            <Button disabled={!newIv || newIv.title.trim().length < 5 || newIv.issue.trim().length < 10}
              onClick={() => {
                const created = createIntervention(newIv!.projectId, newIv!.title.trim(), newIv!.issue.trim(), newIv!.why.trim() || "Impact on cost, schedule or compliance if left unaddressed.", newIv!.severity);
                setNewIv(null);
                if (created) toast.success(`Intervention ${created.code} opened`, { description: `Assigned to ${created.assignedTo} · 7-step lifecycle started` });
                else toast.error("Could not create intervention");
              }}>
              <Plus className="h-4 w-4" />Open intervention
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* advance dialog */}
      <Dialog open={!!advance} onOpenChange={o => !o && setAdvance(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[15px]">Advance {advance?.iv.code}</DialogTitle></DialogHeader>
          <p className="text-[12px] text-muted-foreground">
            Optional note (required when closing — it becomes the permanent resolution record):
          </p>
          <Textarea value={advance?.note ?? ""} onChange={e => setAdvance(a => a && { ...a, note: e.target.value })} placeholder="e.g., Financial review held 12 Sep; billing reconciled with measured work; gap explained in writing." className="min-h-24 text-[12.5px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvance(null)}>Cancel</Button>
            <Button disabled={!!advance && (INTERVENTION_FLOW[INTERVENTION_FLOW.indexOf(advance.iv.status) + 1] === "CLOSED" && advance.note.trim().length < 8)}
              onClick={() => {
                const r = advanceIntervention(advance!.iv.id, advance!.note.trim() || undefined);
                setAdvance(null);
                if (r.ok) toast.success("Status advanced", { description: "Audit-logged with your name and time" });
                else toast.error(r.error === "already_closed" ? "Already closed" : "Could not advance");
              }}>
              <Check className="h-4 w-4" />Advance status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
