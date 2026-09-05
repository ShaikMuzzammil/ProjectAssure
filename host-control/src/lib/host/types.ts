// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure Host Control — Domain Types
// Mirrors a subset of the main prototype's types, plus admin-specific shapes
// for approvals, broadcast alerts, audit trail, and portfolio aggregation.
// ═══════════════════════════════════════════════════════════════════════════

export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
export type HealthStatus = "HEALTHY" | "AT_RISK" | "CRITICAL";
export type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type AlertType =
  | "RISK_LEVEL_CHANGE"
  | "BUDGET_OVERRUN"
  | "MILESTONE_SLIPPAGE"
  | "DATA_STALENESS"
  | "RESOURCE_BOTTLENECK"
  | "DELAY_PREDICTION"
  | "BROADCAST";
export type UserRole = "ADMIN" | "PROJECT_MANAGER" | "STAKEHOLDER" | "VIEWER";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type UserSource = "DEMO" | "FRESH_USER";

// ─── Organisation ───────────────────────────────────────────────────────────
export interface Department {
  id: string;
  name: string;
  code: string;
  ministry: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string;
  avatarInitials: string;
  designation: string;
  persona: string;
  personaDescription: string;
  phone?: string;
  isActive: boolean;
  source: UserSource;
  lastLoginAt?: string;
  createdAt: string;
}

// ─── Project (portfolio mirror) ─────────────────────────────────────────────
export interface Project {
  id: string;
  psId: string;
  name: string;
  status: ProjectStatus;
  healthScore: number;
  healthStatus: HealthStatus;
  scheduleScore: number;
  budgetScore: number;
  resourceScore: number;
  milestoneScore: number;
  startDate: string;
  targetDate: string;
  durationMonths: number;
  progress: number;
  totalBudgetL: number;        // ₹ lakh
  spentBudgetL: number;
  projectedBudgetL: number;
  state: string;
  district: string;
  sector: string;
  scheme: string;
  departmentId: string;
  projectManager: string;
  contractor: string;
  variancePct: number;          // spent vs proportional-plan (positive = over)
  delayDays: number;            // positive = behind
  source: UserSource;
}

// ─── Approvals queue ────────────────────────────────────────────────────────
export type ApprovalType = "CHANGE_ORDER" | "BUDGET_INCREASE" | "EXTENSION_OF_TIME" | "PROCUREMENT";
export type ApprovalStatus = "PENDING" | "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED";
export type ApprovalRecommendation = "approve" | "approve_with_conditions" | "hold_for_evidence" | "reject";

export interface ApprovalItem {
  id: string;
  type: ApprovalType;
  projectId: string;
  projectName: string;
  requester: string;
  departmentId: string;
  amountL?: number;            // for budget increases & change orders
  durationDays?: number;       // for extension of time
  procurementValueL?: number;   // for procurement sign-off
  reason: string;
  riskScore: number;           // 0-100
  recommendation: ApprovalRecommendation;
  status: ApprovalStatus;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
  source: UserSource;
}

// ─── Alerts aggregation ────────────────────────────────────────────────────
export interface AlertItem {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  type: AlertType;
  recommendedAction: string;
  recommendedOwner: string;
  recommendedDeadline: string;
  isRead: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  departmentId: string;
  source: UserSource;
  createdAt: string;
}

// ─── Budget risk configuration ─────────────────────────────────────────────
export interface BudgetThresholds {
  amberPct: number;     // ≥ triggers AMBER (e.g. 10)
  redPct: number;       // ≥ triggers RED (e.g. 25)
  warnPct: number;      // ≥ triggers WARN (e.g. 5)
}

// ─── Audit trail ────────────────────────────────────────────────────────────
export type AuditActionType =
  | "APPROVE" | "REJECT" | "APPROVE_WITH_CONDITIONS"
  | "BROADCAST_ALERT" | "CONFIG_CHANGE" | "SYNC_FORCE" | "USER_CREATE"
  | "EXPORT" | "LOGIN";

export interface AuditEntry {
  id: string;
  timestamp: string;
  admin: string;
  action: AuditActionType;
  target: string;
  note?: string;
  category: string;
}

// ─── Activity ticker (live portfolio events) ───────────────────────────────
export interface ActivityEvent {
  id: string;
  timestamp: string;
  kind: "alert" | "approval" | "sync" | "ai" | "user" | "budget" | "milestone";
  message: string;
  projectName?: string;
  severity?: AlertSeverity;
}

// ─── AI chat ───────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  provider?: string;
  model?: string;
  tokens?: number;
  attachments?: { name: string; sizeKB: number; preview: string }[];
  universal?: boolean;
}

export interface AiProviderStatus {
  connected: boolean;
  tier: "primary" | "secondary" | "community" | "standard" | "sandbox" | "built-in";
  label: string;
  model: string | null;
  checkedAt: string;
}

// ─── Integration / sync state ──────────────────────────────────────────────
export interface IntegrationStatus {
  mainProjectUrl: string;
  mainProjectReachable: boolean | null;
  lastHealthCheck?: string;
  aiProviderConnected: boolean;
  emailServiceConnected: boolean;
  webhookUrl: string;
  webhookSecret: string;
  lastSyncAt?: string;
  syncActive: boolean;
}

// ─── Navigation ────────────────────────────────────────────────────────────
export type HostViewId =
  | "dashboard"
  | "approvals"
  | "budget-risk"
  | "alerts"
  | "users"
  | "intelligence"
  | "integrations"
  | "demo"
  | "audit";
