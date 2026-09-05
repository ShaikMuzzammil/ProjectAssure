import { USERS, buildProjects, SEED_APPROVALS, SEED_ALERTS, SEED_ACTIVITY, SEED_AUDIT, DEFAULT_THRESHOLDS, DEFAULT_INTEGRATION, BUILTIN_AI_STATUS, computeSnapshot } from "./seed";
import type { User, Project, ApprovalItem, AlertItem, AuditEntry, ActivityEvent, BudgetThresholds, IntegrationStatus, AiProviderStatus, PortfolioSnapshot } from "./types";

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
}

const state: HostState = {
  users: USERS,
  projects: buildProjects(),
  approvals: SEED_APPROVALS,
  alerts: SEED_ALERTS,
  activity: SEED_ACTIVITY,
  audit: SEED_AUDIT,
  thresholds: DEFAULT_THRESHOLDS,
  integration: DEFAULT_INTEGRATION,
  aiStatus: BUILTIN_AI_STATUS,
};

export function getState() { return state; }
export function getSnapshot(): PortfolioSnapshot { return computeSnapshot(state.projects, state.alerts, state.approvals); }
export function approve(id: string, decision: "approve" | "reject", note: string, by: string) {
  const a = state.approvals.find(x => x.id === id);
  if (a) { a.status = decision === "approve" ? "APPROVED" : "REJECTED"; a.reviewedBy = by; a.reviewedAt = new Date().toISOString(); a.reviewNote = note; }
  state.audit.unshift({ id: `au-${Date.now()}`, action: decision === "approve" ? "AI_ACCEPT" : "AI_OVERRIDE", entityType: "ChangeOrder", note: `${decision === "approve" ? "Approved" : "Rejected"}: ${a?.title} — ${note}`, by, at: new Date().toISOString() });
  return a;
}
export function broadcastAlert(title: string, message: string, severity: AlertItem["severity"], by: string) {
  const a: AlertItem = { id: `ba-${Date.now()}`, severity, title, description: message, projectName: "(broadcast)", projectPsId: "ALL", pathway: "broadcast", isRead: false, createdAt: new Date().toISOString(), recommendedAction: "Read and confirm receipt.", recommendedOwner: by, recommendedDeadline: "End of day" };
  state.alerts.unshift(a);
  state.audit.unshift({ id: `au-${Date.now()}`, action: "ALERT_ACK", entityType: "Alert", note: `Broadcast sent: ${title}`, by, at: new Date().toISOString() });
  return a;
}
export function setIntegration(patch: Partial<IntegrationStatus>) { state.integration = { ...state.integration, ...patch }; }
