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
import { ShieldAlert, Check, Mail, Zap, BookOpen, CheckCheck, ArrowRight, FileDown, Radio, Megaphone, Users, FlaskConical } from "lucide-react";
import { LIVE_EVENT_INTERVAL_MS, eventIcon } from "@/lib/projectassure/events";
import { alertPathwayFor, pathwayApplies } from "@/lib/projectassure/engine";
import type { AlertPathway } from "@/lib/projectassure/types";

type PathwayFilter = "mine" | "demo" | "fresh" | "broadcast" | "all";

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
  const broadcastAlert = useApp(s => (s as { broadcastAlert?: (title: string, message: string, severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW") => void }).broadcastAlert ?? (() => {}));

  type SevFilter = "ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  const [filter, setFilter] = useState<SevFilter>("ALL");
  // v13: pathway filter — defaults to "mine" so fresh users see only their own lane
  const isFreshUser = user.source === "registered";
  const [pathwayFilter, setPathwayFilter] = useState<PathwayFilter>(isFreshUser ? "fresh" : "demo");
  const [showRead, setShowRead] = useState(false);
  const [ack, setAck] = useState<{ pid: string; aid: string } | null>(null);
  const [note, setNote] = useState("");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastSev, setBroadcastSev] = useState<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW">("HIGH");
  const liveEvents = useApp(s => s.liveEvents);
  const liveEventsEnabled = useApp(s => s.liveEventsEnabled);

  // v8 REAL-TIME: new alerts animate in the moment the heartbeat fires them;
  // the feed count ticks live so the page visibly moves while you watch it.
  const [pulse, setPulse] = useState(0);
  const knownIds = useRef<Set<string>>(new Set());
  const [fresh, setFresh] = useState<string[]>([]);

  // ─── v13: derive pathway for each (alert, project, user) triple ───
  const all = useMemo(() => projects.flatMap(p => p.alerts.map(a => {
    const pathway: AlertPathway = a.pathway ?? alertPathwayFor(p, user);
    return { ...a, project: p, pathway };
  })), [projects, user]);

  // ─── Pathway counts for the selector ───
  const pathwayCounts = useMemo(() => ({
    demo: all.filter(a => a.pathway === "demo" && !a.isRead).length,
    fresh: all.filter(a => a.pathway === "fresh" && !a.isRead).length,
    broadcast: all.filter(a => a.pathway === "broadcast" && !a.isRead).length,
    mine: isFreshUser
      ? all.filter(a => (a.pathway === "fresh" || a.pathway === "broadcast") && !a.isRead).length
      : all.filter(a => (a.pathway === "demo" || a.pathway === "broadcast") && !a.isRead).length,
    all: all.filter(a => !a.isRead).length,
  }), [all, isFreshUser]);

  const unread = all.filter(a => !a.isRead);
  const list = useMemo(() => all
    .filter(a => {
      // severity filter
      if (filter !== "ALL" && a.severity !== filter) return false;
      // read filter
      if (!showRead && a.isRead) return false;
      // v13: pathway filter
      if (pathwayFilter === "all") return true;
      if (pathwayFilter === "mine") {
        return isFreshUser ? (a.pathway === "fresh" || a.pathway === "broadcast") : (a.pathway === "demo" || a.pathway === "broadcast");
      }
      if (pathwayFilter === "demo") return a.pathway === "demo";
      if (pathwayFilter === "fresh") return a.pathway === "fresh";
      if (pathwayFilter === "broadcast") return a.pathway === "broadcast";
      return true;
    })
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || +new Date(b.createdAt) - +new Date(a.createdAt)), [all, filter, showRead, pathwayFilter, isFreshUser]);

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
      "Severity", "Title", "Project", "PS-ID", "Pathway", "Raised", "Status", "Recommended action", "Owner", "Deadline",
    ], ...list.map(a => [
      a.severity, a.title, (a as { project?: { name?: string } }).project?.name ?? "", (a as { project?: { psId?: string } }).project?.psId ?? "",
      a.pathway ?? "demo",
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

  // ─── Pathway selector tabs ───
  const pathwayTabs: { id: PathwayFilter; label: string; count: number; icon: React.ElementType; tone: string }[] = [
    { id: "mine", label: isFreshUser ? "My alerts" : "My demo alerts", count: pathwayCounts.mine, icon: ShieldAlert, tone: "bg-[#0b426e] text-white" },
    { id: "demo", label: "Demo lane", count: pathwayCounts.demo, icon: FlaskConical, tone: "bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]" },
    { id: "fresh", label: "Fresh-user lane", count: pathwayCounts.fresh, icon: Users, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
    { id: "broadcast", label: "Broadcasts", count: pathwayCounts.broadcast, icon: Megaphone, tone: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
    { id: "all", label: "All lanes", count: pathwayCounts.all, icon: Radio, tone: "bg-muted text-foreground" },
  ];

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      {/* v8: real-time status band */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#0c93e7]/30 bg-gradient-to-r from-[#e0effe]/60 to-transparent p-3.5 dark:from-[#0c93e7]/10">
        <span className="relative flex h-2.5 w-2.5"><span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75", liveEventsEnabled ? "animate-ping bg-emerald-400" : "bg-muted-foreground/50")} /><span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", liveEventsEnabled ? "bg-emerald-500" : "bg-muted-foreground/50")} /></span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-bold"><Radio className="h-4 w-4 text-[#0c93e7] dark:text-[#36adf6]" />{liveEventsEnabled ? "Live monitoring is ON — alerts arrive in real time" : "Live monitoring is paused"}</div>
          <div className="text-[10.5px] text-muted-foreground">Heartbeat every {LIVE_EVENT_INTERVAL_MS / 1000} seconds · rule engine re-checked on every data change · {liveEvents.filter(e => e.kind === "new-alert").length} live alert events this session · feed refresh #{pulse} · <span className="font-semibold">{isFreshUser ? "Fresh-user pathway active" : "Demo pathway active"}</span></div>
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
            { label: "Pathway routing", hint: "v13: alerts are routed to the demo lane, fresh-user lane, or broadcast lane — keeping signals clean per audience." },
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
          {can(user, "alert:ack") && (
            <Button size="sm" variant="outline" onClick={() => setBroadcastOpen(true)}><Megaphone className="h-3.5 w-3.5" />Broadcast…</Button>
          )}
        </div>
      </div>

      {/* ─── v13: Pathway selector — separate demo / fresh-user / broadcast lanes ─── */}
      <div className="rounded-xl border bg-card p-3">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <Radio className="h-3.5 w-3.5" />Alert pathway
          <span className="ml-auto text-[10px] font-normal text-muted-foreground/80">v13: signals are routed so demo noise never reaches fresh-user accounts, and vice versa</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {pathwayTabs.map(t => {
            const active = pathwayFilter === t.id;
            const Icon = t.icon;
            const disabled = t.id === "fresh" && !isFreshUser && user.role !== "ADMIN" && pathwayCounts.fresh === 0
                          || t.id === "demo" && isFreshUser && user.role !== "ADMIN" && pathwayCounts.demo === 0;
            return (
              <button key={t.id} onClick={() => !disabled && setPathwayFilter(t.id)} disabled={disabled}
                className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold transition",
                  active ? t.tone : "bg-background text-muted-foreground hover:bg-muted", disabled && "opacity-40 cursor-not-allowed")}>
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                <span className={cn("ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9.5px] font-bold tabular",
                  active ? "bg-white/25" : "bg-muted")}>{t.count}</span>
              </button>
            );
          })}
        </div>
        {isFreshUser && (
          <div className="mt-2 rounded-lg bg-emerald-50/60 px-3 py-1.5 text-[10.5px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            You are signed in as a registered user · your pathway is <strong>fresh-user</strong> · you see your own project alerts + organisation broadcasts only · demo portfolio alerts are routed away.
          </div>
        )}
        {!isFreshUser && (
          <div className="mt-2 rounded-lg bg-[#e0effe]/60 px-3 py-1.5 text-[10.5px] text-[#015ca0] dark:bg-[#0c93e7]/10 dark:text-[#7cc8fb]">
            You are on a demo persona · your pathway is <strong>demo</strong> · you see the 30-project seeded portfolio alerts + broadcasts only · fresh-user private alerts are routed away.
          </div>
        )}
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
        {list.length === 0 && <EmptyState icon={ShieldAlert} title="No alerts in this pathway" body="You are all caught up — the rule engine keeps watching on every mutation and the 6-hourly cron. Switch pathway tabs above to see other lanes." />}
        {list.map((a, i) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
            className={cn("rounded-xl border bg-card p-4", !a.isRead && "border-l-[3px] border-l-[#0c93e7]", fresh.includes(a.id) && "ring-2 ring-emerald-500/40")}>
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={a.severity} />
              <span className="text-[13px] font-bold">{a.title}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[9.5px] font-semibold text-muted-foreground">{a.type.replace(/_/g, " ")}</span>
              {/* v13: pathway badge */}
              <span className={cn("rounded-full px-2 py-0.5 text-[9.5px] font-bold",
                a.pathway === "demo" ? "bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]" :
                a.pathway === "fresh" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" :
                "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300")}>
                {a.pathway === "broadcast" ? "BROADCAST" : a.pathway === "fresh" ? "FRESH USER" : "DEMO"}
              </span>
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
          <br /><span className="font-semibold">v13 pathway routing:</span> demo project alerts stay in the demo lane; registered-user project alerts route to the fresh-user lane; admin broadcasts hit both lanes.
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

      {/* v13: broadcast dialog — admin can push a notification to BOTH pathways */}
      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[15px]">Broadcast alert to all users</DialogTitle></DialogHeader>
          <p className="text-[12px] text-muted-foreground">Sends a notification to every user — demo personas AND registered accounts. The alert appears in the Broadcasts lane for everyone.</p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Severity</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map(s => (
                  <button key={s} onClick={() => setBroadcastSev(s)} className={cn("rounded-lg border px-2 py-1.5 text-[10.5px] font-bold transition",
                    broadcastSev === s ? "border-[#0c93e7] bg-[#e0effe]/60 dark:bg-[#0c93e7]/10" : "hover:bg-muted")}>{s}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Title</label>
              <input value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)} placeholder="e.g., Quarterly portfolio review meeting" className="h-9.5 w-full rounded-lg border bg-background px-3 text-[12.5px] outline-none focus:border-[#0c93e7] focus:ring-2 focus:ring-[#0c93e7]/20" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Message</label>
              <Textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Write the broadcast message — every user will see this in their Alerts Centre Broadcasts lane." className="min-h-20 text-[12.5px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBroadcastOpen(false)}>Cancel</Button>
            <Button disabled={broadcastTitle.trim().length < 4 || broadcastMsg.trim().length < 10} onClick={() => {
              // Inject as a synthetic broadcast alert attached to the worst project (or first available)
              const target = worst ?? projects[0];
              if (target) {
                // Use existing acknowledge/simulate pathway — we push a broadcast alert
                useApp.setState(s => ({
                  projects: s.projects.map(p => p.id === target.id ? {
                    ...p,
                    alerts: [{
                      id: `ba-${Date.now()}`,
                      projectId: target.id,
                      title: broadcastTitle.trim(),
                      description: broadcastMsg.trim(),
                      severity: broadcastSev,
                      type: "MANUAL_BROADCAST",
                      isRead: false,
                      createdAt: new Date().toISOString(),
                      recommendedAction: "Read the broadcast and confirm receipt.",
                      recommendedOwner: user.name,
                      recommendedDeadline: "End of day",
                      pathway: "broadcast",
                      emailQueued: false,
                    }, ...p.alerts],
                  } : p),
                  liveEvents: [{ id: `ev-${Date.now()}`, kind: "new-alert" as const, at: new Date().toISOString(), projectId: target.id, title: `Broadcast: ${broadcastTitle.trim()}`, detail: broadcastMsg.trim() }, ...s.liveEvents].slice(0, 30),
                }));
              }
              setBroadcastOpen(false);
              setBroadcastTitle(""); setBroadcastMsg("");
              toast.success("Broadcast sent", { description: "Notification routed to all users (demo + fresh-user lanes)" });
            }}><Megaphone className="h-4 w-4" />Send broadcast</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
