// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure — Live event engine (v8: real-time release).
// A deterministic portfolio heartbeat that advances the world while you watch:
// health drifts, milestones complete, budget lines post, NEW ALERTS FIRE,
// and predictions are genuinely re-scored — running client-side so the demo
// works offline and on free hosting with zero infrastructure.
// v8 changes: 15-second heartbeat · own (Planning) projects participate ·
// "new-alert" events actually fire · prediction-run events re-score for real.
// ═══════════════════════════════════════════════════════════════════════════
import type { Project, LiveEvent, Notification, Alert, User, ThresholdSettings } from "./types";
import { uid } from "./format";
import { computeDelayPrediction } from "./ml";

export interface EventOutcome {
  event: LiveEvent;
  notifications: Notification[];
  alert?: Alert;
  projectPatch?: { projectId: string; patch: Partial<Project> };
}

export function nextPortfolioEvent(projects: Project[], user: User | null, thresholds: ThresholdSettings, tick: number): EventOutcome {
  // v8: monitoring follows EVERY live project — including the user's own
  // freshly created ones (Planning included; they are what you're watching).
  const monitored = projects.filter(p => p.status === "ACTIVE" || p.status === "PLANNING" || p.status === "ON_HOLD");
  const active = projects.filter(p => p.status === "ACTIVE");
  const exceptions = monitored.filter(p => p.healthStatus !== "HEALTHY");
  const kinds: LiveEvent["kind"][] = ["milestone-completed", "budget-update", "health-drift", "new-alert", "document-processed", "prediction-run"];
  const kind = kinds[tick % kinds.length];
  const now = new Date();
  const ev: LiveEvent = { id: uid("ev"), kind, title: "", detail: "", at: now.toISOString() };
  const notifications: Notification[] = [];

  const rand = (seed: number) => Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
  const pick = <T,>(xs: T[], seed: number): T | undefined => xs.length ? xs[Math.floor(rand(seed) * xs.length) % xs.length] : undefined;

  if (kind === "milestone-completed" && monitored.length) {
    const p = pick(monitored, tick)!;
    const pending = p.milestones.filter(m => m.status === "IN_PROGRESS" || m.status === "PENDING");
    if (pending.length) {
      const m = pending[0];
      ev.projectId = p.id;
      ev.title = `Milestone completed — ${p.psId}`;
      ev.detail = `${m.name} marked COMPLETED on field report verification.`;
      notifications.push({ id: uid("nt"), userId: "all", title: `✅ Milestone completed — ${p.name.replace(/,.*$/, "")}`, message: `${m.name} completed. Project progress advanced to ${Math.min(100, p.progress + 2)}%.`, type: "SYSTEM", isRead: false, createdAt: now.toISOString(), linkView: "project-detail", linkProjectId: p.id });
      ev.kind = "milestone-completed";
      return { event: ev, notifications, projectPatch: { projectId: p.id, patch: { progress: Math.min(100, p.progress + 2) } } };
    }
  }
  if (kind === "budget-update" && monitored.length) {
    const p = (exceptions.length && rand(tick + 3) > 0.4 ? exceptions[0] : pick(monitored, tick + 7))!;
    const spend = Math.max(2, Math.round(p.totalBudget * 0.004 * (1 + rand(tick + 11) * 0.8)));
    ev.projectId = p.id;
    ev.title = `Budget line posted — ${p.psId}`;
    ev.detail = `₹${spend} lakh certified this cycle; dashboards and burn charts refreshed.`;
    notifications.push({ id: uid("nt"), userId: "all", title: `💰 Budget posted — ${p.name.replace(/,.*$/, "")}`, message: `₹${spend} lakh expenditure certified. Spent: ₹${(p.spentBudget + spend)} L.`, type: "SYSTEM", isRead: false, createdAt: now.toISOString(), linkView: "project-detail", linkProjectId: p.id });
    return { event: ev, notifications, projectPatch: { projectId: p.id, patch: { spentBudget: p.spentBudget + spend } } };
  }
  if (kind === "health-drift" && monitored.length) {
    const p = (exceptions.length ? pick(exceptions, tick + 5) : pick(monitored, tick + 5))!;
    const delta = rand(tick + 13) > 0.5 ? 1 : -1;
    const newScore = Math.max(20, Math.min(96, p.healthScore + delta));
    ev.projectId = p.id;
    ev.title = `Health drift — ${p.psId}`;
    ev.detail = `Composite health ${p.healthScore} → ${newScore} after the latest data refresh.`;
    let alert: Alert | undefined;
    if (delta < 0 && newScore < thresholds.redAt && !p.alerts.some(a => a.type === "RISK_LEVEL_CHANGE" && a.severity === "CRITICAL")) {
      alert = {
        id: uid("al"), projectId: p.id, title: "Portfolio-critical: project health entered the Red band",
        description: `Health ${newScore} (Red). Rule R10 applies — human officer verification required before escalation.`, severity: "CRITICAL", type: "RISK_LEVEL_CHANGE", isRead: false, createdAt: now.toISOString(),
        recommendedAction: "Verify field data with the executive engineer, then escalate to the administrative ministry.", recommendedOwner: "Arun Kulkarni (JS, MoSPI)", recommendedDeadline: "within 48 hours", emailQueued: true,
      };
      notifications.push({ id: uid("nt"), userId: "all", title: `🔴 CRITICAL — ${p.name.replace(/,.*$/, "")} entered Red`, message: `Health ${newScore}. R10 verification required; critical email queued.`, type: "ALERT", isRead: false, createdAt: now.toISOString(), linkView: "alerts", linkProjectId: p.id });
    }
    return { event: ev, notifications, alert, projectPatch: { projectId: p.id, patch: { healthScore: newScore } } };
  }
  if (kind === "new-alert" && monitored.length) {
    // v8: the early-warning rule engine fires a REAL new alert with a
    // recommended action — this is the "alerts in real time" heartbeat.
    const p = pick(monitored, tick + 19)!;
    const reg = p.prediction;
    const prob = reg ? reg.probability : 0.2;
    const menu: { title: string; description: string; type: Alert["type"]; action: string }[] = [
      { title: `Early warning: burn velocity +${28 + Math.floor(rand(tick + 23) * 14)}%`, description: "Burn velocity deviation crossed the +30% early-warning rule for this cycle. Fires before an overrun materialises.", type: "BUDGET_OVERRUN", action: "Review the rate-approval pipeline for the biggest package; re-forecast cost at completion." },
      { title: `Early warning: delay probability ${Math.round(prob * 100)}% trending up`, description: `The prediction engine re-scored this project and the delay probability moved up. Advisory only — officer verification per rule R10.`, type: "DELAY_PREDICTION", action: "Work the top-2 driving factors first (see the prediction tab) and hold a recovery review." },
      { title: "Early warning: report freshness slipping", description: "The reporting window is closing and no new field document has arrived for this project in the monitoring cycle.", type: "DATA_STALENESS", action: "Automated reminder issued to the field reporting officer." },
    ];
    const m = menu[tick % menu.length];
    ev.projectId = p.id;
    ev.kind = "new-alert";
    ev.title = `New alert — ${p.psId}`;
    ev.detail = `${m.title}. Recommended action attached.`;
    const alert: Alert = {
      id: uid("al"), projectId: p.id, title: m.title, description: m.description,
      severity: m.type === "DATA_STALENESS" ? "LOW" : "HIGH", type: m.type, isRead: false, createdAt: now.toISOString(),
      recommendedAction: m.action, recommendedOwner: p.projectManager, recommendedDeadline: "within 7 days", emailQueued: m.type !== "DATA_STALENESS",
    };
    notifications.push({ id: uid("nt"), userId: "all", title: `🚨 ${m.title} — ${p.name.replace(/,.*$/, "")}`, message: m.description.slice(0, 120) + "…", type: "ALERT", isRead: false, createdAt: now.toISOString(), linkView: "alerts", linkProjectId: p.id });
    return { event: ev, notifications, alert };
  }
  if (kind === "document-processed" && monitored.length) {
    const p = pick(monitored, tick + 17)!;
    ev.projectId = p.id;
    ev.title = `Document processed — ${p.psId}`;
    ev.detail = `Field report ingested: smart reading → structuring → validation completed in 38s; risk register refreshed.`;
    notifications.push({ id: uid("nt"), userId: "all", title: `📄 Document processed — ${p.name.replace(/,.*$/, "")}`, message: `Monthly report ingested; 24 fields auto-captured and validated; risk register re-derived.`, type: "DOCUMENT", isRead: false, createdAt: now.toISOString(), linkView: "reports", linkProjectId: p.id });
    return { event: ev, notifications };
  }
  // prediction-run — v8: genuinely re-score one monitored project so the
  // prediction card visibly changes while you watch the project page.
  ev.kind = "prediction-run";
  if (monitored.length) {
    const p = pick(monitored, tick + 29)!;
    const fresh = computeDelayPrediction(p);
    const pct = Math.round(fresh.probability * 100);
    ev.projectId = p.id;
    ev.title = `Prediction re-scored — ${p.psId}`;
    ev.detail = `Live scoring cycle: delay probability now ${pct}% (est. slip ${fresh.estimatedDays}d · CI ${fresh.ciLower}–${fresh.ciUpper}).`;
    notifications.push({ id: uid("nt"), userId: "all", title: `🔮 Prediction refreshed — ${p.name.replace(/,.*$/, "")}`, message: `Delay probability ${pct}% · est. slip ${fresh.estimatedDays} days · top factor: ${fresh.factors[0]?.label ?? "n/a"}.`, type: "PREDICTION", isRead: false, createdAt: now.toISOString(), linkView: "project-detail", linkProjectId: p.id });
    return { event: ev, notifications, projectPatch: { projectId: p.id, patch: { prediction: fresh } } };
  }
  ev.title = "Prediction run completed";
  ev.detail = `Monitoring cycle complete: ${monitored.length} projects re-scored; no risk-level changes.`;
  return { event: ev, notifications };
}

export const LIVE_EVENT_INTERVAL_MS = 15000;

export function eventIcon(kind: LiveEvent["kind"]): string {
  return { "health-drift": "📊", "milestone-completed": "✅", "budget-update": "💰", "new-alert": "🚨", "document-processed": "📄", "prediction-run": "🔮", system: "⚙️" }[kind];
}
