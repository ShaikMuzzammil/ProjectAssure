"use client";
// ═══════════════════════════════════════════════════════════════════════════
// PREDICTION ENGINE (v23 — focused & simple).
// WHAT IT IS FOR: it answers one question early — "will this project miss
// its deadline, and why?" — 30–60 days before the slip shows up in progress
// reports. Three things only:
//   1. How it works  — plain-language explanation + the 18 signals it reads
//   2. Predict       — live delay risk for every project, re-run in one click
//   3. Train         — train a model on YOUR portfolio and promote a champion
// ═══════════════════════════════════════════════════════════════════════════
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { useApp } from "@/store/app-store";
import { extractFeatures, FEATURE_LABELS } from "@/lib/projectassure/ml";
import { trainModel, modelCard, type TrainedModel } from "@/lib/projectassure/ml-lab";
import { downloadCsv } from "@/lib/projectassure/reports";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  FlaskConical, Cpu, Loader2, FileDown, Zap, TrendingUp, Check, Info, Radar, SlidersHorizontal, ChevronDown, ChevronUp,
} from "lucide-react";

const TABS = [
  { id: "how", label: "How it works" },
  { id: "predict", label: "Predict now" },
  { id: "train", label: "Train & compare" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function ModelLabView() {
  const projects = useApp(s => s.scoped)();
  const user = useApp(s => s.user)!;
  const mlModels = useApp(s => s.mlModels);
  const mlChampionId = useApp(s => s.mlChampionId);
  const trainMlModel = useApp(s => s.trainMlModel);
  const promoteMlModel = useApp(s => s.promoteMlModel);
  const deleteMlModel = useApp(s => s.deleteMlModel);
  const runPrediction = useApp(s => s.runPrediction);
  const recordExport = useApp(s => s.recordExport);
  const [tab, setTab] = useState<TabId>("how");
  const [predictingId, setPredictingId] = useState<string | null>(null);

  // ─── training state (simple defaults, advanced behind one toggle) ───
  const [algo, setAlgo] = useState<"logistic" | "gbm-stumps">("logistic");
  const [epochs, setEpochs] = useState(240);
  const [lr, setLr] = useState(0.16);
  const [l2, setL2] = useState(0.012);
  const [augment, setAugment] = useState(8);
  const [advanced, setAdvanced] = useState(false);
  const [training, setTraining] = useState(false);

  const canTrain = user.role === "ADMIN" || user.role === "PROJECT_MANAGER";
  const champion = mlModels.find(m => m.id === mlChampionId) ?? null;

  const runTraining = async () => {
    setTraining(true);
    await new Promise(r => setTimeout(r, 60));
    const res = trainMlModel({ algorithm: algo, epochs, lr, l2, augment });
    setTraining(false);
    if ("error" in res) {
      toast.error("Training failed", { description: res.error });
      return;
    }
    toast.success(`${res.name} trained`, {
      description: `Held-out: AUC ${res.metricsTest.auc} · accuracy ${res.metricsTest.accuracy} on ${res.testSize} real projects`,
    });
    setTab("train");
  };

  const doPredict = (id: string) => {
    setPredictingId(id);
    setTimeout(() => {
      runPrediction(id);
      setPredictingId(null);
      toast.success("Prediction re-run", { description: "Delay probability, slip estimate and factor ranking recomputed from live data." });
    }, 350);
  };

  const exportModelCard = (m: TrainedModel) => {
    downloadCsv(
      [["Field", "Value"], ...modelCard(m).map(line => [line.split(":")[0], line.slice(line.indexOf(":") + 1).trim()])],
      `projectassure-modelcard-${m.algorithm}-${new Date(m.trainedAt).toISOString().slice(0, 10)}.csv`
    );
    recordExport(`Model card (${m.name})`, "csv", "held-out metrics + hyperparameters");
  };

  // prediction rows for the "Predict" tab
  const rows = useMemo(() => projects
    .filter(p => p.status !== "CANCELLED")
    .map(p => ({
      id: p.id, psId: p.psId, name: p.name, status: p.status,
      health: Math.round(p.healthScore),
      prob: Math.round((p.prediction?.probability ?? 0) * 100),
      days: p.prediction?.estimatedDays ?? 0,
      baseline: p.prediction?.isBaseline ?? false,
      factors: (p.prediction?.factors ?? []).slice(0, 3),
    }))
    .sort((a, b) => b.prob - a.prob), [projects]);

  const chartData = rows.slice(0, 10).map(r => ({ name: r.psId, risk: r.prob, health: r.health }));

  return (
    <div className="mx-auto max-w-[1000px] space-y-5">
      {/* header — WHAT this engine is for, in plain words */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Prediction Engine</h1>
          <p className="mt-0.5 max-w-[640px] text-[12.5px] leading-relaxed text-muted-foreground">
            Answers one question early: <strong className="text-foreground">will this project miss its deadline — and why?</strong>
            It reads 18 live signals (milestones, burn pace, resources, weather window…) and flags risk 30–60 days before
            the slip appears in progress reports, with the top driving factors named.
            {champion ? ` Champion model: ${champion.name}.` : " Built-in engine scores every project until you train your own champion."}
          </p>
        </div>
        <Button
          onClick={runTraining}
          disabled={training || !canTrain}
          className="gap-2 bg-gradient-to-r from-[#0b426e] to-[#0c93e7] text-white hover:from-[#0b426e] hover:to-[#0a80cf]"
        >
          {training ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4" />}
          {training ? "Training…" : "Train a model now"}
        </Button>
      </div>

      {!canTrain && (
        <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-[11.5px] text-sky-800 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300">
          Your role can view predictions and train models in demo mode; only Admin / Project Manager promotions apply to live scoring.
        </div>
      )}

      {/* tabs */}
      <div className="flex gap-1.5 rounded-xl border bg-card p-1.5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex-1 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition",
              tab === t.id ? "bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]" : "text-muted-foreground hover:bg-muted")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB 1 · HOW IT WORKS ─── */}
      {tab === "how" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2 text-[13px] font-bold"><FlaskConical className="h-4 w-4 text-[#0c93e7]" />What the engine does</div>
            <ol className="mt-3 space-y-2.5">
              {[
                { n: "1", title: "Reads 18 live signals per project", body: "Milestone pace, budget burn vs plan, resource utilisation, delayed tasks, monsoon window, contractor status and more — straight from your project data." },
                { n: "2", title: "Scores delay probability", body: "A number between 0–100%: how likely the project is to miss its target date, plus the estimated slip in days and a 90% confidence interval." },
                { n: "3", title: "Names the driving factors", body: "The top reasons behind the score, ranked — so you act on causes, not symptoms." },
                { n: "4", title: "Fires alerts automatically", body: "Crossing 70% delay probability queues the HIGH alert + email; the Early Warnings page and notifications pick it up." },
              ].map(s => (
                <li key={s.n} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0c93e7]/10 text-[11px] font-bold text-[#0c93e7]">{s.n}</span>
                  <div>
                    <div className="text-[12.5px] font-semibold">{s.title}</div>
                    <div className="text-[11.5px] leading-relaxed text-muted-foreground">{s.body}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2 text-[13px] font-bold"><Radar className="h-4 w-4 text-[#0c93e7]" />The 18 signals it reads</div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {Object.values(FEATURE_LABELS).map(label => (
                <span key={label} className="rounded-full bg-muted px-2.5 py-1 text-[10.5px] font-medium text-muted-foreground">{label}</span>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
              Signals update whenever milestones, budget records, tasks or documents change — predictions never run on stale numbers.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2 text-[13px] font-bold"><Info className="h-4 w-4 text-[#0c93e7]" />How to use it day-to-day</div>
            <ul className="mt-2.5 space-y-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              <li>· <strong className="text-foreground">Weekly:</strong> open Predict now → re-run the top 3 riskiest projects → read the factors.</li>
              <li>· <strong className="text-foreground">After any change:</strong> predictions recompute automatically on milestone/task/budget updates.</li>
              <li>· <strong className="text-foreground">With 3+ projects:</strong> train your own model on the Train tab and promote it — every prediction re-scores with it.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ─── TAB 2 · PREDICT NOW ─── */}
      {tab === "predict" && (
        <div className="space-y-4">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-[12.5px] text-muted-foreground">
              No projects to predict yet — create a project and its baseline prediction appears here instantly.
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-2 flex items-center gap-2 text-[12px] font-bold"><TrendingUp className="h-4 w-4 text-[#0c93e7]" />Delay risk — worst first (top 10)</div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 9.5 }} interval={0} angle={-25} textAnchor="end" height={44} />
                      <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                      <RTooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Bar dataKey="risk" radius={[4, 4, 0, 0]}>
                        {chartData.map((d, i) => (
                          <Cell key={i} fill={d.risk > 70 ? "#dc2626" : d.risk > 50 ? "#f59e0b" : d.risk > 30 ? "#eab308" : "#10b981"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-2">
                {rows.map(r => (
                  <motion.div key={r.id} layout className="rounded-xl border bg-card p-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10.5px] font-bold text-[#0c93e7]">{r.psId}</span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{r.name}</span>
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold tabular",
                        r.prob > 70 ? "bg-rose-500/15 text-rose-600" : r.prob > 50 ? "bg-amber-500/15 text-amber-700" : r.prob > 30 ? "bg-yellow-500/15 text-yellow-700" : "bg-emerald-500/15 text-emerald-600")}>
                        {r.prob}% delay risk
                      </span>
                      <span className="text-[10.5px] text-muted-foreground">est. slip +{r.days}d{r.baseline ? " · baseline" : ""}</span>
                      <Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" disabled={predictingId === r.id} onClick={() => doPredict(r.id)}>
                        <Zap className="h-3 w-3" /> Re-run
                      </Button>
                    </div>
                    {r.factors.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.factors.map(f => (
                          <span key={f.label} className="rounded bg-amber-100/60 px-1.5 py-0.5 text-[9.5px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{f.label}</span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── TAB 3 · TRAIN & COMPARE ─── */}
      {tab === "train" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2 text-[13px] font-bold"><SlidersHorizontal className="h-4 w-4 text-[#0c93e7]" />Train on your portfolio</div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
              Trains a real model (gradient descent, in-browser, no server) on your non-cancelled projects and evaluates it
              on held-out ones. Promote it as champion and every prediction re-scores with it.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 text-[11px] font-semibold text-muted-foreground">Algorithm</div>
                <div className="grid grid-cols-2 gap-2">
                  {(["logistic", "gbm-stumps"] as const).map(a => (
                    <button key={a} onClick={() => setAlgo(a)}
                      className={cn("rounded-lg border p-2.5 text-left transition",
                        algo === a ? "border-[#0c93e7] bg-[#e0effe]/60 dark:bg-[#0c93e7]/10" : "hover:border-[#0c93e7]/40")}>
                      <div className="text-[11.5px] font-bold">{a === "logistic" ? "Logistic regression" : "Boosted stumps"}</div>
                      <div className="text-[9.5px] text-muted-foreground">{a === "logistic" ? "stable · interpretable" : "sharp on small data"}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-end">
                <Button onClick={runTraining} disabled={training || !canTrain} className="h-10 w-full gap-2">
                  {training ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4" />}
                  {training ? "Training…" : "Train model"}
                </Button>
              </div>
            </div>
            {/* advanced hyperparameters — collapsed by default */}
            <button onClick={() => setAdvanced(a => !a)} className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
              {advanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} Advanced hyperparameters
            </button>
            {advanced && (
              <div className="mt-2 grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-3 sm:grid-cols-4">
                {([[ "Epochs", epochs, setEpochs, 40, 600, 20], ["Learning rate", lr, setLr, 0.02, 0.5, 0.01], ["L2 ridge", l2, setL2, 0, 0.2, 0.002], ["Augment ×", augment, setAugment, 2, 20, 1]] as const).map(([label, val, setter, min, max, step]) => (
                  <label key={label} className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label} · {val}</span>
                    <input type="range" value={val} min={min} max={max} step={step}
                      onChange={e => (setter as (v: number) => void)(Number(e.target.value))}
                      className="mt-1 w-full accent-[#0c93e7]" />
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* trained models */}
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-[12px] font-bold">
              <Check className="h-4 w-4 text-[#0c93e7]" />Trained models ({mlModels.length}){champion && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9.5px] font-bold text-emerald-600">champion: {champion.name}</span>}
            </div>
            {mlModels.length === 0 ? (
              <p className="px-1 py-4 text-[12px] text-muted-foreground">No models trained yet — the built-in engine handles all predictions meanwhile. Need at least 3 non-cancelled projects to train.</p>
            ) : (
              <div className="space-y-2">
                {mlModels.map(m => (
                  <div key={m.id} className={cn("rounded-lg border p-3", m.id === mlChampionId && "border-emerald-300/60 bg-emerald-50/30 dark:bg-emerald-500/5")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-bold">{m.name}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[9.5px] font-semibold">{m.algorithm}</span>
                      <span className="text-[10.5px] text-muted-foreground">AUC {m.metricsTest.auc} · acc {m.metricsTest.accuracy} · {m.testSize} held-out</span>
                      <div className="ml-auto flex items-center gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 text-[10.5px]" onClick={() => exportModelCard(m)}><FileDown className="h-3 w-3" /> Card</Button>
                        {m.id === mlChampionId
                          ? <span className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white">champion</span>
                          : <Button size="sm" className="h-7 bg-[#0284c7] text-[10.5px] text-white" onClick={() => { promoteMlModel(m.id); toast.success("Champion promoted", { description: "Every live prediction re-scored with the new champion." }); }}>Promote</Button>}
                        <Button size="sm" variant="ghost" className="h-7 text-[10.5px] text-rose-600" onClick={() => deleteMlModel(m.id)}>Delete</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
