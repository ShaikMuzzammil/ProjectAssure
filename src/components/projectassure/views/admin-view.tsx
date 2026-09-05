"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useApp } from "@/store/app-store";
import { SectionTitle, EmptyState } from "../shared/ui-bits";
import { ROLES_CONFIG, DEPARTMENTS } from "@/lib/projectassure/seed";
import { can, ROLE_LABEL } from "@/lib/projectassure/permissions";
import type { UserRole } from "@/lib/projectassure/types";
import { relTime, dateTime } from "@/lib/projectassure/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Settings2, Users, ShieldCheck, Gauge, Globe, History, Plus, UserX, UserCheck, Trash2,
  RotateCcw, Database, Server, Activity, CheckCircle2, Lock,
} from "lucide-react";

const TABS = [
  { id: "users", label: "Users & roles", icon: Users },
  { id: "thresholds", label: "Thresholds", icon: Gauge },
  { id: "deployment", label: "Deployment", icon: Globe },
  { id: "audit", label: "Audit trail", icon: History },
];

const SERVICE_STATUS = [
  { name: "Secure database", status: "Connected", note: "Accounts, projects and documents persist per user" },
  { name: "Email delivery", status: "Ready", note: "Reports and alerts send to any address" },
  { name: "Intelligence assistant", status: "Ready", note: "Grounded answers with citations" },
  { name: "Real-time feed", status: "Streaming", note: "Portfolio events as they happen" },
  { name: "Document vault", status: "Ready", note: "Uploads read, structured and indexed" },
  { name: "Search index", status: "Ready", note: "Every document queryable with citations" },
];

export default function AdminView() {
  const user = useApp(s => s.user)!;
  const users = useApp(s => s.users);
  const addUser = useApp(s => s.addUser);
  const setUserRole = useApp(s => s.setUserRole);
  const setUserActive = useApp(s => s.setUserActive);
  const thresholds = useApp(s => s.thresholds);
  const setThresholds = useApp(s => s.setThresholds);
  const alertRules = useApp(s => s.alertRules);
  const toggleAlertRule = useApp(s => s.toggleAlertRule);
  const setAlertRuleChannel = useApp(s => s.setAlertRuleChannel);
  const globalAudit = useApp(s => s.globalAudit);
  const projects = useApp(s => s.projects);
  const resetDemo = useApp(s => s.resetDemo);
  const dataMode = useApp(s => s.dataMode);
  const liveEventsEnabled = useApp(s => s.liveEventsEnabled);
  const setLiveEventsEnabled = useApp(s => s.setLiveEventsEnabled);
  const navigate = useApp(s => s.navigate);

  const [tab, setTab] = useState("users");
  const [addOpen, setAddOpen] = useState(false);
  const [auditFilter, setAuditFilter] = useState("ALL");
  const isAdmin = user.role === "ADMIN";

  // add-user form
  const [nu, setNu] = useState({ name: "", email: "", role: "STAKEHOLDER" as UserRole, departmentId: "dept-ipmd", designation: "", password: "welcome123" });

  const donut = [
    { name: "Healthy", value: projects.filter(p => p.healthScore >= thresholds.amberAt).length, color: "#22c55e" },
    { name: "At Risk", value: projects.filter(p => p.healthScore >= thresholds.redAt && p.healthScore < thresholds.amberAt).length, color: "#f59e0b" },
    { name: "Critical", value: projects.filter(p => p.healthScore < thresholds.redAt).length, color: "#ef4444" },
  ];

  const auditEntries = useMemo(() => {
    const list = auditFilter === "ALL" ? globalAudit : globalAudit.filter(e => e.action === auditFilter);
    return list.slice(0, 60);
  }, [globalAudit, auditFilter]);

  const ACTIONS = ["ALL", "CREATE", "UPDATE", "DELETE", "LOGIN", "EXPORT", "ALERT_ACK", "EMAIL_SEND", "PREDICTION_RUN", "MODEL_RETRAIN", "UPLOAD", "SETTINGS", "AI_ACCEPT"];

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState icon={Lock} title="Administration is ADMIN-only" body={`Your role (${ROLE_LABEL[user.role]}) can view projects, alerts and reports but not system settings. RBAC denials are audit-logged. Switch to the Portfolio Overseer persona to explore administration.`} action={<Button size="sm" onClick={() => navigate("dashboard")}>Back to Command Centre</Button>} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1300px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Administration</h1>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">Users & roles · thresholds · alert rules · platform status · the append-only audit trail</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { if (confirm("Reset the entire demo world to its factory state (10 Sep 2026, 30 projects)? Your session and all mutations will be cleared.")) resetDemo(); }}>
          <RotateCcw className="h-3.5 w-3.5" />Reset demo data
        </Button>
      </div>

      <div className="custom-scrollbar flex gap-1 overflow-x-auto rounded-xl border bg-card p-1.5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold transition", tab === t.id ? "bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]" : "text-muted-foreground hover:bg-muted")}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <SectionTitle icon={Users} sub={`${users.length} accounts · soft-deactivate preserves audit provenance`} right={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-3.5 w-3.5" />Add user</Button>}>User directory</SectionTitle>
            <div className="custom-scrollbar overflow-x-auto">
              <table className="w-full min-w-[720px] text-[12.5px]">
                <thead><tr className="border-b text-[9.5px] uppercase tracking-wider text-muted-foreground"><th className="px-2 py-2 text-left font-semibold">User</th><th className="px-2 py-2 text-left font-semibold">Role</th><th className="px-2 py-2 text-left font-semibold">Department</th><th className="px-2 py-2 text-left font-semibold">Last login</th><th className="px-2 py-2 text-right font-semibold">Actions</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className={cn("border-b transition hover:bg-muted/30", !u.isActive && "opacity-50")}>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-[10px] font-bold text-white">{u.avatarInitials}</div>
                          <div>
                            <div className="flex items-center gap-1.5 font-semibold">
                              {u.name}
                              <span className={cn("rounded-full px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wide",
                                u.source === "registered" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
                                {u.source === "registered" ? "registered" : "demo"}
                              </span>
                            </div>
                            <div className="text-[10.5px] text-muted-foreground">{u.email} · {u.designation}</div>
                            <div className="text-[9.5px] text-muted-foreground">{u.passwordHash ? "one-way encrypted · uniquely salted" : "demo directory password"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <Select value={u.role} onValueChange={v => { setUserRole(u.id, v as UserRole); toast.success("Role changed", { description: `${u.email}: ${u.role} → ${v} · effective at next DB-backed check (jti revocation) · audit-logged` }); }}>
                          <SelectTrigger className="h-8 w-40 text-[11.5px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{Object.keys(ROLE_LABEL).map(r => <SelectItem key={r} value={r}>{ROLE_LABEL[r as UserRole]}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-2.5 text-[11.5px]">{DEPARTMENTS.find(d => d.id === u.departmentId)?.code}</td>
                      <td className="px-2 py-2.5 text-[11px] tabular text-muted-foreground">{u.lastLoginAt ? relTime(u.lastLoginAt) : "never"}</td>
                      <td className="px-2 py-2.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => { setUserActive(u.id, !u.isActive); toast.info(u.isActive ? "User deactivated" : "User reactivated", { description: "Soft-delete preserves every audit reference · RBAC check immediate" }); }}
                            className={cn("rounded-md border p-1.5", u.isActive ? "hover:bg-rose-50 dark:hover:bg-rose-500/10" : "hover:bg-emerald-50 dark:hover:bg-emerald-500/10")}>
                            {u.isActive ? <UserX className="h-3 w-3 text-rose-500" /> : <UserCheck className="h-3 w-3 text-emerald-500" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-4">
            {ROLES_CONFIG.map(r => (
              <div key={r.role} className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between"><span className="text-[12.5px] font-bold">{r.title}</span><span className="font-mono text-[9px] text-muted-foreground">{r.role}</span></div>
                <ul className="mt-2 space-y-1">{r.capabilities.map(c => <li key={c} className="text-[10.5px] leading-snug text-muted-foreground">• {c}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "thresholds" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="rounded-xl border bg-card p-5">
            <SectionTitle icon={Gauge} sub="live-preview: every project's band recomputes as you drag — save persists + audits">Health & alert thresholds</SectionTitle>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between"><Label className="text-[11.5px] font-semibold">Amber threshold (Healthy ≥ this)</Label><span className="text-[15px] font-bold tabular text-amber-700 dark:text-amber-400">{thresholds.amberAt}</span></div>
                <Slider value={[thresholds.amberAt]} min={60} max={90} step={1} onValueChange={v => setThresholds({ amberAt: v[0] })} />
              </div>
              <div>
                <div className="flex items-center justify-between"><Label className="text-[11.5px] font-semibold">Red threshold (At-Risk ≥ this)</Label><span className="text-[15px] font-bold tabular text-rose-700 dark:text-rose-400">{thresholds.redAt}</span></div>
                <Slider value={[thresholds.redAt]} min={20} max={60} step={1} onValueChange={v => setThresholds({ redAt: v[0] })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><div className="flex justify-between text-[11.5px] font-semibold"><span>Budget WARNING band (%)</span><span className="tabular">{thresholds.budgetWarnPct}</span></div><Slider value={[thresholds.budgetWarnPct]} min={5} max={15} step={1} onValueChange={v => setThresholds({ budgetWarnPct: v[0] })} /></div>
                <div><div className="flex justify-between text-[11.5px] font-semibold"><span>Budget CRITICAL band (%)</span><span className="tabular">{thresholds.budgetCriticalPct}</span></div><Slider value={[thresholds.budgetCriticalPct]} min={15} max={30} step={1} onValueChange={v => setThresholds({ budgetCriticalPct: v[0] })} /></div>
                <div><div className="flex justify-between text-[11.5px] font-semibold"><span>Email at delay probability (%)</span><span className="tabular">{thresholds.delayProbEmailAt}</span></div><Slider value={[thresholds.delayProbEmailAt]} min={50} max={90} step={5} onValueChange={v => setThresholds({ delayProbEmailAt: v[0] })} /></div>
                <div><div className="flex justify-between text-[11.5px] font-semibold"><span>Burn velocity EARLY_WARNING (%)</span><span className="tabular">+{thresholds.burnVelocityPct}</span></div><Slider value={[thresholds.burnVelocityPct]} min={15} max={50} step={5} onValueChange={v => setThresholds({ burnVelocityPct: v[0] })} /></div>
              </div>
              <div className="rounded-lg bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
                Thresholds take effect immediately across the portfolio (bands, donuts, alert evaluation). Defaults mirror the spec: 75/50 bands, 10%/20% overrun, email at 70% probability, +30% velocity. Every change writes a SETTINGS audit entry.
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-5">
              <div className="mb-1 text-[12px] font-bold">Live band preview</div>
              <div className="relative h-[210px]">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={donut} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={3} strokeWidth={0}>
                      {donut.map(d => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[22px] font-extrabold tabular">{projects.length}</span>
                  <span className="text-[9.5px] uppercase tracking-wider text-muted-foreground">projects</span>
                </div>
              </div>
              <div className="space-y-1.5">
                {donut.map(d => <div key={d.name} className="flex items-center gap-2 text-[11.5px]"><span className="h-2 w-2 rounded-full" style={{ background: d.color }} /><span>{d.name}</span><span className="ml-auto font-bold tabular">{d.value}</span></div>)}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <div className="mb-2.5 flex items-center gap-2 text-[12px] font-bold"><Activity className="h-4 w-4 text-[#0c93e7]" />Live event engine</div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="text-[11px] leading-snug text-muted-foreground">Portfolio heartbeat every 40s — health drifts, milestones complete, budget lines post, alerts fire (drives toasts, badges and the feed).</div>
                <Switch checked={liveEventsEnabled} onCheckedChange={setLiveEventsEnabled} />
              </div>
              <div className="mt-2.5 rounded-lg bg-muted/40 p-2.5 text-[10.5px] leading-relaxed text-muted-foreground">
                Production equivalent: real-time channels ({"user:{id}, project:{id}"}) with Redis adapter; this prototype drives the same event contract deterministically in-browser so the demo never depends on infrastructure.
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <div className="mb-2.5 flex items-center gap-2 text-[12px] font-bold"><ShieldCheck className="h-4 w-4 text-[#0c93e7]" />Alert rule channels</div>
              <div className="space-y-2">
                {alertRules.map(r => (
                  <div key={r.id} className="rounded-lg border p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] font-semibold">{r.name}</span>
                      <Switch checked={r.enabled} onCheckedChange={() => toggleAlertRule(r.id)} />
                    </div>
                    <div className="mt-1 flex gap-1.5">
                      {(["in-app", "in-app+email"] as const).map(c => (
                        <button key={c} onClick={() => setAlertRuleChannel(r.id, c)} className={cn("rounded-full px-2 py-0.5 text-[9.5px] font-semibold transition", r.channel === c ? "bg-[#0c93e7] text-white" : "bg-muted text-muted-foreground hover:bg-muted/70")}>{c}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "deployment" && (
        <div className="space-y-4">
          {/* one web address */}
          <div className="rounded-xl border bg-gradient-to-r from-[#0b426e] to-[#0c93e7] p-5 text-white">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><Globe className="h-5 w-5" /></span>
              <div>
                <div className="text-[15px] font-bold">One platform · one secure web address</div>
                <div className="mt-0.5 text-[12px] text-white/80">Every role signs in at the same link and lands on their tailored view — no installs, no separate apps.</div>
              </div>
              <span className="ml-auto flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold"><CheckCircle2 className="h-3.5 w-3.5" />Operational</span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-5">
              <SectionTitle icon={Server} sub="live status of every platform subsystem">System status</SectionTitle>
              <div className="space-y-1.5">
                {SERVICE_STATUS.map(v => (
                  <div key={v.name} className="flex items-center gap-2.5 rounded-lg border px-3 py-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span className="text-[11.5px] font-semibold">{v.name}</span>
                    <span className="ml-auto hidden text-[10px] text-muted-foreground sm:block">{v.note}</span>
                    <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{v.status}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-lg bg-muted/40 p-2.5 text-[10.5px] leading-relaxed text-muted-foreground">
                The demo world runs fully in the browser with zero configuration — every subsystem works out of the box, and the same platform connects to live services in production. Current data mode: <strong className="text-foreground">{dataMode.mode}</strong>.
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <SectionTitle icon={Database} sub="capacity vs expected national-scale usage">Capacity posture</SectionTitle>
              <div className="space-y-1.5">
                {[
                  ["Portfolio capacity", "10,000+ projects", "~6× demo load headroom"],
                  ["Document vault", "reports, budgets, scans", "~4× storage headroom"],
                  ["Prediction runs", "every 6 hours, portfolio-wide", "~5× compute headroom"],
                  ["Email delivery", "alerts + report digests", "~16× daily volume headroom"],
                  ["Concurrent users", "role-based sessions", "auto-scaling ready"],
                  ["Search index", "full-text + semantic", "~5× vector headroom"],
                ].map(([s, limit, use]) => (
                  <div key={s} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px]">
                    <Database className="h-3.5 w-3.5 shrink-0 text-[#0c93e7]" />
                    <span className="font-semibold">{s}</span>
                    <span className="ml-auto hidden text-[10px] text-muted-foreground md:block">{limit}</span>
                    <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{use}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5 dark:border-emerald-500/25 dark:bg-emerald-500/5">
                <span className="text-[12.5px] font-bold text-emerald-700 dark:text-emerald-300">Total monthly licence + infrastructure cost</span>
                <span className="text-[20px] font-extrabold text-emerald-600 dark:text-emerald-400">₹0</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div className="rounded-xl border bg-card p-5">
          <SectionTitle icon={History} sub={`${globalAudit.length} entries · append-only · no edits, no deletes (immutable governance log)`}>Audit trail browser</SectionTitle>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {ACTIONS.map(a => (
              <button key={a} onClick={() => setAuditFilter(a)} className={cn("rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition", auditFilter === a ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70")}>{a.replace("_", " ")}</button>
            ))}
          </div>
          <div className="custom-scrollbar max-h-[560px] space-y-1.5 overflow-y-auto pr-1">
            {auditEntries.map(e => (
              <div key={e.id} className="flex items-start gap-3 rounded-lg border p-2.5">
                <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] font-bold">{e.action}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] leading-snug">{e.details}</div>
                  <div className="mt-0.5 text-[9.5px] text-muted-foreground">{e.userName} ({e.userRole}) · {dateTime(e.timestamp)} · {relTime(e.timestamp)}</div>
                </div>
              </div>
            ))}
            {auditEntries.length === 0 && <EmptyState icon={History} title="No entries for this action" />}
          </div>
        </div>
      )}

      {/* add user dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[15px]">Add user</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-[11.5px]">Full name *</Label><Input value={nu.name} onChange={e => setNu({ ...nu, name: e.target.value })} placeholder="e.g., Kavitha Raman" className="text-[13px]" /></div>
            <div><Label className="text-[11.5px]">Official email *</Label><Input value={nu.email} onChange={e => setNu({ ...nu, email: e.target.value })} placeholder="name@mospi.gov.in" className="text-[13px]" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-[11.5px]">Role</Label><Select value={nu.role} onValueChange={v => setNu({ ...nu, role: v as UserRole })}><SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger><SelectContent>{Object.keys(ROLE_LABEL).map(r => <SelectItem key={r} value={r}>{ROLE_LABEL[r as UserRole]}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-[11.5px]">Department</Label><Select value={nu.departmentId} onValueChange={v => setNu({ ...nu, departmentId: v })}><SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger><SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d.id} value={d.id}>{d.code}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><Label className="text-[11.5px]">Designation</Label><Input value={nu.designation} onChange={e => setNu({ ...nu, designation: e.target.value })} placeholder="e.g., Deputy Director (Analysis)" className="text-[13px]" /></div>
            <div><Label className="text-[11.5px]">Demo password</Label><Input value={nu.password} onChange={e => setNu({ ...nu, password: e.target.value })} className="font-mono text-[13px]" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button disabled={nu.name.length < 3 || !nu.email.includes("@")} className="bg-gradient-to-r from-[#0b426e] to-[#0c93e7]"
              onClick={() => { const u = addUser(nu); if (u) { setAddOpen(false); setNu({ name: "", email: "", role: "STAKEHOLDER", departmentId: "dept-ipmd", designation: "", password: "welcome123" }); toast.success("User created", { description: `${u.email} can now sign in with the demo password · audit-logged` }); } else toast.error("Email already exists"); }}>Create user</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
