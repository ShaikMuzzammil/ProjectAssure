export type HealthStatus = "HEALTHY" | "AT_RISK" | "CRITICAL";
export type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type ApprovalStatus = "PENDING" | "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED";
export type UserRole = "ADMIN" | "PROJECT_MANAGER" | "STAKEHOLDER" | "VIEWER";
export type HostViewId = "dashboard" | "approvals" | "budget-risk" | "alerts" | "users" | "intelligence" | "integrations" | "demo" | "audit";

export interface User { id: string; name: string; email: string; role: UserRole; source: "DEMO" | "FRESH_USER"; avatarInitials: string; designation: string; department: string; isActive: boolean; lastLoginAt?: string; createdAt: string; }
export interface Project { id: string; psId: string; name: string; status: string; healthScore: number; healthStatus: HealthStatus; totalBudgetL: number; spentBudgetL: number; projectedBudgetL: number; variancePct: number; progress: number; department: string; state: string; sector: string; source: "DEMO" | "FRESH_USER"; }
export interface ApprovalItem { id: string; type: string; title: string; description: string; projectName: string; projectPsId: string; raisedBy: string; raisedAt: string; status: ApprovalStatus; reviewedBy?: string; reviewedAt?: string; reviewNote?: string; }
export interface AlertItem { id: string; severity: AlertSeverity; title: string; description: string; projectName: string; projectPsId: string; pathway: "demo" | "fresh" | "broadcast"; isRead: boolean; createdAt: string; recommendedAction: string; recommendedOwner: string; recommendedDeadline: string; }
export interface AuditEntry { id: string; action: string; entityType: string; note: string; by: string; at: string; }
export interface ActivityEvent { id: string; kind: string; title: string; at: string; projectId?: string; }
export interface ChatMessage { id: string; role: "user" | "assistant"; content: string; createdAt: string; }
export interface PortfolioSnapshot { totalProjects: number; freshProjects: number; totalSanctionedL: number; totalSpentL: number; totalProjectedL: number; openAlerts: number; pendingApprovals: number; criticalProjects: number; atRiskProjects: number; healthyProjects: number; avgHealth: number; portfolioVariancePct: number; healthBand: { healthy: number; atRisk: number; critical: number }; topRisky: Project[]; topOverruns: Project[]; }
export interface IntegrationStatus { mainProjectUrl: string; mainProjectReachable: boolean | null; lastHealthCheck?: string; aiProviderConnected: boolean; emailServiceConnected: boolean; webhookUrl: string; webhookSecret: string; lastSyncAt?: string; syncActive: boolean; }
export interface AiProviderStatus { connected: boolean; tier: string; label: string; model: string | null; }
export interface BudgetThresholds { amberAt: number; redAt: number; budgetWarnPct: number; budgetCriticalPct: number; delayProbEmailAt: number; }
