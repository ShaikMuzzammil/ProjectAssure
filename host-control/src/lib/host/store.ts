// ProjectAssure Host Control — server-side in-memory state mirror.
//
// The host-control is intentionally stateless across page reloads for the
// user-visible pieces (those live in Zustand + localStorage). But the API
// routes need a single source of truth on the server for sync polling and
// audit-log appends. This module holds that mutable mirror in module scope.
//
// In a production deployment you would swap this for Redis / Vercel KV /
// Postgres; the rest of the code only depends on the exported getters and
// mutators below.

import {
  USERS as SEED_USERS, buildProjects, SEED_APPROVALS, SEED_ALERTS,
  SEED_ACTIVITY, DEFAULT_THRESHOLDS, DEFAULT_INTEGRATION, BUILTIN_AI_STATUS,
  computeSnapshot, ADMIN_PERSONA,
} from "./seed";
import type { PortfolioSnapshot } from "./seed";
import type {
  User, Project, ApprovalItem, AlertItem, AuditEntry, ActivityEvent,
  BudgetThresholds, IntegrationStatus, AiProviderStatus,
} from "./types";

interface HostState {
  users: User[];
  projects: Project[];
  approvals: ApprovalItem[];
  alerts: AlertItem[];
  activity: ActivityEvent[];
  audit: AuditEntry[];
  thresholds: BudgetThresholds;
  integration: IntegrationStatus;
  aiStatus: AiProviderStatus;
  lastResyncAt: string;
}

const state: HostState = {
  users: [...SEED_USERS],
  projects: buildProjects(),
  approvals: [...SEED_APPROVALS],
  alerts: [...SEED_ALERTS],
  activity: [...SEED_ACTIVITY],
  audit: [],
  thresholds: { ...DEFAULT_THRESHOLDS },
  integration: { ...DEFAULT_INTEGRATION },
  aiStatus: { ...BUILTIN_AI_STATUS },
  lastResyncAt: new Date().toISOString(),
};

// ─── Getters ─────────────────────────────────────────────────────────────────
export function getUsers(): User[] { return [...state.users]; }
export function getProjects(): Project[] { return [...state.projects]; }
export function getApprovals(): ApprovalItem[] { return [...state.approvals]; }
export function getAlerts(): AlertItem[] { return [...state.alerts]; }
export function getActivity(): ActivityEvent[] { return [...state.activity].slice(0, 30); }
export function getAudit(): AuditEntry[] { return [...state.audit]; }
export function getThresholds(): BudgetThresholds { return { ...state.thresholds }; }
export function getIntegration(): IntegrationStatus { return { ...state.integration }; }
export function getAiStatus(): AiProviderStatus { return { ...state.aiStatus }; }
export function getSnapshot(): PortfolioSnapshot { return computeSnapshot(state.projects, state.alerts, state.approvals); }
export function getLastResyncAt(): string { return state.lastResyncAt; }
export function getAdmin(): User { return ADMIN_PERSONA; }

// ─── Mutators ────────────────────────────────────────────────────────────────
export function setThresholds(t: BudgetThresholds) { state.thresholds = { ...t }; }
export function setIntegration(patch: Partial<IntegrationStatus>) { state.integration = { ...state.integration, ...patch }; }
export function setAiStatus(s: AiProviderStatus) { state.aiStatus = { ...s }; }
export function markResync() { state.lastResyncAt = new Date().toISOString(); }

export function appendApproval(a: ApprovalItem) {
  const idx = state.approvals.findIndex(x => x.id === a.id);
  if (idx >= 0) state.approvals[idx] = a; else state.approvals.unshift(a);
}

export function appendAlert(a: AlertItem) {
  state.alerts.unshift(a);
  if (state.alerts.length > 200) state.alerts = state.alerts.slice(0, 200);
}

export function ackAlert(id: string, ackBy: string) {
  const idx = state.alerts.findIndex(a => a.id === id);
  if (idx >= 0) {
    state.alerts[idx] = {
      ...state.alerts[idx],
      isRead: true,
      acknowledgedBy: ackBy,
      acknowledgedAt: new Date().toISOString(),
    };
  }
}

export function appendUser(u: User) {
  state.users.unshift(u);
}

export function appendAudit(entry: AuditEntry) {
  state.audit.unshift(entry);
  if (state.audit.length > 500) state.audit = state.audit.slice(0, 500);
}

export function appendActivity(ev: ActivityEvent) {
  state.activity.unshift(ev);
  if (state.activity.length > 50) state.activity = state.activity.slice(0, 50);
}

/** "Force resync" — pushes a fresh timestamp + a synthetic activity event.
 *  In production this would re-fetch /api/health + projects list from the
 *  main ProjectAssure URL; here it bumps the mirror state deterministically. */
export function forceResync(): { resyncedAt: string; projectCount: number } {
  markResync();
  appendActivity({
    id: `ev-${Date.now()}`,
    timestamp: new Date().toISOString(),
    kind: "sync",
    message: `Forced resync pulled ${state.projects.length} projects from main ProjectAssure`,
  });
  return { resyncedAt: state.lastResyncAt, projectCount: state.projects.length };
}

/** Probe the main project URL — sets integration.mainProjectReachable. */
export async function probeMainProject(url: string): Promise<{ reachable: boolean; status?: number; error?: string }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${url.replace(/\/$/, "")}/api/health`, { signal: ctrl.signal });
    clearTimeout(t);
    setIntegration({
      mainProjectUrl: url,
      mainProjectReachable: res.ok,
      lastHealthCheck: new Date().toISOString(),
    });
    return { reachable: res.ok, status: res.status };
  } catch (e: any) {
    setIntegration({
      mainProjectUrl: url,
      mainProjectReachable: false,
      lastHealthCheck: new Date().toISOString(),
    });
    return { reachable: false, error: e?.message ?? "fetch_failed" };
  }
}

/** Full snapshot the /api/admin/sync endpoint returns to the polling client. */
export function syncPayload() {
  return {
    snapshot: getSnapshot(),
    users: getUsers(),
    projects: getProjects(),
    approvals: getApprovals(),
    alerts: getAlerts(),
    activity: getActivity(),
    audit: getAudit(),
    thresholds: getThresholds(),
    integration: getIntegration(),
    aiStatus: getAiStatus(),
    lastResyncAt: getLastResyncAt(),
    admin: getAdmin(),
    serverTime: new Date().toISOString(),
  };
}
