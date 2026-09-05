"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Simple Overview — the one-page dashboard a first-time teammate can read.
// Four big numbers, who is ahead, where the risk sits, what just happened.
// Everything is computed LIVE from the same store the deep screens use.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { StatCard, ProgressBar, SectionTitle, InfoTip, PipelineStrip, EmptyState } from "../shared/ui-bits";
import { deriveSimpleOverview } from "@/lib/projectassure/monitor";
import { inr } from "@/lib/projectassure/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FolderKanban, IndianRupee, ShieldAlert, Bell, ArrowRight, LayoutDashboard } from "lucide-react";

export default function MonitorView() {
  const projects = useApp(s => s.scoped)();
  const user = useApp(s => s.user)!;
  const navigate = useApp(s => s.navigate);
  const openProject = useApp(s => s.openProject);
  const setAiOpen = useApp(s => s.setAiOpen);

  const ov = useMemo(() => deriveSimpleOverview(projects), [projects]);

  if (!projects.length) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-4">
        <h1 className="text-[20px] font-bold tracking-tight">Simple Overview</h1>
        <EmptyState icon={LayoutDashboard} title="No projects in your scope yet"
          body="Once projects are assigned to you (or you create one), this page fills with live numbers automatically." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      {/* ─── header ─── */}
      <div>
        <h1 className="text-[20px] font-bold tracking-tight">Dashboard</h1>
        <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
          The whole portfolio on one calm page — four big numbers, who is ahead, where the risk sits. Every number is live.
        </p>
        <div className="mt-2"><PipelineStrip steps={[
          { label: "Live portfolio", hint: "Projects, budgets, progress and alerts are read from your scoped portfolio in real time." },
          { label: "Four big numbers", hint: "Projects monitored, approved budget, high-risk count, unread alerts — the daily pulse." },
          { label: "Where to look next", hint: "Progress leaders and risk distribution tell you which projects are fine and which need eyes today." },
          { label: "Recent alerts", hint: "The latest warnings across the portfolio — click any row to jump straight to that project." },
        ]} /></div>
      </div>

      {/* ─── four big numbers ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total projects" value={ov.projects} tone="brand" icon={FolderKanban} delay={0}
          footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Currently monitored for {user.name.split(" ").slice(-1)[0]}</div>}
          onClick={() => navigate("projects")} />
        <StatCard title="Total budget" value={inr(ov.budgetL).replace("₹", "₹ ")} tone="green" icon={IndianRupee} delay={0.05}
          footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Approved project value</div>}
          onClick={() => navigate("budget-variance")} />
        <StatCard title="High-risk projects" value={ov.highRisk} tone="red" icon={ShieldAlert} delay={0.1}
          footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">At-risk + critical — need attention</div>}
          onClick={() => navigate("risk-score")} />
        <StatCard title="Unread alerts" value={ov.alertCount} tone="amber" icon={Bell} delay={0.15}
          footer={<div className="mt-1.5 text-[10.5px] text-muted-foreground">Warnings nobody has seen yet</div>}
          onClick={() => navigate("alerts")} />
      </div>

      {/* ─── progress + risk distribution ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border bg-card p-5 shadow-sm">
          <SectionTitle icon={ArrowRight} sub="Physical progress across monitored projects" sub2="Click a bar to open the project">Progress leaders</SectionTitle>
          <div className="mt-2 space-y-4">
            {ov.progressLeaders.map(p => (
              <div key={p.psId} role="button" tabIndex={0} onClick={() => openProject(p.id)}
                onKeyDown={e => e.key === "Enter" && openProject(p.id)}
                className="group cursor-pointer rounded-lg p-1.5 transition hover:bg-muted/50">
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12.5px] font-semibold group-hover:underline">{p.name}</span>
                  <span className="shrink-0 tabular text-[12.5px] font-bold">{p.progress}%</span>
                </div>
                <ProgressBar value={p.progress} />
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="rounded-xl border bg-card p-5 shadow-sm">
          <SectionTitle icon={ShieldAlert} sub="Current project risk classification" sub2="Based on the 0–100 health score">Risk distribution</SectionTitle>
          <div className="mt-3 space-y-4">
            {ov.riskDistribution.map(r => {
              const color = r.label.startsWith("Low") ? "#22c55e" : r.label.startsWith("Medium") ? "#f59e0b" : "#ef4444";
              return (
                <div key={r.label}>
                  <div className="mb-1.5 flex justify-between text-[12.5px]">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{r.label}</span>
                    <span className="tabular font-semibold">{r.count} {r.count === 1 ? "project" : "projects"} ({r.pct}%)</span>
                  </div>
                  <ProgressBar value={r.pct} tone={color} />
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg bg-muted/40 p-3 text-[11.5px] leading-relaxed text-muted-foreground">
            <InfoTip label="How is risk decided?" body="Every project gets a 0–100 health score each time data changes (schedule 30% + budget 25% + resources 20% + milestones 25%). Healthy = Low risk, At-Risk = Medium, Critical = High." />
            {" "}Low risk needs no action today — Medium deserves a look — High has a recommended action waiting on the Risk Scores page.
          </div>
          <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => navigate("risk-score")}>
            See every project&apos;s risk score <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </motion.div>
      </div>

      {/* ─── recent alerts ─── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b p-5">
          <SectionTitle icon={Bell} sub="The latest warnings across the portfolio — worst first" sub2="Click any row to jump to the project">Recent alerts</SectionTitle>
        </div>
        <div className="divide-y">
          {ov.recentAlerts.map(a => (
            <div key={`${a.psId}-${a.createdAt}-${a.title}`} role="button" tabIndex={0}
              onClick={() => openProject(a.id)} onKeyDown={e => e.key === "Enter" && openProject(a.id)}
              className="flex cursor-pointer items-center justify-between gap-3 p-4 transition hover:bg-muted/40">
              <div className="flex min-w-0 items-center gap-3">
                <div className={cn("rounded-lg p-2 shrink-0", a.severity === "CRITICAL" ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400" : a.severity === "WARNING" ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" : "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400")}>
                  <Bell className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{a.project}</p>
                  <p className="truncate text-[11.5px] text-muted-foreground">{a.title}</p>
                </div>
              </div>
              <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide",
                a.severity === "CRITICAL" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" : a.severity === "WARNING" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300")}>
                {a.severity === "WARNING" ? "Medium" : a.severity === "CRITICAL" ? "High" : a.severity}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 p-3">
          <span className="text-[11px] text-muted-foreground">Want the full picture with recommended actions and owners?</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("alerts")}>Early Warnings</Button>
            <Button variant="outline" size="sm" onClick={() => { setAiOpen(true); useApp.getState().askAi("Give me a plain-language summary of which projects need attention today and what to do about each."); }}>
              <ShieldAlert className="h-3.5 w-3.5" />Ask Assure Intelligence
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
