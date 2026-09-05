"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Building2, Wallet, Bell, FileCheck, TrendingDown, Megaphone,
  RefreshCw, Activity, ChevronRight, CircleDot, CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAdminStore } from "@/store/admin-store";
import { fmtINR, timeAgo, cn } from "@/lib/utils";
import type { AlertSeverity, HealthStatus } from "@/lib/host/types";

const HEALTH_BADGE: Record<HealthStatus, { label: string; cls: string }> = {
  HEALTHY: { label: "Healthy", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30" },
  AT_RISK: { label: "At Risk", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30" },
  CRITICAL: { label: "Critical", cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30" },
};

const ACTIVITY_ICON: Record<string, string> = {
  alert: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  approval: "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  sync: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  ai: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  user: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  budget: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  milestone: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
};

export function MissionDashboard() {
  const { snapshot, activity, admin, setView, hydrate, pushActivity } = useAdminStore();
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcast, setBroadcast] = useState({
    title: "",
    description: "",
    severity: "MEDIUM" as AlertSeverity,
    recommendedAction: "",
    deadline: "",
  });

  if (!snapshot) {
    return <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => (
      <Card key={i}><CardContent className="h-32 animate-pulse bg-muted/40 rounded-xl" /></Card>
    ))}</div>;
  }

  const KPIS = [
    { label: "Total Projects", value: snapshot.totalProjects.toString(), sub: `${snapshot.freshProjects} fresh-user · ${snapshot.totalProjects - snapshot.freshProjects} demo`, icon: Building2, accent: "text-brand-600", bg: "bg-brand-50 dark:bg-brand-500/10" },
    { label: "Total Sanctioned", value: fmtINR(snapshot.totalSanctionedL), sub: `Spent ${fmtINR(snapshot.totalSpentL)} · ${((snapshot.totalSpentL / snapshot.totalSanctionedL) * 100).toFixed(0)}% burn`, icon: Wallet, accent: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
    { label: "Open Alerts", value: snapshot.openAlerts.toString(), sub: `${snapshot.criticalProjects} critical projects`, icon: Bell, accent: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-500/10" },
    { label: "Pending Approvals", value: snapshot.pendingApprovals.toString(), sub: `${fmtINR(4200 + 5400 + 950 + 2800, { unit: "crore" })} value queued`, icon: FileCheck, accent: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-500/10" },
  ];

  const total = snapshot.healthBand.healthy + snapshot.healthBand.atRisk + snapshot.healthBand.critical || 1;
  const bands = [
    { key: "healthy", label: "Healthy", count: snapshot.healthBand.healthy, pct: (snapshot.healthBand.healthy / total) * 100, color: "bg-emerald-500", text: "text-emerald-600" },
    { key: "atRisk", label: "At Risk", count: snapshot.healthBand.atRisk, pct: (snapshot.healthBand.atRisk / total) * 100, color: "bg-amber-500", text: "text-amber-600" },
    { key: "critical", label: "Critical", count: snapshot.healthBand.critical, pct: (snapshot.healthBand.critical / total) * 100, color: "bg-rose-500", text: "text-rose-600" },
  ];

  const handleForceResync = async () => {
    try {
      const res = await fetch("/api/admin/sync", { cache: "no-store" });
      const json = await res.json();
      hydrate(json);
      toast.success("Portfolio resynced", { description: `${json.snapshot.totalProjects} projects pulled from the main mirror.` });
    } catch {
      toast.error("Resync failed");
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
      // Pull fresh sync so the alerts feed updates instantly
      const sync = await fetch("/api/admin/sync", { cache: "no-store" });
      const syncJson = await sync.json();
      hydrate(syncJson);
      pushActivity({
        id: `ev-${Date.now()}`,
        timestamp: new Date().toISOString(),
        kind: "alert",
        message: `Broadcast alert "${broadcast.title}" sent to ${json.count} projects (${broadcast.severity})`,
        severity: broadcast.severity,
      });
      toast.success(`Alert broadcast to ${json.count} projects`, { description: broadcast.title });
      setBroadcastOpen(false);
      setBroadcast({ title: "", description: "", severity: "MEDIUM", recommendedAction: "", deadline: "" });
    } catch (e: any) {
      toast.error("Broadcast failed", { description: e?.message });
    }
  };

  return (
    <div className="space-y-5">
      {/* ─── Header strip ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Mission Control</h2>
          <p className="text-sm text-muted-foreground">
            Aggregated portfolio view across all central-sector projects.
            Persona: <span className="font-medium text-foreground">{admin?.name ?? "Chief Programme Officer"}</span> ·{" "}
            <span className="font-medium text-foreground">{admin?.designation ?? "Joint Secretary, MoSPI"}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleForceResync} className="gap-1.5">
            <RefreshCw className="size-3.5" /> Force resync
          </Button>
          <Button size="sm" onClick={() => setBroadcastOpen(true)} className="gap-1.5">
            <Megaphone className="size-3.5" /> Broadcast Alert
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setView("approvals")} className="gap-1.5">
            <FileCheck className="size-3.5" /> Approval Queue
          </Button>
        </div>
      </div>

      {/* ─── KPI tiles ───────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((k, i) => {
          const Icon = k.icon;
          return (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <Card className="overflow-hidden">
                <CardContent className="flex items-start justify-between gap-3 p-5">
                  <div className="space-y-1 min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.label}</div>
                    <div className="text-2xl font-semibold tabular truncate">{k.value}</div>
                    <div className="text-[11px] text-muted-foreground">{k.sub}</div>
                  </div>
                  <div className={cn("rounded-lg p-2.5 shrink-0", k.bg)}>
                    <Icon className={cn("size-5", k.accent)} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* ─── Health bands + Top risky ─────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Health-Score Band Distribution</CardTitle>
            <CardDescription>Across {snapshot.totalProjects} projects</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {bands.map(b => (
                <div key={b.key} className={b.color} style={{ width: `${b.pct}%` }} title={`${b.label}: ${b.count}`} />
              ))}
            </div>
            <div className="space-y-3">
              {bands.map(b => (
                <div key={b.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={cn("size-2 rounded-full", b.color)} />
                      <span className="font-medium">{b.label}</span>
                    </div>
                    <span className={cn("tabular font-semibold", b.text)}>
                      {b.count} <span className="text-xs text-muted-foreground">({b.pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <Progress value={b.pct} className={cn("h-1.5", b.color.replace("bg-", "bg-"))} />
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Portfolio avg health</span>
              <span className="tabular font-semibold">{snapshot.avgHealth.toFixed(1)} / 100</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Top 5 At-Risk Projects</CardTitle>
              <CardDescription>Sorted by health score ascending</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setView("alerts")} className="gap-1 text-xs">
              View all <ChevronRight className="size-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshot.topRisky.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{p.sector}</span>
                    <span>·</span>
                    <span>{p.state}</span>
                    <span>·</span>
                    <span className="tabular">Variance {p.variancePct >= 0 ? "+" : ""}{p.variancePct.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className={HEALTH_BADGE[p.healthStatus].cls}>
                    {p.healthStatus === "CRITICAL" ? "Critical" : p.healthStatus === "AT_RISK" ? "At Risk" : "Healthy"}
                  </Badge>
                  <span className="tabular text-xs font-semibold">{p.healthScore.toFixed(0)} / 100</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ─── Live activity ticker ────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-base">Live Activity Ticker</CardTitle>
              <CardDescription>Last 10 events across the portfolio</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="gap-1 text-xs">
            <Activity className="size-3" /> Live · {activity.length} events
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="max-h-72 space-y-1 overflow-y-auto custom-scrollbar pr-2">
            {activity.slice(0, 10).map(ev => (
              <div
                key={ev.id}
                className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-accent/40 transition-colors"
              >
                <div className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md", ACTIVITY_ICON[ev.kind] ?? "bg-slate-100")}>
                  {ev.kind === "alert" && <Bell className="size-3.5" />}
                  {ev.kind === "approval" && <FileCheck className="size-3.5" />}
                  {ev.kind === "sync" && <RefreshCw className="size-3.5" />}
                  {ev.kind === "ai" && <CircleDot className="size-3.5" />}
                  {ev.kind === "user" && <Building2 className="size-3.5" />}
                  {ev.kind === "budget" && <TrendingDown className="size-3.5" />}
                  {ev.kind === "milestone" && <CheckCircle2 className="size-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm leading-snug">{ev.message}</div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{timeAgo(ev.timestamp)}</span>
                    {ev.projectName && <span>· {ev.projectName.slice(0, 48)}</span>}
                  </div>
                </div>
                {ev.severity && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5",
                      ev.severity === "CRITICAL" && "border-rose-300 text-rose-700 dark:text-rose-300",
                      ev.severity === "HIGH" && "border-amber-300 text-amber-700 dark:text-amber-300",
                      ev.severity === "MEDIUM" && "border-blue-300 text-blue-700 dark:text-blue-300",
                      ev.severity === "LOW" && "border-slate-300 text-slate-700 dark:text-slate-300",
                    )}
                  >
                    {ev.severity}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── Broadcast dialog ─────────────────────────────────────────────── */}
      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Broadcast Alert</DialogTitle>
            <DialogDescription>
              Send a custom alert to ALL {snapshot.totalProjects} projects in the portfolio.
              Each project dashboard will receive one alert entry attributed to you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-title">Title</Label>
              <Textarea
                id="b-title"
                value={broadcast.title}
                onChange={e => setBroadcast(s => ({ ...s, title: e.target.value }))}
                placeholder="e.g. Mandatory mid-quarter portfolio review"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-desc">Description</Label>
              <Textarea
                id="b-desc"
                value={broadcast.description}
                onChange={e => setBroadcast(s => ({ ...s, description: e.target.value }))}
                placeholder="What officers need to know"
                rows={3}
              />
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
                <Label htmlFor="b-deadline">Deadline (days from now)</Label>
                <input
                  id="b-deadline"
                  type="number"
                  min={1}
                  max={60}
                  defaultValue={7}
                  onChange={e => setBroadcast(s => ({
                    ...s,
                    deadline: new Date(Date.now() + (parseInt(e.target.value || "7")) * 86400000).toISOString(),
                  }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:border-ring focus-visible:ring-ring/50"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-act">Recommended action</Label>
              <Textarea
                id="b-act"
                value={broadcast.recommendedAction}
                onChange={e => setBroadcast(s => ({ ...s, recommendedAction: e.target.value }))}
                placeholder="Acknowledge on your project dashboard"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBroadcastOpen(false)}>Cancel</Button>
            <Button onClick={handleBroadcast}>
              <Megaphone className="size-4" /> Broadcast to {snapshot.totalProjects} projects
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
