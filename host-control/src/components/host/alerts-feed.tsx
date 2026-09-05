"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell, AlertOctagon, CheckCircle2, Filter, Download, Megaphone,
  Building2, RefreshCw, Mail, Search,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAdminStore } from "@/store/admin-store";
import { fmtDate, timeAgo, deptCode, cn, downloadCSV } from "@/lib/utils";
import type { AlertSeverity, AlertType } from "@/lib/host/types";

const SEV: Record<AlertSeverity, { label: string; cls: string; dot: string }> = {
  CRITICAL: { label: "Critical", cls: "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-500/15 dark:text-rose-300", dot: "bg-rose-500" },
  HIGH: { label: "High", cls: "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-300", dot: "bg-amber-500" },
  MEDIUM: { label: "Medium", cls: "border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-500/15 dark:text-blue-300", dot: "bg-blue-500" },
  LOW: { label: "Low", cls: "border-slate-300 text-slate-700 bg-slate-50 dark:bg-slate-500/15 dark:text-slate-300", dot: "bg-slate-500" },
};

const TYPE_LABEL: Record<AlertType, string> = {
  RISK_LEVEL_CHANGE: "Risk Level Change",
  BUDGET_OVERRUN: "Budget Overrun",
  MILESTONE_SLIPPAGE: "Milestone Slippage",
  DATA_STALENESS: "Data Staleness",
  RESOURCE_BOTTLENECK: "Resource Bottleneck",
  DELAY_PREDICTION: "Delay Prediction",
  BROADCAST: "Broadcast",
};

export function AlertsFeed() {
  const { alerts, ackAlert, pushActivity, hydrate } = useAdminStore();
  const [sevFilter, setSevFilter] = useState<"ALL" | AlertSeverity>("ALL");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<"ALL" | "DEMO" | "FRESH_USER">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UNREAD" | "ACK">("ALL");
  const [search, setSearch] = useState("");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcast, setBroadcast] = useState({
    title: "", description: "", severity: "MEDIUM" as AlertSeverity,
    recommendedAction: "", deadline: "",
  });

  const filtered = useMemo(() => {
    return alerts
      .filter(a => sevFilter === "ALL" ? true : a.severity === sevFilter)
      .filter(a => deptFilter === "ALL" ? true : a.departmentId === deptFilter)
      .filter(a => sourceFilter === "ALL" ? true : a.source === sourceFilter)
      .filter(a => statusFilter === "ALL" ? true : statusFilter === "UNREAD" ? !a.isRead : a.isRead)
      .filter(a => search ? (a.title + a.projectName + a.description).toLowerCase().includes(search.toLowerCase()) : true);
  }, [alerts, sevFilter, deptFilter, sourceFilter, statusFilter, search]);

  const stats = useMemo(() => ({
    total: alerts.length,
    unread: alerts.filter(a => !a.isRead).length,
    critical: alerts.filter(a => a.severity === "CRITICAL").length,
    ack: alerts.filter(a => a.isRead).length,
  }), [alerts]);

  const handleAck = async (id: string) => {
    try {
      ackAlert(id, "Arun Kulkarni (CPO)");
      pushActivity({
        id: `ev-${Date.now()}`,
        timestamp: new Date().toISOString(),
        kind: "alert",
        message: "Alert acknowledged by CPO",
      });
      toast.success("Alert acknowledged");
    } catch {
      toast.error("Ack failed");
    }
  };

  const handleBroadcast = async () => {
    if (!broadcast.title || !broadcast.description) {
      toast.error("Title and description required");
      return;
    }
    try {
      const res = await fetch("/api/admin/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(broadcast),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const sync = await fetch("/api/admin/sync", { cache: "no-store" });
      const syncJson = await sync.json();
      hydrate(syncJson);
      toast.success(`Alert broadcast to ${json.count} projects`, { description: broadcast.title });
      setBroadcastOpen(false);
      setBroadcast({ title: "", description: "", severity: "MEDIUM", recommendedAction: "", deadline: "" });
    } catch (e: any) {
      toast.error("Broadcast failed", { description: e?.message });
    }
  };

  const handleExport = () => {
    const rows = filtered.map(a => ({
      id: a.id, severity: a.severity, type: TYPE_LABEL[a.type], project: a.projectName,
      title: a.title, description: a.description,
      department: deptCode(a.departmentId),
      recommended_action: a.recommendedAction,
      recommended_owner: a.recommendedOwner,
      recommended_deadline: a.recommendedDeadline,
      status: a.isRead ? "acknowledged" : "unread",
      source: a.source,
      created_at: a.createdAt,
    }));
    downloadCSV(`projectassure-alerts-${Date.now()}.csv`, rows);
    toast.success(`Exported ${rows.length} alerts`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Alerts Aggregation Feed</h2>
          <p className="text-sm text-muted-foreground">
            Every alert across every project — aggregated live from the portfolio mirror.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="size-3.5" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => setBroadcastOpen(true)} className="gap-1.5">
            <Megaphone className="size-3.5" /> Broadcast Alert
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {[
          { label: "Total alerts", value: stats.total, icon: Bell, cls: "text-brand-600 bg-brand-50 dark:bg-brand-500/10" },
          { label: "Unread", value: stats.unread, icon: AlertOctagon, cls: "text-amber-600 bg-amber-50 dark:bg-amber-500/10" },
          { label: "Critical", value: stats.critical, icon: AlertOctagon, cls: "text-rose-600 bg-rose-50 dark:bg-rose-500/10" },
          { label: "Acknowledged", value: stats.ack, icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("rounded-lg p-2", s.cls)}><Icon className="size-4" /></div>
                <div>
                  <div className="tabular text-xl font-semibold">{s.value}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Severity</Label>
              <Select value={sevFilter} onValueChange={(v) => setSevFilter(v as any)}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Department</Label>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="dept-ipmd">IPMD</SelectItem>
                  <SelectItem value="dept-nat">NASD</SelectItem>
                  <SelectItem value="dept-soc">SOSD</SelectItem>
                  <SelectItem value="dept-eco">ECSD</SelectItem>
                  <SelectItem value="dept-cb">CAPB</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Source</Label>
              <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as any)}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="DEMO">Demo</SelectItem>
                  <SelectItem value="FRESH_USER">Fresh user</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="UNREAD">Unread</SelectItem>
                  <SelectItem value="ACK">Acknowledged</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[180px] space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  className="h-8 pl-7 text-xs"
                  placeholder="Search title, project, description…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <Badge variant="outline" className="ml-auto text-xs gap-1">
              <Filter className="size-3" /> Showing {filtered.length} of {alerts.length}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Alert feed */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <CheckCircle2 className="size-8 text-emerald-500" />
              <div className="text-sm font-medium">No alerts match these filters</div>
            </CardContent>
          </Card>
        ) : filtered.slice(0, 60).map((a, i) => {
          const sev = SEV[a.severity];
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.4), duration: 0.2 }}
            >
              <Card className={cn("overflow-hidden", !a.isRead && "border-l-4", !a.isRead && (a.severity === "CRITICAL" ? "border-l-rose-500" : a.severity === "HIGH" ? "border-l-amber-500" : "border-l-brand-500"))}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("mt-1 size-2 shrink-0 rounded-full", sev.dot)} />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn("text-[10px]", sev.cls)}>{sev.label}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{TYPE_LABEL[a.type]}</Badge>
                        <span className="text-sm font-semibold">{a.title}</span>
                        {a.source === "FRESH_USER" && (
                          <Badge variant="outline" className="text-[10px] border-violet-300 text-violet-700 bg-violet-50 dark:bg-violet-500/15 dark:text-violet-300">Fresh user</Badge>
                        )}
                        {!a.isRead && <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-300">Unread</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Building2 className="size-3" />
                        <span className="font-medium text-foreground/80">{a.projectName}</span>
                        <span>·</span>
                        <span>{deptCode(a.departmentId)}</span>
                        <span>·</span>
                        <span>{timeAgo(a.createdAt)}</span>
                      </div>
                      <div className="text-sm leading-snug">{a.description}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1 border-t">
                        <Mail className="size-3" />
                        <span>Owner <strong className="text-foreground">{a.recommendedOwner}</strong></span>
                        <span>·</span>
                        <span>Deadline {fmtDate(a.recommendedDeadline)}</span>
                      </div>
                      <div className="text-xs pt-1">
                        <span className="text-muted-foreground">Recommended action:</span>{" "}
                        <span className="font-medium text-foreground/90">{a.recommendedAction}</span>
                      </div>
                      {a.isRead && a.acknowledgedBy && (
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-300 pt-1 flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> Acknowledged by {a.acknowledgedBy} · {fmtDate(a.acknowledgedAt)}
                        </div>
                      )}
                    </div>
                    {!a.isRead && (
                      <Button size="sm" variant="outline" className="gap-1 shrink-0 h-7 text-xs" onClick={() => handleAck(a.id)}>
                        <CheckCircle2 className="size-3.5" /> Ack
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Broadcast dialog */}
      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Broadcast Alert</DialogTitle>
            <DialogDescription>
              Send a custom alert to ALL {alerts.length > 0 ? "projects" : "users"} in the portfolio. Each project dashboard will receive one alert entry attributed to you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="b2-title">Title</Label>
              <Textarea id="b2-title" value={broadcast.title} onChange={e => setBroadcast(s => ({ ...s, title: e.target.value }))} placeholder="e.g. Mid-quarter portfolio review mandated" rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b2-desc">Description</Label>
              <Textarea id="b2-desc" value={broadcast.description} onChange={e => setBroadcast(s => ({ ...s, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <Select value={broadcast.severity} onValueChange={(v) => setBroadcast(s => ({ ...s, severity: v as AlertSeverity }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b2-deadline">Deadline (days from now)</Label>
                <input
                  id="b2-deadline"
                  type="number"
                  min={1}
                  max={60}
                  defaultValue={7}
                  onChange={e => setBroadcast(s => ({ ...s, deadline: new Date(Date.now() + (parseInt(e.target.value || "7")) * 86400000).toISOString() }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:border-ring focus-visible:ring-ring/50"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b2-act">Recommended action</Label>
              <Textarea id="b2-act" value={broadcast.recommendedAction} onChange={e => setBroadcast(s => ({ ...s, recommendedAction: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBroadcastOpen(false)}>Cancel</Button>
            <Button onClick={handleBroadcast}><Megaphone className="size-4" /> Broadcast</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
