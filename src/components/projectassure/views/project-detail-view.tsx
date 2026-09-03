"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, BrainCircuit, CheckCircle2, ChevronRight, Clock, Download,
  FileText, Gauge, MapPin, PlayCircle, ShieldCheck, Sparkles, TrendingUp, Users2,
} from "lucide-react";
import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useAppStore } from "@/store/app-store";
import { DEPARTMENTS } from "@/lib/projectassure/engine";
import { computeBudgetForecast, FEATURE_LABELS } from "@/lib/projectassure/ml";
import { formatDate, formatLakhs, formatDateTime, timeAgo } from "@/lib/projectassure/format";
import { HealthBadge, HealthRing, ProgressBar, SectionTitle, SeverityBadge, StatusBadge } from "../shared/ui-bits";
import { GanttTimeline } from "../shared/gantt";
import { toast } from "sonner";

const TABS = ["overview", "milestones", "budget", "resources", "documents", "risk", "alerts", "audit"] as const;

export function ProjectDetailView() {
  const projects = useAppStore((s) => s.projects);
  const projectId = useAppStore((s) => s.selectedProjectId);
  const tab = useAppStore((s) => s.detailTab);
  const setTab = useAppStore((s) => s.setDetailTab);
  const navigate = useAppStore((s) => s.navigate);
  const askAi = useAppStore((s) => s.askAi);
  const p = projects.find((x) => x.id === projectId) ?? projects[0];

  const forecast = useMemo(() => computeBudgetForecast(p), [p]);
  const [simulating, setSimulating] = useState(false);

  if (!p) return null;
  const dept = DEPARTMENTS.find((d) => d.id === p.departmentId);

  const runPrediction = () => {
    setSimulating(true);
    setTimeout(() => {
      setSimulating(false);
      setTab("risk");
      toast.success("Prediction refreshed", { description: `${(p.prediction!.probability * 100).toFixed(0)}% delay probability · ${p.prediction!.estimatedDays} days est. slip` });
    }, 1400);
  };

  const healthCards = [
    { label: "Schedule", value: p.scheduleScore, weight: "30%", icon: Clock, color: "#0c93e7" },
    { label: "Budget", value: p.budgetScore, weight: "25%", icon: Gauge, color: "#8b5cf6" },
    { label: "Resources", value: p.resourceScore, weight: "20%", icon: Users2, color: "#14b8a6" },
    { label: "Milestones", value: p.milestoneScore, weight: "25%", icon: CheckCircle2, color: "#22c55e" },
  ];

  return (
    <div className="space-y-5">
      {/* breadcrumb */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button onClick={() => navigate("dashboard")} className="text-muted-foreground hover:text-foreground">Command Centre</button>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <button onClick={() => navigate("projects")} className="text-muted-foreground hover:text-foreground">Projects</button>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">{p.name}</span>
      </div>

      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <HealthRing score={p.healthScore} size={84} stroke={8} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{p.name}</h1>
              <HealthBadge status={p.healthStatus} />
              <StatusBadge status={p.status} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-mono">{p.psId}</span>
              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{p.district}, {p.state}</span>
              <span>{p.sector} · {p.scheme}</span>
              <span>{dept?.name}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={runPrediction} disabled={simulating} className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60">
            <PlayCircle className={`h-4 w-4 ${simulating ? "animate-pulse text-[#0c93e7]" : ""}`} />{simulating ? "Scoring…" : "Run prediction"}
          </button>
          <button onClick={() => { downloadReport(p); toast.success("PDF-style status report exported"); }} className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium transition-colors hover:bg-muted">
            <Download className="h-4 w-4" /> Export report
          </button>
          <button onClick={() => askAi(`Why is ${p.name} at risk?`)} className="inline-flex items-center gap-1.5 rounded-md bg-[#0c93e7] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0b426e] active:scale-[0.98]">
            <ShieldCheck className="h-4 w-4" /> Ask AI
          </button>
        </div>
      </div>

      {/* 4 health dimension cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {healthCards.map((h, i) => (
          <motion.div key={h.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"><h.icon className="h-3.5 w-3.5" />{h.label}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">w {h.weight}</span>
            </div>
            <div className="mt-2 flex items-end justify-between">
              <span className="text-2xl font-bold tabular-nums" style={{ color: h.value >= 75 ? "#16a34a" : h.value >= 50 ? "#d97706" : "#dc2626" }}>{h.value}</span>
              <div className="w-20"><ProgressBar value={h.value} /></div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Gantt + AI prediction */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <SectionTitle title="Timeline & Critical Path" sub="Dependency-aware Gantt · red diamond = planned, filled = actual" />
          <div className="mt-4 overflow-x-auto"><GanttTimeline milestones={p.milestones} /></div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="flex flex-col gap-4">
          {/* prediction card */}
          {p.prediction && (
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold"><BrainCircuit className="h-4 w-4 text-[#8b5cf6]" />AI Delay Prediction</h3>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{p.prediction.modelVersion}</span>
              </div>
              <div className="mt-3 flex items-center gap-4">
                <div className="relative flex h-20 w-20 items-center justify-center">
                  <svg className="h-20 w-20 -rotate-90">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="#e2e8f0" strokeWidth="7" className="dark:opacity-20" />
                    <circle cx="40" cy="40" r="34" fill="none" stroke={p.prediction.probability > 0.6 ? "#ef4444" : p.prediction.probability > 0.3 ? "#f59e0b" : "#22c55e"} strokeWidth="7" strokeLinecap="round" strokeDasharray={2 * Math.PI * 34} strokeDashoffset={2 * Math.PI * 34 * (1 - p.prediction.probability)} />
                  </svg>
                  <span className="absolute text-lg font-bold tabular-nums">{Math.round(p.prediction.probability * 100)}%</span>
                </div>
                <div className="text-sm">
                  <p className="font-semibold">delay probability</p>
                  <p className="mt-0.5 text-muted-foreground">estimated slip <strong className="text-foreground">{p.prediction.estimatedDays} days</strong></p>
                  <p className="text-xs text-muted-foreground">90% CI: {p.prediction.ciLower}–{p.prediction.ciUpper} days · confidence {Math.round(p.prediction.confidence * 100)}%</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Top factors (SHAP)</p>
                {p.prediction.factors.slice(0, 3).map((f) => (
                  <div key={f.feature} className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs">
                    <span className="truncate">{FEATURE_LABELS[f.feature] ?? f.feature}</span>
                    <span className={`shrink-0 font-semibold tabular-nums ${f.contribution > 0 ? "text-[#dc2626]" : "text-[#16a34a]"}`}>{f.contribution > 0 ? "+" : ""}{f.contribution}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => { setTab("risk"); }} className="mt-3 w-full rounded-md border border-input py-1.5 text-xs font-semibold text-[#0c93e7] transition-colors hover:bg-[#e0effe]">
                View full factor waterfall
              </button>
            </div>
          )}

          {/* key facts */}
          <div className="rounded-lg border border-border bg-card p-5 text-sm shadow-sm">
            <h3 className="mb-3 font-semibold">Key facts</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              {[
                ["Sanctioned", formatLakhs(p.totalBudget)],
                ["Spent", `${formatLakhs(p.spentBudget)} (${Math.round((p.spentBudget / p.totalBudget) * 100)}%)`],
                ["Projected final", formatLakhs(p.projectedBudget)],
                ["Projected overrun", `${(((p.projectedBudget - p.totalBudget) / p.totalBudget) * 100).toFixed(1)}%`],
                ["Start", formatDate(p.startDate)],
                ["Target", formatDate(p.targetDate)],
                ["Project Manager", p.projectManager],
                ["Contractor", p.contractor],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            {p.story && (
              <div className="mt-3 rounded-md bg-[#fef3c7]/70 p-2.5 text-xs leading-relaxed text-[#b45309] dark:bg-amber-500/10 dark:text-amber-300">
                <Sparkles className="mr-1 inline h-3 w-3" />{p.story}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* tabs */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="flex gap-1 overflow-x-auto border-b border-border px-3 pt-2 custom-scrollbar">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-t-md px-3.5 py-2.5 text-sm font-medium capitalize transition-colors ${tab === t ? "border-b-2 border-[#0c93e7] text-[#0c93e7]" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t}{t === "alerts" && p.alerts.length > 0 && <span className="ml-1 rounded-full bg-[#fee2e2] px-1.5 text-[10px] font-bold text-[#b91c1c]">{p.alerts.filter((a) => !a.isRead).length}</span>}
              {t === "documents" && <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-bold">{p.documents.length}</span>}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === "overview" && <OverviewTab p={p} />}
          {tab === "milestones" && <MilestonesTab p={p} />}
          {tab === "budget" && <BudgetTab p={p} forecast={forecast} />}
          {tab === "resources" && <ResourcesTab p={p} />}
          {tab === "documents" && <DocumentsTab p={p} />}
          {tab === "risk" && <RiskTab p={p} />}
          {tab === "alerts" && <AlertsTab p={p} />}
          {tab === "audit" && <AuditTab p={p} />}
        </div>
      </div>
    </div>
  );
}

/* ── tabs ───────────────────────────────────────────────── */
function OverviewTab({ p }: { p: ReturnType<typeof useAppStore.getState>["projects"][number] }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <h3 className="mb-2 font-semibold">About</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{p.description}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <Fact icon={Clock} k="Duration" v={`${Math.round((new Date(p.targetDate).getTime() - new Date(p.startDate).getTime()) / 2592000000)} months`} />
          <Fact icon={TrendingUp} k="Progress vs elapsed" v={p.prediction ? `${p.prediction.factors.find((f) => f.feature === "progress_vs_elapsed")?.value ?? "—"}×` : "—"} />
          <Fact icon={Users2} k="Team" v={`${p.resources.filter((r) => r.category === "HUMAN").reduce((s, r) => s + r.allocated, 0)} allocated`} />
          <Fact icon={FileText} k="Documents" v={`${p.documents.length} processed`} />
        </div>
      </div>
      <div>
        <h3 className="mb-2 font-semibold">Recent alert history</h3>
        {p.alerts.length ? (
          <div className="space-y-2">
            {p.alerts.slice(0, 3).map((a) => (
              <div key={a.id} className="rounded-md border border-border p-2.5 text-xs">
                <div className="flex items-center justify-between"><SeverityBadge severity={a.severity} /><span className="text-muted-foreground">{timeAgo(a.createdAt)}</span></div>
                <p className="mt-1.5 font-medium">{a.title}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">No alerts — this project is running clean.</p>}
      </div>
    </div>
  );
}

function Fact({ icon: Icon, k, v }: { icon: React.ElementType; k: string; v: string }) {
  return (
    <div className="rounded-md border border-border p-2.5">
      <p className="flex items-center gap-1 text-muted-foreground"><Icon className="h-3 w-3" />{k}</p>
      <p className="mt-0.5 font-semibold">{v}</p>
    </div>
  );
}

function MilestonesTab({ p }: { p: never | { milestones: import("@/lib/projectassure/types").Milestone[] } }) {
  const ms = (p as { milestones: import("@/lib/projectassure/types").Milestone[] }).milestones;
  return (
    <div className="space-y-2.5">
      {ms.map((m) => {
        const color = m.status === "COMPLETED" ? "#22c55e" : m.status === "IN_PROGRESS" ? "#0c93e7" : m.status === "DELAYED" ? "#f59e0b" : m.status === "BLOCKED" ? "#ef4444" : "#94a3b8";
        return (
          <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/40">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {m.isCritical && <span className="mr-1 text-[10px] font-bold text-[#ef4444]">◆ CRITICAL</span>}
                {m.name}
              </p>
              <p className="text-[11px] text-muted-foreground">Planned {formatDate(m.plannedDate)} · {m.actualDate ? `Actual ${formatDate(m.actualDate)}` : "not completed"} · weight {m.weight}</p>
            </div>
            <div className="w-24 shrink-0"><ProgressBar value={m.progress} /></div>
            <span className="w-20 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>{m.status.replace("_", "-")}</span>
          </div>
        );
      })}
    </div>
  );
}

function BudgetTab({ p, forecast }: { p: { totalBudget: number }; forecast: ReturnType<typeof computeBudgetForecast> }) {
  const data = forecast.points;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat k="Sanctioned" v={formatLakhs(p.totalBudget)} />
        <MiniStat k="Projected final" v={formatLakhs(forecast.projectedFinal)} tone={forecast.overrunPct > 10 ? "red" : "green"} />
        <MiniStat k="Projected overrun" v={`${forecast.overrunPct}%`} tone={forecast.overrunPct > 10 ? "red" : "green"} />
        <MiniStat k="Threshold" v="10% warn / 20% critical" />
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} interval={Math.max(0, Math.floor(data.length / 10))} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => `${Math.round(v / 100)}Cr`} width={46} />
            <Tooltip formatter={(v: number, k: string) => [formatLakhs(v, { compact: true }), k]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={p.totalBudget} stroke="#ef4444" strokeDasharray="6 4" label={{ value: "Sanctioned", fontSize: 10, fill: "#ef4444", position: "insideTopRight" }} />
            <Area type="monotone" dataKey="upper" stroke="none" fill="url(#projGrad)" name="Forecast CI upper" />
            <Area type="monotone" dataKey="lower" stroke="none" fill="#ffffff" fillOpacity={0} name=" " />
            <Line type="monotone" dataKey="planned" stroke="#0b426e" strokeWidth={2} dot={false} name="Planned (cum)" />
            <Line type="monotone" dataKey="actual" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 2 }} name="Actual (cum)" />
            <Line type="monotone" dataKey="projected" stroke="#8b5cf6" strokeWidth={2.5} strokeDasharray="7 4" dot={false} name="Projected (Prophet-style)" connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">
        Model: linear-extrapolation surrogate of Prophet with seasonality ramp · interval spread widens with horizon · forecast recomputed after every invoice upload.
      </p>
    </div>
  );
}

function MiniStat({ k, v, tone }: { k: string; v: string; tone?: "red" | "green" }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p>
      <p className={`mt-1 text-sm font-bold tabular-nums ${tone === "red" ? "text-[#dc2626]" : tone === "green" ? "text-[#16a34a]" : ""}`}>{v}</p>
    </div>
  );
}

function ResourcesTab({ p }: { p: { resources: import("@/lib/projectassure/types").ResourceAllocation[] } }) {
  const cats = { HUMAN: "bg-[#e0effe] text-[#015ca0]", EQUIPMENT: "bg-[#dcfce7] text-[#15803d]", MATERIAL: "bg-[#fef3c7] text-[#b45309]" };
  return (
    <div className="space-y-2">
      {p.resources.map((r) => {
        const hot = r.utilised > 90;
        return (
          <div key={r.id} className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${hot ? "border-[#f59e0b]/60 bg-[#fef3c7]/40 dark:bg-amber-500/5" : "border-border"} transition-colors hover:bg-muted/40`}>
            <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${cats[r.category]}`}>{r.category}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{r.name} {hot && <span className="ml-1 text-[10px] font-bold text-[#b45309]">⚠ BOTTLENECK</span>}</p>
              <p className="text-[11px] text-muted-foreground">{r.allocated} {r.unit} allocated · {r.utilised}% utilised</p>
            </div>
            <div className="w-32"><ProgressBar value={r.utilised} /></div>
          </div>
        );
      })}
      <p className="pt-2 text-xs text-muted-foreground">Bottleneck rule: utilisation &gt;90% flags queueing risk; the 18-feature model weights it as a leading delay indicator.</p>
    </div>
  );
}

function DocumentsTab({ p }: { p: { documents: import("@/lib/projectassure/types").DocumentItem[] } }) {
  return (
    <div className="space-y-2">
      {p.documents.map((d) => (
        <div key={d.id} className="rounded-lg border border-border p-3.5 transition-colors hover:bg-muted/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4 text-[#dc2626]" />{d.fileName}</p>
            <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-bold text-[#15803d] dark:bg-green-500/15 dark:text-green-300">PROCESSED · {Math.round(d.fileSize / 1024)} KB</span>
          </div>
          {d.summary && <p className="mt-2 rounded-md bg-muted/60 p-2.5 text-xs leading-relaxed text-muted-foreground">🤖 {d.summary}</p>}
          <p className="mt-1.5 text-[11px] text-muted-foreground">Uploaded by {d.uploadedBy} · {timeAgo(d.uploadedAt)} · {d.extractedData?.fieldsCaptured} fields extracted from {d.extractedData?.totalPages} pages</p>
        </div>
      ))}
    </div>
  );
}

function RiskTab({ p }: { p: NonNullable<unknown> & { prediction?: import("@/lib/projectassure/types").PredictionResult; riskAssessment?: import("@/lib/projectassure/types").RiskAssessment } }) {
  const pred = (p as { prediction?: import("@/lib/projectassure/types").PredictionResult }).prediction;
  const ra = (p as { riskAssessment?: import("@/lib/projectassure/types").RiskAssessment }).riskAssessment;
  const factors = pred?.factors ?? [];
  const maxAbs = Math.max(...factors.map((f) => Math.abs(f.contribution)), 0.001);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div>
        <h3 className="mb-1 font-semibold">Prediction factor waterfall</h3>
        <p className="mb-3 text-xs text-muted-foreground">Log-odds contributions · positive pushes delay risk up · sigmoid({(pred ? "margin" : "")}) → {(pred?.probability ?? 0).toFixed(2)}</p>
        <div className="space-y-2">
          {factors.map((f) => {
            const w = (Math.abs(f.contribution) / maxAbs) * 100;
            const pos = f.contribution > 0;
            return (
              <div key={f.feature} className="text-xs">
                <div className="flex justify-between"><span className="font-medium">{FEATURE_LABELS[f.feature] ?? f.feature}</span><span className={`font-bold tabular-nums ${pos ? "text-[#dc2626]" : "text-[#16a34a]"}`}>{pos ? "+" : ""}{f.contribution}</span></div>
                <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${pos ? "bg-[#ef4444]" : "bg-[#22c55e]"}`} style={{ width: `${w / 2}%`, marginLeft: pos ? "50%" : `${50 - w / 2}%` }} />
                </div>
                <p className="mt-1 text-muted-foreground">{f.plainLanguage}</p>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <h3 className="mb-3 font-semibold">Formal risk assessment</h3>
        {ra ? (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[["Schedule", ra.scheduleRisk], ["Budget", ra.budgetRisk], ["Resource", ra.resourceRisk], ["Overall", ra.overallRisk]].map(([k, v]) => (
                <div key={k as string} className="rounded-lg border border-border p-2.5">
                  <p className="text-lg font-bold tabular-nums text-[#dc2626]">{v as number}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">{k as string}</p>
                </div>
              ))}
            </div>
            <span className="inline-flex rounded-full bg-[#fee2e2] px-3 py-1 text-xs font-bold text-[#b91c1c] dark:bg-red-500/15 dark:text-red-300">RISK LEVEL: {ra.riskLevel}</span>
            <div className="space-y-2">
              {ra.factors.map((f) => (
                <div key={f.factor} className="rounded-md border border-border p-2.5 text-xs">
                  <div className="flex items-center justify-between"><p className="font-semibold">{f.factor}</p><span className="font-bold text-[#dc2626]">{f.impact}</span></div>
                  <p className="mt-1 text-muted-foreground">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">No formal risk assessment — healthy projects don&rsquo;t receive one until a scoring run flags them.</p>
        )}
      </div>
    </div>
  );
}

function AlertsTab({ p }: { p: { alerts: import("@/lib/projectassure/types").Alert[] } }) {
  if (!p.alerts.length) return <p className="py-8 text-center text-sm text-muted-foreground">No alerts recorded for this project.</p>;
  return (
    <div className="space-y-3">
      {p.alerts.map((a) => (
        <div key={a.id} className={`rounded-lg border p-3.5 ${a.isRead ? "border-border opacity-70" : "border-[#bae0fd] bg-[#f0f7ff]/60 dark:bg-[#064f85]/10"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SeverityBadge severity={a.severity} />
            <span className="text-[11px] text-muted-foreground">{formatDateTime(a.createdAt)}{a.isRead ? " · read" : ""}</span>
          </div>
          <p className="mt-2 text-sm font-semibold">{a.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{a.description}</p>
          <div className="mt-2.5 rounded-md border border-[#bae0fd]/70 bg-white/70 p-2.5 text-xs dark:bg-white/5">
            <p className="font-semibold text-[#015ca0] dark:text-sky-300">🤖 Recommended action <span className="ml-1 font-normal text-muted-foreground">({a.recommendedOwner}, {a.recommendedDeadline})</span></p>
            <p className="mt-0.5">{a.recommendedAction}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditTab({ p }: { p: { auditTrail: import("@/lib/projectassure/types").AuditLogEntry[] } }) {
  const ACTION_COLORS: Record<string, string> = { CREATE: "bg-green-100 text-green-700", UPDATE: "bg-blue-100 text-blue-700", DELETE: "bg-red-100 text-red-700", LOGIN: "bg-slate-100 text-slate-600", EXPORT: "bg-purple-100 text-purple-700", AI_ACCEPT: "bg-emerald-100 text-emerald-700", AI_OVERRIDE: "bg-orange-100 text-orange-700" };
  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">Append-only governance log · every mutation, AI acceptance and export is recorded (never orphaned).</p>
      <div className="space-y-0">
        {p.auditTrail.map((e, i) => (
          <div key={e.id} className="relative flex gap-3 pb-4 pl-1">
            {i < p.auditTrail.length - 1 && <div className="absolute left-[13px] top-6 h-full w-px bg-border" />}
            <span className={`z-10 mt-0.5 h-6 w-6 shrink-0 rounded-full text-center text-[9px] font-bold leading-6 ${ACTION_COLORS[e.action]}`}>{e.action.slice(0, 2)}</span>
            <div className="text-xs">
              <p className="font-medium">{e.details}</p>
              <p className="mt-0.5 text-muted-foreground">{e.action} · {e.entity} · {e.userName} · {formatDateTime(e.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function downloadReport(p: { name: string; psId: string; healthScore: number; progress: number; totalBudget: number; spentBudget: number; alerts: { title: string }[] }) {
  const text = `PROJECTASSURE STATUS REPORT\n============================\nProject: ${p.name} (${p.psId})\nGenerated: ${new Date().toLocaleString("en-IN")}\n\nHealth Score: ${p.healthScore}/100\nProgress: ${p.progress}%\nBudget: INR ${(p.totalBudget / 100).toFixed(2)} Cr sanctioned / ${(p.spentBudget / 100).toFixed(2)} Cr spent\n\nOpen Alerts (${p.alerts.length}):\n${p.alerts.map((a, i) => `${i + 1}. ${a.title}`).join("\n")}\n\nGenerated by ProjectAssure - SIH 2026 (simulated PDF export).`;
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${p.psId}-status-report.txt`; a.click();
  URL.revokeObjectURL(url);
}
