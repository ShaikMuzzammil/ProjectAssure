"use client";
// ═══════════════════════════════════════════════════════════════════════════
// PREDICTION ENGINE — ML Lab (v21, fully real).
// Train actual models in your browser (logistic regression / boosted stumps,
// real gradient descent, real held-out metrics), run 5,000-path Monte Carlo
// cost simulations, milestone survival analysis, damped burn forecasts,
// PSI drift and robust anomalies — nothing on this page is decoration.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid, Cell,
  LineChart, Line, AreaChart, Area, ReferenceLine, ScatterChart, Scatter,
} from "recharts";
import { useApp } from "@/store/app-store";
import { SectionTitle } from "../shared/ui-bits";
import { extractFeatures, FEATURE_LABELS } from "@/lib/projectassure/ml";
import {
  trainModel, monteCarlo, milestoneSurvival, forecastBurn, computeDrift, detectAnomalies,
  modelCard, type TrainedModel,
} from "@/lib/projectassure/ml-lab";
import { buildWorld } from "@/lib/projectassure/seed";
import { downloadCsv } from "@/lib/projectassure/reports";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  FlaskConical, Cpu, RefreshCw, Check, Loader2, FileDown, Zap, TrendingUp, ShieldCheck,
  Dices, Waves, Radar, Activity, Sparkles, ChevronRight, Info,
} from "lucide-react";

const TABS = [
  { id: "how", label: "How this works" },
  { id: "train", label: "Train & compare" },
  { id: "simulate", label: "Monte Carlo" },
  { id: "survival", label: "Milestones" },
  { id: "forecast", label: "Burn forecast" },
  { id: "signals", label: "Signals & anomalies" },
  { id: "drift", label: "Drift" },
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
  const recordExport = useApp(s => s.recordExport);
  const [tab, setTab] = useState<TabId>("how");

  // ─── training state ───
  const [algo, setAlgo] = useState<"logistic" | "gbm-stumps">("logistic");
  const [epochs, setEpochs] = useState(240);
  const [lr, setLr] = useState(0.16);
  const [l2, setL2] = useState(0.012);
  const [augment, setAugment] = useState(8);
  const [training, setTraining] = useState(false);
  const [justTrained, setJustTrained] = useState<string | null>(null);

  // ─── simulation state ───
  const thresholds = useApp(s => s.thresholds);
  const candidates = projects.filter(p => p.status === "ACTIVE" || p.status === "ON_HOLD");
  const [simProjectId, setSimProjectId] = useState(candidates[0]?.id ?? "");
  const [simRuns, setSimRuns] = useState(5000);
  const simProject = projects.find(p => p.id === simProjectId) ?? candidates[0];

  const canTrain = user.role === "ADMIN" || user.role === "PROJECT_MANAGER";

  const runTraining = async () => {
    setTraining(true);
    await new Promise(r => setTimeout(r, 60)); // let the spinner paint
    const res = trainMlModel({ algorithm: algo, epochs, lr, l2, augment });
    setTraining(false);
    if ("error" in res) {
      toast.error("Training failed", { description: res.error });
      return;
    }
    setJustTrained(res.id);
    toast.success(`${res.name} trained`, {
      description: `Held-out: AUC ${res.metricsTest.auc} · accuracy ${res.metricsTest.accuracy} · F1 ${res.metricsTest.f1} on ${res.testSize} real projects`,
    });
    setTab("train");
  };

  const champion = mlModels.find(m => m.id === mlChampionId) ?? null;

  // ─── computed panels (all real, memoised) ───
  const mc = useMemo(
    () => (simProject ? monteCarlo(simProject, thresholds, simRuns, 42) : null),
    [simProject, thresholds, simRuns]
  );
  const survival = useMemo(
    () => (simProject ? milestoneSurvival(projects, simProject.id) : []),
    [projects, simProject]
  );
  const forecast = useMemo(() => (simProject ? forecastBurn(simProject) : null), [simProject]);
  const anomalies = useMemo(() => detectAnomalies(projects), [projects]);
  const anchorWorld = useMemo(() => buildWorld().projects, []);
  const drift = useMemo(() => computeDrift(anchorWorld, projects), [anchorWorld, projects]);
  const signalRows = useMemo(() => {
    if (!simProject) return [];
    const f = extractFeatures(simProject);
    return Object.entries(FEATURE_LABELS).map(([k, label]) => ({ key: k, label, value: f[k as keyof typeof f] }));
  }, [simProject]);

  const exportModelCard = (m: TrainedModel) => {
    downloadCsv(
      [["Field", "Value"], ...modelCard(m).map(line => [line.split(":")[0], line.slice(line.indexOf(":") + 1).trim()])],
      `projectassure-modelcard-${m.algorithm}-${new Date(m.trainedAt).toISOString().slice(0, 10)}.csv`
    );
    recordExport(`Model card (${m.name})`, "csv", "held-out metrics + hyperparameters");
  };

  return (
    <div className="mx-auto max-w-[1000px] space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Prediction Engine</h1>
          <p className="mt-0.5 max-w-[640px] text-[12.5px] leading-relaxed text-muted-foreground">
            Real in-browser machine learning: train on your portfolio, evaluate on held-out projects,
            simulate costs with 5,000 Monte Carlo paths, and promote a champion that re-scores every
            live prediction. {champion ? `Champion now: ${champion.name}.` : "No champion yet — the built-in engine scores predictions until you train one."}
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
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <Info className="h-3.5 w-3.5 shrink-0" /> Training is an administrator/project-manager action — you can explore every panel read-only.
        </div>
      )}

      {/* tabs */}
      <div className="custom-scrollbar flex gap-1 overflow-x-auto border-b pb-px">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("shrink-0 rounded-t-lg px-3 py-2 text-[12px] font-semibold transition",
              tab === t.id ? "border-b-2 border-[#0c93e7] text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ HOW THIS WORKS ═══ */}
      {tab === "how" && (
        <div className="space-y-4">
          <SectionTitle icon={FlaskConical} sub="every stage runs locally — no black boxes">The pipeline, honestly</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { n: "1", t: "Data → labels", d: "Each project's milestone history produces an honest binary label: missed deadline evidence (delayed/blocked milestones, past-due open items, late completions). Nothing is hand-labelled." },
              { n: "2", t: "18 signals → features", d: "The same feature extraction the health engine uses: completion, adherence, burn velocity, dependency health, bottlenecks, seasonality, procurement lag…" },
              { n: "3", t: "Split + augment", d: "Deterministic shuffle, 70/30 train/test. The TEST set is only real projects. The train set is bootstrap-augmented with 12% Gaussian noise at 0.55 weight to widen the sample." },
              { n: "4", t: "Two learners", d: "Logistic regression: standardised features, mini-batch gradient descent, L2 ridge, decaying learning rate, full loss curve. Or gradient-boosted stumps: real boosting on log-loss residuals." },
              { n: "5", t: "Evaluate for real", d: "Accuracy, precision, recall, F1, ROC-AUC (Mann–Whitney exact), log-loss, Brier, confusion matrix, reliability diagram — all computed on the untouched held-out projects." },
              { n: "6", t: "Promote a champion", d: "One click re-scores every live project prediction with the trained model, shows real per-feature log-odds contributions, and logs the promotion to the audit trail." },
            ].map(s => (
              <motion.div key={s.n} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#e0effe] text-[11px] font-bold text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]">{s.n}</span>
                  <div className="text-[13px] font-bold">{s.t}</div>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{s.d}</p>
              </motion.div>
            ))}
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-900 dark:bg-sky-950/40">
            <div className="flex items-center gap-2 text-[13px] font-bold text-sky-800 dark:text-sky-200"><Sparkles className="h-4 w-4" /> Beyond classification</div>
            <p className="mt-1 text-[12px] leading-relaxed text-sky-800/80 dark:text-sky-200/70">
              Monte Carlo (5,000 paths) prices cost overrun with P50/P80/P95 and a tornado of drivers ·
              Kaplan–Meier-style survival turns portfolio milestone history into per-milestone completion
              windows · Holt's damped-trend forecast projects burn with erf-based confidence bands ·
              PSI drift compares today's feature distribution to the seeded anchor · robust MAD z-scores
              flag portfolio anomalies.
            </p>
          </div>
        </div>
      )}

      {/* ═══ TRAIN & COMPARE ═══ */}
      {tab === "train" && (
        <div className="space-y-4">
          {/* hyperparameters */}
          <div className="rounded-2xl border bg-card p-4">
            <SectionTitle icon={Cpu} sub="changed hyperparameters change every metric below — that's the point">Training configuration</SectionTitle>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Algorithm</div>
                  <div className="grid grid-cols-2 gap-2">
                    {([["logistic", "Logistic Regression", "standardised GD + L2 ridge"], ["gbm-stumps", "Boosted Stumps", "boosting on log-loss residuals"]] as const).map(([id, name, desc]) => (
                      <button key={id} onClick={() => setAlgo(id)} disabled={!canTrain}
                        className={cn("rounded-xl border p-3 text-left transition disabled:opacity-60",
                          algo === id ? "border-[#0c93e7] bg-[#e0effe]/60 dark:bg-[#0c93e7]/10" : "hover:border-muted")}>
                        <div className="text-[12px] font-bold">{name}</div>
                        <div className="mt-0.5 text-[10.5px] text-muted-foreground">{desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span>Augmentation multiplier</span><span className="text-foreground">×{augment}</span>
                  </div>
                  <input type="range" min={0} max={20} step={2} value={augment} disabled={!canTrain}
                    onChange={e => setAugment(Number(e.target.value))} className="w-full accent-[#0c93e7]" />
                  <div className="text-[10.5px] text-muted-foreground">0 = train purely on real rows · test set is always real</div>
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { label: "Epochs" , value: epochs, set: setEpochs, min: 60, max: 600, step: 20, hint: "logistic only — gradient descent passes" },
                  { label: "Learning rate", value: lr, set: setLr, min: 0.02, max: 0.5, step: 0.02, hint: "with 2% per-epoch decay" },
                  { label: "L2 ridge", value: l2, set: setL2, min: 0, max: 0.1, step: 0.002, hint: "logistic only — weight shrinkage" },
                ].map(s => (
                  <div key={s.label}>
                    <div className="mb-1 flex justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      <span>{s.label}</span><span className="text-foreground">{s.value}</span>
                    </div>
                    <input type="range" min={s.min} max={s.max} step={s.step} value={s.value} disabled={!canTrain || (s.label !== "Epochs" && algo === "gbm-stumps" && s.label === "L2 ridge")}
                      onChange={e => s.set(Number(e.target.value))} className="w-full accent-[#0c93e7]" />
                    <div className="text-[10.5px] text-muted-foreground">{s.hint}</div>
                  </div>
                ))}
                <Button onClick={runTraining} disabled={training || !canTrain} className="w-full gap-2">
                  {training ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {training ? "Running gradient descent…" : `Train ${algo === "logistic" ? "logistic regression" : "boosted stumps"}`}
                </Button>
              </div>
            </div>
          </div>

          {/* model cards */}
          <SectionTitle icon={ShieldCheck} sub="metrics are held-out — computed on real projects the model never saw">{`Trained models (${mlModels.length})`}</SectionTitle>
          {mlModels.length === 0 && (
            <div className="rounded-xl border border-dashed p-8 text-center text-[12.5px] text-muted-foreground">
              No models trained yet. Press <b>Train a model now</b> — with 30 seeded projects it takes
              about a second, and every metric below becomes real.
            </div>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            {mlModels.map(m => {
              const t = m.metricsTest;
              const isChampion = m.id === mlChampionId;
              const isNew = m.id === justTrained;
              return (
                <motion.div key={m.id} initial={isNew ? { opacity: 0, scale: 0.97 } : undefined} animate={{ opacity: 1, scale: 1 }}
                  className={cn("rounded-2xl border p-4", isChampion ? "border-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-900" : "bg-card")}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-bold">{m.name}</span>
                        {isChampion && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">champion</span>}
                      </div>
                      <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                        {new Date(m.trainedAt).toLocaleString("en-IN")} · {m.trainedOn} rows ({m.realRows} real) · test {m.testSize} real
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => exportModelCard(m)} title="Export model card CSV" className="rounded-lg border p-1.5 hover:bg-muted"><FileDown className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { deleteMlModel(m.id); toast("Model removed", { description: `${m.name} deleted from the registry.` }); }} title="Remove" className="rounded-lg border p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"><span className="text-[12px] font-bold">×</span></button>
                    </div>
                  </div>

                  {/* held-out metrics grid */}
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {[["AUC", t.auc], ["Accuracy", t.accuracy], ["F1", t.f1], ["Recall", t.recall], ["Precision", t.precision], ["Log-loss", t.logLoss], ["Brier", t.brier], ["Rows", t.n]].map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-muted/50 px-2 py-1.5 text-center">
                        <div className="text-[13px] font-bold tabular">{v}</div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{k}</div>
                      </div>
                    ))}
                  </div>

                  {/* confusion + calibration */}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Confusion (held-out)</div>
                      <div className="grid grid-cols-2 gap-1 text-center text-[11px]">
                        <div className="rounded bg-emerald-100 py-1.5 dark:bg-emerald-950"><b>TP {t.tp}</b><div className="text-[9px] text-muted-foreground">missed · flagged</div></div>
                        <div className="rounded bg-amber-100 py-1.5 dark:bg-amber-950"><b>FP {t.fp}</b><div className="text-[9px] text-muted-foreground">on-time · flagged</div></div>
                        <div className="rounded bg-rose-100 py-1.5 dark:bg-rose-950"><b>FN {t.fn}</b><div className="text-[9px] text-muted-foreground">missed · missed</div></div>
                        <div className="rounded bg-slate-100 py-1.5 dark:bg-slate-800"><b>TN {t.tn}</b><div className="text-[9px] text-muted-foreground">on-time · cleared</div></div>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Reliability (real bins)</div>
                      <div className="h-[86px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 4, right: 6, bottom: 2, left: -18 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                            <XAxis type="number" dataKey="predicted" domain={[0, 1]} ticks={[0, 0.5, 1]} tick={{ fontSize: 9 }} />
                            <YAxis type="number" dataKey="observed" domain={[0, 1]} ticks={[0, 0.5, 1]} tick={{ fontSize: 9 }} />
                            <RTooltip contentStyle={{ fontSize: 11 }} formatter={(v: number, n: string) => [v, n === "predicted" ? "avg. predicted" : "observed rate"]} />
                            <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="#94a3b8" strokeDasharray="4 4" />
                            <Scatter data={m.calibration} fill="#0c93e7" />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* loss curve */}
                  <div className="mt-3">
                    <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                      Training loss (real, per {m.algorithm === "logistic" ? "epoch" : "boosting round"})
                    </div>
                    <div className="h-[70px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={m.lossCurve.map((v, i) => ({ i, v }))} margin={{ top: 4, right: 6, bottom: 0, left: -22 }}>
                          <YAxis tick={{ fontSize: 9 }} domain={["dataMin", "dataMax"]} />
                          <RTooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => [v, "log-loss"]} labelFormatter={i => `${m.algorithm === "logistic" ? "Epoch" : "Round"} ${i}`} />
                          <Line dataKey="v" stroke="#0c93e7" strokeWidth={1.6} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* top factors */}
                  <div className="mt-3">
                    <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Top signals ({m.algorithm === "logistic" ? "|weight| after standardisation" : "accumulated split gain"})</div>
                    <div className="space-y-1">
                      {m.importance.slice(0, 5).map(f => (
                        <div key={f.feature} className="flex items-center gap-2 text-[11px]">
                          <span className="w-[170px] shrink-0 truncate text-muted-foreground">{f.label}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#0c93e7] to-[#0b426e]" style={{ width: `${Math.min(100, (f.value / (m.importance[0]?.value || 1)) * 100)}%` }} />
                          </div>
                          <span className="w-12 shrink-0 text-right tabular font-semibold">{f.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    {isChampion ? (
                      <div className="flex-1 rounded-lg bg-emerald-50 py-2 text-center text-[11.5px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Powers every live prediction ✓</div>
                    ) : (
                      <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => { promoteMlModel(m.id); toast.success("Champion promoted", { description: `${m.name} now re-scores all live predictions.` }); }}>
                        <Check className="h-3.5 w-3.5" /> Promote to champion (re-score portfolio)
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ MONTE CARLO ═══ */}
      {tab === "simulate" && (
        <div className="space-y-4">
          <SectionTitle icon={Dices} sub="5,000 sampled futures from THIS project's own burn behaviour">Monte Carlo cost & schedule simulation</SectionTitle>
          <div className="flex flex-wrap items-center gap-2">
            <select value={simProjectId} onChange={e => setSimProjectId(e.target.value)} className="rounded-lg border bg-card px-3 py-2 text-[12.5px]">
              {candidates.map(p => <option key={p.id} value={p.id}>{p.psId} — {p.name.slice(0, 44)}</option>)}
            </select>
            <select value={simRuns} onChange={e => setSimRuns(Number(e.target.value))} className="rounded-lg border bg-card px-3 py-2 text-[12.5px]">
              {[1000, 5000, 10000].map(r => <option key={r} value={r}>{r.toLocaleString()} runs</option>)}
            </select>
          </div>

          {mc && simProject && (
            <>
              <div className="grid gap-2 sm:grid-cols-4">
                {[
                  { k: "P50 overrun", v: `${mc.overrunPct.p50}%`, c: mc.overrunPct.p50 <= 0 ? "text-emerald-600" : mc.overrunPct.p50 < 10 ? "text-amber-600" : "text-rose-600" },
                  { k: "P80 overrun", v: `${mc.overrunPct.p80}%`, c: "text-amber-600" },
                  { k: "P95 overrun", v: `${mc.overrunPct.p95}%`, c: "text-rose-600" },
                  { k: "P(cost > sanction)", v: `${Math.round(mc.probOverrun * 100)}%`, c: mc.probOverrun > 0.5 ? "text-rose-600" : "text-emerald-600" },
                ].map(s => (
                  <div key={s.k} className="rounded-xl border bg-card p-3 text-center">
                    <div className={cn("text-[19px] font-extrabold tabular", s.c)}>{s.v}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.k}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border bg-card p-4">
                <div className="text-[12px] font-bold">Overrun distribution ({mc.runs.toLocaleString()} runs · mean {mc.overrunPct.mean}% · σ {mc.overrunPct.sigma}%)</div>
                <div className="mt-2 h-[190px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mc.histogram} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                      <XAxis dataKey="bucket" tick={{ fontSize: 9 }} interval={0} angle={-25} textAnchor="end" height={40} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <RTooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => [v, "paths"]} />
                      <ReferenceLine x={mc.histogram.findIndex(h => Number(h.bucket.replace("%", "")) > 0) >= 0 ? mc.histogram[mc.histogram.findIndex(h => Number(h.bucket.replace("%", "")) > 0)].bucket : undefined} stroke="#e11d48" strokeDasharray="4 3" label={{ value: "breakeven", fontSize: 9, position: "top" }} />
                      <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                        {mc.histogram.map((h, i) => (
                          <Cell key={i} fill={Number(h.bucket.replace("%", "")) <= 0 ? "#10b981" : Number(h.bucket.replace("%", "")) < 15 ? "#f59e0b" : "#e11d48"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border bg-card p-4">
                  <div className="text-[12px] font-bold">Tornado — what moves the P80 (driver ±25%, 1,200 re-runs each)</div>
                  <div className="mt-3 space-y-2.5">
                    {mc.tornado.map(t => {
                      const min = Math.min(t.low, t.high), max = Math.max(t.low, t.high);
                      const all = mc.tornado.flatMap(x => [x.low, x.high]);
                      const lo = Math.min(...all), hi = Math.max(...all);
                      const left = ((min - lo) / (hi - lo || 1)) * 100;
                      const width = ((max - min) / (hi - lo || 1)) * 100;
                      return (
                        <div key={t.driver}>
                          <div className="flex justify-between text-[11px]"><span className="font-medium">{t.driver}</span><span className="tabular text-muted-foreground">{t.low}% → {t.high}%</span></div>
                          <div className="relative mt-1 h-3 rounded bg-muted">
                            <div className="absolute top-0 h-3 rounded bg-gradient-to-r from-sky-400 to-sky-700" style={{ left: `${left}%`, width: `${Math.max(3, width)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-2xl border bg-card p-4">
                  <div className="text-[12px] font-bold">Schedule risk (same 5,000 futures)</div>
                  <div className="mt-3 space-y-2 text-[12px]">
                    {[
                      ["Median delay beyond plan", `${mc.delayDays.p50} days`],
                      ["P80 delay", `${mc.delayDays.p80} days`],
                      ["P95 delay", `${mc.delayDays.p95} days`],
                      ["P(deadline missed)", `${Math.round(mc.probDeadlineMiss * 100)}%`],
                      ["Final cost at P80", `${mc.finalCostPct.p80}% of sanction`],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-dashed pb-1.5">
                        <span className="text-muted-foreground">{k}</span><span className="font-bold tabular">{v}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
                    Drivers are THIS project's live burn imbalance, velocity deviation, slip rate and remaining scope —
                    with a rare 8% external-shock event and Gaussian noise. Deterministic (seed {mc.seed}).
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ SURVIVAL ═══ */}
      {tab === "survival" && (
        <div className="space-y-4">
          <SectionTitle icon={Waves} sub="portfolio history → expected completion window per milestone">Milestone survival analysis</SectionTitle>
          <div className="rounded-2xl border bg-card p-4">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2">Milestone</th><th>Status</th><th>Planned</th><th>Expected</th><th>Risk</th><th className="hidden md:table-cell">Hazard note</th>
                </tr>
              </thead>
              <tbody>
                {survival.map(m => (
                  <tr key={m.milestoneId} className="border-b border-dashed last:border-0">
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-1.5 font-semibold">{m.isCritical && <span title="critical" className="text-rose-500">◆</span>}{m.name}</div>
                    </td>
                    <td><span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">{m.status}</span></td>
                    <td className="tabular text-muted-foreground">{new Date(m.plannedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}</td>
                    <td className="tabular font-semibold">{new Date(m.expectedCompletion).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}</td>
                    <td>
                      <span className={cn("rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase",
                        m.riskBand === "low" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : m.riskBand === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300")}>{m.riskBand}</span>
                    </td>
                    <td className="hidden max-w-[320px] py-2 text-[10.5px] leading-snug text-muted-foreground md:table-cell">{m.hazardNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[10.5px] text-muted-foreground">
              Ratios come from every completed milestone across the {projects.length}-project portfolio (observed duration ÷ planned duration) —
              median for the central estimate, P85 for the pessimistic band.
            </p>
          </div>
        </div>
      )}

      {/* ═══ FORECAST ═══ */}
      {tab === "forecast" && forecast && (
        <div className="space-y-4">
          <SectionTitle icon={TrendingUp} sub="Holt's damped trend on the cumulative spend series">Burn-rate forecast</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-4">
            {[
              ["α / β / φ", `${forecast.alpha} / ${forecast.beta} / ${forecast.phi}`],
              ["RMSE (fit)", `${forecast.rmse} L`],
              ["Projected final", `₹${(forecast.projectedFinal / 100).toFixed(1)} Cr`],
              ["P(within sanction)", `${Math.round(forecast.probWithinSanction * 100)}%`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border bg-card p-3 text-center">
                <div className="text-[16px] font-extrabold tabular">{v}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <div className="text-[12px] font-bold">
              Cumulative spend — actual (planned-cadence scaled) vs forecast with 80% band
              {forecast.breachMonth && <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">breach {forecast.breachMonth}</span>}
            </div>
            {forecast.points.length > 0 ? (
              <div className="mt-2 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecast.points} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={(v: number) => `${(v / 100).toFixed(0)}Cr`} />
                    <RTooltip contentStyle={{ fontSize: 11 }} formatter={(v: number, n: string) => [`₹${(v / 100).toFixed(1)} Cr`, n === "actual" ? "spend to date" : n === "fitted" ? "forecast" : n === "upper" ? "P80 upper" : "P80 lower"]} />
                    <ReferenceLine y={forecast.sanction} stroke="#e11d48" strokeDasharray="5 4" label={{ value: "sanction", fontSize: 9, fill: "#e11d48", position: "insideTopLeft" }} />
                    <Area dataKey="lower" stroke="none" fill="#0c93e7" fillOpacity={0.08} />
                    <Area dataKey="upper" stroke="none" fill="#0c93e7" fillOpacity={0.12} />
                    <Line dataKey="actual" stroke="#0b426e" strokeWidth={2.2} dot={{ r: 2 }} />
                    <Line dataKey="fitted" stroke="#0c93e7" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="p-6 text-center text-[12px] text-muted-foreground">Not enough budget records on this project yet (needs 3+).</div>
            )}
          </div>
        </div>
      )}

      {/* ═══ SIGNALS & ANOMALIES ═══ */}
      {tab === "signals" && (
        <div className="space-y-4">
          <SectionTitle icon={Radar} sub={`current feature vector for ${simProject?.psId ?? "—"}`}>18 signals, live</SectionTitle>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {signalRows.map(f => (
              <div key={f.key} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2">
                <span className="truncate text-[11.5px] text-muted-foreground">{f.label}</span>
                <span className="ml-2 shrink-0 font-bold tabular">{typeof f.value === "number" ? (Math.abs(f.value) >= 100 ? Math.round(f.value) : f.value) : "—"}</span>
              </div>
            ))}
          </div>

          <SectionTitle icon={Activity} sub="robust z-scores: median + MAD, |z| ≥ 2 flagged">{`Portfolio anomalies (${anomalies.length})`}</SectionTitle>
          <div className="rounded-2xl border bg-card p-4">
            {anomalies.length === 0 ? (
              <div className="p-4 text-center text-[12px] text-muted-foreground">No anomalies — the portfolio is statistically quiet right now.</div>
            ) : (
              <div className="space-y-1.5">
                {anomalies.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11.5px] odd:bg-muted/40">
                    <span className={cn("rounded px-1.5 py-0.5 text-[9.5px] font-bold tabular",
                      a.severity === "anomaly" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300")}>
                      z {a.z > 0 ? "+" : ""}{a.z}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">{a.psId}</span>
                    <span className="truncate font-medium">{a.name.slice(0, 40)}</span>
                    <span className="ml-auto shrink-0 text-muted-foreground">{a.metric} = {a.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ DRIFT ═══ */}
      {tab === "drift" && (
        <div className="space-y-4">
          <SectionTitle icon={RefreshCw} sub="Population Stability Index — real 10-bin quantile comparison">Feature drift vs the seeded anchor</SectionTitle>
          <div className="rounded-2xl border bg-card p-4">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={drift.map(d => ({ label: d.label.slice(0, 22), psi: d.psi, band: d.band }))} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis type="number" tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 8.5 }} width={140} />
                  <RTooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => [v, "PSI"]} />
                  <ReferenceLine x={0.1} stroke="#10b981" strokeDasharray="4 3" label={{ value: "stable", fontSize: 9, position: "top" }} />
                  <ReferenceLine x={0.25} stroke="#f59e0b" strokeDasharray="4 3" label={{ value: "action", fontSize: 9, position: "top" }} />
                  <Bar dataKey="psi" radius={[0, 3, 3, 0]}>
                    {drift.map((d, i) => <Cell key={i} fill={d.band === "stable" ? "#10b981" : d.band === "watch" ? "#f59e0b" : "#e11d48"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
              PSI compares the distribution of each feature today against the seeded anchor world. Green &lt; 0.10
              (stable), amber &lt; 0.25 (watch), red ≥ 0.25 (retrain trigger). This is the honest drift monitor —
              it moves only when your portfolio actually changes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
