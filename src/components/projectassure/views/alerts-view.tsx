"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/store/app-store";
import { SeverityBadge, SectionTitle, EmptyState, Md, PipelineStrip } from "../shared/ui-bits";
import { SEVERITY_RANK, can } from "@/lib/projectassure/permissions";
import { relTime } from "@/lib/projectassure/format";
import { downloadCsv, downloadExcel } from "@/lib/projectassure/reports";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ShieldAlert, Check, Mail, Zap, BookOpen, CheckCheck, ArrowRight, FileDown, Radio } from "lucide-react";
import { LIVE_EVENT_INTERVAL_MS, eventIcon } from "@/lib/projectassure/events";

export default function AlertsView() {
  const user = useApp(s => s.user)!;
  const projects = useApp(s => s.scoped)();
  const markAlertRead = useApp(s => s.markAlertRead);
  const markAllAlertsRead = useApp(s => s.markAllAlertsRead);
  const acknowledgeAlert = useApp(s => s.acknowledgeAlert);
  const simulateCriticalSlip = useApp(s => s.simulateCriticalSlip);
  const alertRules = useApp(s => s.alertRules);
  const toggleAlertRule = useApp(s => s.toggleAlertRule);
  const thresholds = useApp(s => s.thresholds);
  const openProject = useApp(s => s.openProject);
  const navigate = useApp(s => s.navigate);
  const emailSettings = useApp(s => s.emailSettings);

  type SevFilter = "ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  const [filter, setFilter] = useState<SevFilter>("ALL");
  const [showRead, setShowRead] = useState(false);
  const [ack, setAck] = useState<{ pid: string; aid: string } | null>(null);
  const [note, setNote] = useState("");
  const liveEvents = useApp(s => s.liveEvents);
  const liveEventsEnabled = useApp(s => s.liveEventsEnabled);

  // v8 REAL-TIME: new alerts animate in the moment the heartbeat fires them;
  // the feed count ticks live so the page visibly moves while you watch it.
  const [pulse, setPulse] = useState(0);
  const knownIds = useRef<Set<string>>(new Set());
  const [fresh, setFresh] = useState<string[]>([]);

  const all = useMemo(() => projects.flatMap(p => p.alerts.map(a => ({ ...a, project: p }))), [projects]);
  const unread = all.filter(a => !a.isRead);
  const list = useMemo(() => all
    .filter(a => (filter === "ALL" || a.severity === filter) && (showRead || !a.isRead))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || +new Date(b.createdAt) - +new Date(a.createdAt)), [all, filter, showRead]);

  useEffect(() => {
    const check = () => {
      const ids = useApp.getState().scoped().flatMap(p => p.alerts.map(a => a.id));
      const newbies = ids.filter(id => !knownIds.current.has(id));
      if (knownIds.current.size > 0 && newbies.length) setFresh(f => [...newbies, ...f].slice(0, 6));
      ids.forEach(id => knownIds.current.add(id));
      setPulse(p => p + 1);
    };
    const t0 = setTimeout(check, 500);   // first paint: populate quietly
    const t = setInterval(check, 1000);   // then diff live every second
    return () => { clearTimeout(t0); clearInterval(t); };
  }, []);

  const worst = projects.slice().sort((a, b) => a.healthScore - b.healthScore)[0];

  const recordExport = useApp(s => s.recordExport);
  const exportAlerts = (fmt: "csv" | "xlsx") => {
    const rows: (string | number)[][] = [[
      "Severity", "Title", "Project", "PS-ID", "Raised", "Status", "Recommended action", "Owner", "Deadline",
    ], ...list.map(a => [
      a.severity, a.title, (a as { project?: { name?: string } }).project?.name ?? "", (a as { project?: { psId?: string } }).project?.psId ?? "",
      new Date(a.createdAt).toLocaleString("en-IN"), a.isRead ? (a.acknowledgedAt ? "ACKNOWLEDGED" : "READ") : "UNREAD",
      a.recommendedAction ?? "", a.recommendedOwner ?? "", a.recommendedDeadline ?? "",
    ])];
    const name = `projectassure-alerts-${new Date().toISOString().slice(0, 10)}`;
    if (fmt === "csv") downloadCsv(rows, name + ".csv");
    else void downloadExcel({
      meta: { title: "Alerts Export", subtitle: `${list.length} alerts · severity-ranked`, scope: "Early Warnings export", generatedBy: user.name, generatedAt: new Date().toISOString(), classification: "RESTRICTED :: SIH26103" },
      sections: [{ title: "Alerts", blocks: [{ type: "table", head: rows[0].map(String), rows: rows.slice(1).map(r => r.map(String)) }] }],
    }, name, [{ name: "Alerts", rows }]);
    recordExport("Alerts export", fmt, `${list.length} alerts`);
    toast.success(`Alerts ${fmt.toUpperCase()} exported`, { description: `${rows.length - 1} alert rows with actions, owners and deadlines · audit-logged` });
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      {/* v8: real-time status band */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#0c93e7]/30 bg-gradient-to-r from-[#e0effe]/60 to-transparent p-3.5 dark:from-[#0c93e7]/10">
        <span className="relative flex h-2.5 w-2.5"><span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75", liveEventsEnabled ? "animate-ping bg-emerald-400" : "bg-muted-foreground/50")} /><span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", liveEventsEnabled ? "bg-emerald-500" : "bg-muted-foreground/50")} /></span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-bold"><Radio className="h-4 w-4 text-[#0c93e7] dark:text-[#36adf6]" />{liveEventsEnabled ? "Live monitoring is ON — alerts arrive in real time" : "Live monitoring is paused"}</div>
          <div className="text-[10.5px] text-muted-foreground">Heartbeat every {LIVE_EVENT_INTERVAL_MS / 1000} seconds · rule engine re-checked on every data change · {liveEvents.filter(e => e.kind === "new-alert").length} live alert events this session · feed refresh #{pulse}</div>
        </div>
        <div className="ml-auto hidden max-w-[380px] items-center gap-2 md:flex">
          <div className="custom-scrollbar max-h-16 flex-1 space-y-1 overflow-y-auto rounded-lg border bg-card px-2.5 py-1.5">
            {liveEvents.slice(0, 4).map(ev => (
              <div key={ev.id} className="truncate text-[9.5px] text-muted-foreground"><span className="text-[9px]">{eventIcon(ev.kind)}</span> <span className="font-medium text-foreground/80">{ev.title}</span> <span className="tabular">· {relTime(ev.at)}</span></div>
            ))}
          </div>
        </div>
        {fresh.length > 0 && (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300">
              ⚡ {fresh.length} new alert{fresh.length > 1 ? "s" : ""} arrived just now
              <button onClick={() => setFresh([])} className="text-emerald-700/60 hover:text-emerald-700 dark:text-emerald-300/60">✕</button>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Alerts Centre</h1>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{unread.length} unread · {all.filter(a => a.severity === "CRITICAL" && !a.isRead).length} critical · every alert carries an action, owner and deadline</p>
          <div className="mt-2"><PipelineStrip steps={[
            { label: "Data changes", hint: "Every mutation — progress edits, milestone updates, document uploads — re-evaluates the 12 alert rules." },
            { label: "Rules R1–R12", hint: "Threshold rules: overrun bands, delay probability, burn velocity, health bands, report staleness." },
            { label: "Severity-ranked list", hint: "Worst first — each alert explains itself and carries a recommended action with owner and deadline." },
            { label: "Acknowledge → intervene", hint: "Acknowledge with a note (audit-logged), or convert straight into a tracked intervention." },
          ]} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportAlerts("csv")}><FileDown className="h-3.5 w-3.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportAlerts("xlsx")}><FileDown className="h-3.5 w-3.5" />Excel</Button>
          <Button variant="outline" size="sm" onClick={() => { markAllAlertsRead(); toast.success("All alerts marked read"); }}><CheckCheck className="h-3.5 w-3.5" />Mark all read</Button>
          {can(user, "alert:simulate") && worst && (
            <Button size="sm" onClick={() => simulateCriticalSlip(worst.id)} className="bg-gradient-to-r from-[#7c2d12] to-[#ef4444]"><Zap className="h-3.5 w-3.5" />Simulate critical slip ({worst.psId})</Button>
          )}
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5">
        <div className="flex gap-1">
          {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as SevFilter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition",
                filter === f ? f === "CRITICAL" ? "bg-[#fee2e2] text-[#b91c1c] dark:bg-[#ef4444]/15 dark:text-[#fca5a5]" : f === "HIGH" ? "bg-[#ffedd5] text-[#c2410c] dark:bg-orange-500/15 dark:text-orange-300" : f === "MEDIUM" ? "bg-[#fef3c7] text-[#b45309] dark:bg-amber-500/15 dark:text-amber-300" : f === "LOW" ? "bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]" : "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}>
              {f}{f !== "ALL" && <span className="ml-1 tabular opacity-70">{all.filter(a => a.severity === f && !a.isRead).length}</span>}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11.5px] font-medium">
          <Switch checked={showRead} onCheckedChange={setShowRead} id="show-read" /><label htmlFor="show-read">show read</label>
        </div>
      </div>

      {/* alert list */}
      <div className="space-y-2.5">
        {list.length === 0 && <EmptyState icon={ShieldAlert} title="No alerts in this filter" body="You are all caught up — the rule engine keeps watching on every mutation and the 6-hourly cron." />}
        {list.map((a, i) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
            className={cn("rounded-xl border bg-card p-4", !a.isRead && "border-l-[3px] border-l-[#0c93e7]", fresh.includes(a.id) && "ring-2 ring-emerald-500/40")}>
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={a.severity} />
              <span className="text-[13px] font-bold">{a.title}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[9.5px] font-semibold text-muted-foreground">{a.type.replace(/_/g, " ")}</span>
              {a.emailQueued && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9.5px] font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">email queued</span>}
              <span className="ml-auto text-[10px] tabular text-muted-foreground">{relTime(a.createdAt)}</span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{a.description}</p>
            <button onClick={() => openProject(a.project.id)} className="mt-1.5 flex items-center gap-1 text-[11.5px] font-semibold text-[#0c93e7] hover:underline dark:text-[#36adf6]">
              {a.project.name.replace(/,.*$/, "")} · {a.project.psId}<ArrowRight className="h-3 w-3" />
            </button>
            <div className="mt-2.5 grid gap-2 rounded-lg bg-muted/50 px-3 py-2.5 sm:grid-cols-[1fr_auto]">
              <div>
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">Intelligence-recommended action</div>
                <div className="mt-0.5 text-[11.5px] leading-relaxed">{a.recommendedAction}</div>
                <div className="mt-1 text-[10.5px] text-muted-foreground">Owner: <strong className="text-foreground">{a.recommendedOwner}</strong> · deadline: <strong className="text-foreground">{a.recommendedDeadline}</strong></div>
              </div>
              <div className="flex items-end gap-1.5">
                {!a.isRead && <Button size="sm" variant="outline" onClick={() => markAlertRead(a.project.id, a.id)}>Mark read</Button>}
                {!a.actionTaken && can(user, "alert:ack") && <Button size="sm" onClick={() => { setAck({ pid: a.project.id, aid: a.id }); setNote(""); }}><Check className="h-3.5 w-3.5" />Acknowledge…</Button>}
                {a.actionTaken && <span className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5 text-[10.5px] font-semibold text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">acknowledged</span>}
                <Button size="sm" variant="outline" onClick={() => { navigate("email-center"); toast.info("Opened Email Centre", { description: "Compose or forward this alert with the critical_alert template" }); }}><Mail className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            {a.actionTaken && (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-[11px] leading-relaxed dark:border-emerald-500/25 dark:bg-emerald-500/5">
                <strong className="text-emerald-700 dark:text-emerald-300">R10 closed by {a.acknowledgedBy}:</strong> {a.actionTaken}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* rules reference */}
      <div className="rounded-xl border bg-card p-5">
        <SectionTitle icon={BookOpen} sub="live configuration — the engine re-evaluates after every mutation; thresholds from Administration">Alert rules in force</SectionTitle>
        <div className="grid gap-2 md:grid-cols-2">
          {alertRules.map(r => (
            <div key={r.id} className={cn("rounded-lg border p-3", !r.enabled && "opacity-50")}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-bold">{r.name}</span>
                <Switch checked={r.enabled} onCheckedChange={() => can(user, "alerts:manage-rules") ? toggleAlertRule(r.id) : toast.error("Only ADMIN can toggle rules")} />
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{r.description}</div>
              <div className="mt-1 flex gap-1.5">
                <span className="rounded bg-muted px-1.5 py-0.5 text-[9.5px] font-bold">{r.severity}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[9.5px] font-semibold text-muted-foreground">{r.channel}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg bg-muted/40 p-2.5 text-[10.5px] leading-relaxed text-muted-foreground">
          Channel policy: CRITICAL/HIGH → in-app + email ({emailSettings.provider === "smtp-gmail" ? "Gmail email service configured" : "demo outbox — configure EMAIL_USER/EMAIL_PASS for real delivery"}) + WebSocket toast; MEDIUM/LOW → in-app only.
          Current thresholds: amber {thresholds.amberAt} / red {thresholds.redAt} · budget warn {thresholds.budgetWarnPct}% / critical {thresholds.budgetCriticalPct}% · email at {thresholds.delayProbEmailAt}% probability.
          Red-band alerts always require human-officer verification (R10) before escalation.
        </div>
      </div>

      {/* ack dialog */}
      <Dialog open={!!ack} onOpenChange={o => !o && setAck(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[15px]">Acknowledge with action note</DialogTitle></DialogHeader>
          <p className="text-[12px] text-muted-foreground">This closes the R10 human-verification loop: the action, officer and timestamp are written to the append-only audit trail.</p>
          <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g., Verified with the executive engineer (video call 11:40); recovery plan submitted; steel dispatch confirmed in writing by JSW." className="min-h-24 text-[12.5px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAck(null)}>Cancel</Button>
            <Button disabled={note.trim().length < 8} onClick={() => { acknowledgeAlert(ack!.pid, ack!.aid, note); setAck(null); toast.success("Alert acknowledged", { description: "R10 loop closed · audit-logged" }); }}><Check className="h-4 w-4" />Acknowledge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
