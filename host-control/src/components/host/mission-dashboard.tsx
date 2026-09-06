"use client";
import React, { useState } from "react";
import { useAdminStore } from "@/store/admin-store";
import { cn } from "@/lib/utils";
import {
  FlaskConical,
  IndianRupee,
  ShieldAlert,
  Gavel,
  Activity,
  Users,
  Megaphone,
  Download,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Ban,
} from "lucide-react";
import { relTime } from "@/lib/host/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from "recharts";

export function MissionDashboard() {
  const { snapshot, users, audit, activity, alerts, forceSync, setView } = useAdminStore();
  const [busy, setBusy] = useState(false);

  if (!snapshot) return <div className="py-20 text-center text-sm text-slate-400">Loading portfolio…</div>;

  const freshCount = users.filter((u) => u.source === "FRESH_USER").length;
  const suspendedCount = users.filter((u) => u.status === "SUSPENDED").length;
  const pendingCount = users.filter((u) => u.status === "PENDING_APPROVAL").length;

  const kpis = [
    {
      label: "Total Users",
      value: users.length,
      sub: `${freshCount} fresh · ${suspendedCount} suspended`,
      icon: Users,
      tone: "text-[#0c93e7]",
      bg: "bg-[#e0effe]",
    },
    {
      label: "Active Projects",
      value: snapshot.totalProjects,
      sub: `${snapshot.freshProjects} from fresh users`,
      icon: FlaskConical,
      tone: "text-emerald-600",
      bg: "bg-emerald-100",
    },
    {
      label: "Open Alerts",
      value: snapshot.openAlerts,
      sub: `${alerts.filter((a) => a.severity === "CRITICAL").length} critical`,
      icon: ShieldAlert,
      tone: "text-rose-600",
      bg: "bg-rose-100",
    },
    {
      label: "Pending Approvals",
      value: snapshot.pendingApprovals,
      sub: "awaiting CPO review",
      icon: Gavel,
      tone: "text-amber-600",
      bg: "bg-amber-100",
    },
    {
      label: "Sanctioned",
      value: `₹${(snapshot.totalSanctionedL / 100).toFixed(0)} Cr`,
      sub: `₹${(snapshot.totalSpentL / 100).toFixed(0)} Cr spent`,
      icon: IndianRupee,
      tone: "text-[#015ca0]",
      bg: "bg-[#e0effe]",
    },
    {
      label: "Portfolio Health",
      value: snapshot.avgHealth.toFixed(0),
      sub: `${snapshot.healthBand.healthy} healthy · ${snapshot.healthBand.critical} critical`,
      icon: Activity,
      tone: snapshot.avgHealth >= 70 ? "text-emerald-600" : snapshot.avgHealth >= 50 ? "text-amber-600" : "text-rose-600",
      bg: "bg-slate-100",
    },
  ];

  const donutData = [
    { name: "Healthy", value: snapshot.healthBand.healthy, color: "#10b981" },
    { name: "At-Risk", value: snapshot.healthBand.atRisk, color: "#f59e0b" },
    { name: "Critical", value: snapshot.healthBand.critical, color: "#f43f5e" },
  ];

  const doBroadcast = () => {
    setView("alerts");
    toast.info("Open the broadcast dialog", { description: "Pick severity + audience from the Alerts Aggregation view" });
  };

  const doExport = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/export");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `projectassure-users-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export ready", { description: `${users.length} users downloaded as CSV` });
    } catch {
      toast.error("Export failed");
    } finally {
      setBusy(false);
    }
  };

  const doSync = async () => {
    setBusy(true);
    try {
      await forceSync();
      toast.success("Force sync complete");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", k.bg)}>
                <k.icon className={cn("h-4 w-4", k.tone)} />
              </div>
            </div>
            <div className={cn("mt-2 text-2xl font-extrabold tabular", k.tone)}>{k.value}</div>
            <div className="mt-0.5 text-[11px] font-semibold text-slate-700">{k.label}</div>
            <div className="text-[9px] text-slate-400">{k.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={doBroadcast}>
          <Megaphone className="h-3.5 w-3.5" /> Broadcast alert
        </Button>
        <Button size="sm" variant="outline" onClick={doSync} disabled={busy}>
          <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} /> Force sync
        </Button>
        <Button size="sm" variant="outline" onClick={doExport} disabled={busy}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
        {/* Health donut */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Activity className="h-4 w-4 text-[#0c93e7]" /> Portfolio Health Bands
          </h3>
          <div className="mt-3 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={2}
                  stroke="none"
                >
                  {donutData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <RTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            {donutData.map((d) => (
              <div key={d.name}>
                <div className="text-lg font-bold tabular" style={{ color: d.color }}>
                  {d.value}
                </div>
                <div className="text-[9px] font-semibold uppercase text-slate-500">{d.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 risky projects */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <ShieldAlert className="h-4 w-4 text-rose-500" /> Top 5 At-Risk Projects
          </h3>
          <div className="mt-3 space-y-1.5">
            {snapshot.topRisky.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    p.healthStatus === "CRITICAL"
                      ? "bg-rose-500"
                      : p.healthStatus === "AT_RISK"
                        ? "bg-amber-500"
                        : "bg-emerald-500",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-bold">{p.name}</div>
                  <div className="font-mono text-[9px] text-slate-500">{p.psId}</div>
                </div>
                <div className="text-sm font-bold tabular">{p.healthScore}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 budget overruns */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <TrendingUp className="h-4 w-4 text-amber-500" /> Top 5 Budget Overruns
          </h3>
          <div className="mt-3 space-y-1.5">
            {snapshot.topOverruns.map((p) => (
              <div key={p.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-bold">{p.name}</div>
                    <div className="font-mono text-[9px] text-slate-500">{p.psId}</div>
                  </div>
                  <div
                    className={cn(
                      "text-sm font-bold tabular",
                      p.variancePct > 20 ? "text-rose-600" : p.variancePct > 10 ? "text-amber-600" : "text-emerald-600",
                    )}
                  >
                    {p.variancePct > 0 ? "+" : ""}
                    {p.variancePct.toFixed(1)}%
                  </div>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      p.variancePct > 20 ? "bg-rose-500" : p.variancePct > 10 ? "bg-amber-500" : "bg-emerald-500",
                    )}
                    style={{ width: `${Math.min(Math.abs(p.variancePct), 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User breakdown + Live activity feed */}
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Users className="h-4 w-4 text-[#0c93e7]" /> User Breakdown
          </h3>
          <div className="mt-3 space-y-2 text-xs">
            <Row
              icon={<UserCheck className="h-3.5 w-3.5 text-emerald-600" />}
              label="Active"
              value={users.filter((u) => u.status === "ACTIVE").length}
            />
            <Row
              icon={<Ban className="h-3.5 w-3.5 text-rose-600" />}
              label="Suspended"
              value={suspendedCount}
            />
            <Row
              icon={<Users className="h-3.5 w-3.5 text-[#0c93e7]" />}
              label="Fresh users (webhook)"
              value={freshCount}
            />
            <Row
              icon={<Gavel className="h-3.5 w-3.5 text-amber-600" />}
              label="Pending approval"
              value={pendingCount}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Activity className="h-4 w-4 text-[#0c93e7]" /> Live Activity Feed (last 10)
          </h3>
          <div className="mt-3 max-h-[280px] space-y-1.5 overflow-y-auto pr-1">
            {(activity.length ? activity : audit).slice(0, 10).map((ev: any) => (
              <div
                key={ev.id}
                className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5"
              >
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#0c93e7]/10 text-[9px] font-bold text-[#015ca0]">
                  {(ev.kind || ev.action || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10px] font-semibold">{ev.title || ev.action}</div>
                  <div className="truncate text-[9px] text-slate-500">
                    {ev.kind ? "event" : ev.entityType} · {relTime(ev.at)}
                  </div>
                </div>
              </div>
            ))}
            {activity.length === 0 && audit.length === 0 && (
              <div className="py-8 text-center text-[11px] text-slate-400">No events yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      {icon}
      <span className="text-[11px] text-slate-600">{label}</span>
      <span className="ml-auto text-sm font-bold tabular text-slate-900">{value}</span>
    </div>
  );
}
