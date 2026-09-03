/* ============================================================
 * ProjectAssure — Core type definitions
 * Mirrors the Prisma schema in md/04_DATABASE_SCHEMA.md
 * ============================================================ */

export type ProjectStatus =
  | "PLANNING"
  | "ACTIVE"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

export type HealthStatus = "HEALTHY" | "AT_RISK" | "CRITICAL";

export type MilestoneStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "DELAYED"
  | "BLOCKED";

export type TaskStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "BLOCKED"
  | "CANCELLED";

export type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type AlertType =
  | "RISK_LEVEL_CHANGE"
  | "BUDGET_OVERRUN"
  | "MILESTONE_SLIPPAGE"
  | "DATA_STALENESS"
  | "RESOURCE_BOTTLENECK";

export type UserRole = "ADMIN" | "PROJECT_MANAGER" | "STAKEHOLDER" | "VIEWER";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ResourceCategory = "HUMAN" | "EQUIPMENT" | "MATERIAL";

export type BudgetCategory =
  | "CONSTRUCTION"
  | "EQUIPMENT"
  | "HUMAN_RESOURCES"
  | "MATERIALS"
  | "CONSULTANCY"
  | "CONTINGENCY"
  | "LAND_ACQUISITION"
  | "OTHER";

export interface Department {
  id: string;
  name: string;
  code: string;
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
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  status: MilestoneStatus;
  plannedDate: string; // ISO
  actualDate?: string;
  weight: number;
  isCritical: boolean;
  order: number;
  progress: number; // 0-100
}

export interface Task {
  id: string;
  milestoneId: string;
  name: string;
  status: TaskStatus;
  plannedStart: string;
  plannedEnd: string;
  assignee: string;
  progress: number;
  isCritical: boolean;
}

export interface BudgetRecord {
  month: number; // 1-12
  year: number;
  planned: number; // in lakhs
  spent: number; // in lakhs
}

export interface ResourceAllocation {
  id: string;
  category: ResourceCategory;
  name: string;
  allocated: number;
  utilised: number; // 0-100
  unit?: string;
  status: string;
}

export interface RiskFactor {
  factor: string;
  impact: number; // 0-100
  description: string;
}

export interface RiskAssessment {
  scheduleRisk: number; // 0-100
  budgetRisk: number;
  resourceRisk: number;
  overallRisk: number;
  riskLevel: RiskLevel;
  factors: RiskFactor[];
  assessedAt: string;
}

export interface PredictionFactor {
  feature: string; // canonical 18-feature name
  label: string;
  value: number;
  contribution: number; // log-odds contribution
  plainLanguage: string;
}

export interface PredictionResult {
  id: string;
  projectId: string;
  predictionType: "delay" | "budget_overrun";
  probability: number; // 0-1
  estimatedDays: number;
  ciLower: number;
  ciUpper: number;
  confidence: number; // 0-1
  factors: PredictionFactor[];
  modelVersion: string;
  computedAt: string;
}

export interface Alert {
  id: string;
  projectId: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  type: AlertType;
  isRead: boolean;
  actionTaken?: string;
  createdAt: string;
  recommendedAction: string;
  recommendedOwner: string;
  recommendedDeadline: string;
}

export interface DocumentItem {
  id: string;
  projectId: string;
  fileName: string;
  fileType: "pdf" | "xlsx" | "png" | "jpg";
  fileSize: number; // bytes
  uploadedAt: string;
  uploadedBy: string;
  status: "UPLOADED" | "EXTRACTING" | "PROCESSED" | "FAILED";
  summary?: string;
  extractedData?: {
    fieldsCaptured: number;
    totalPages: number;
    keyFindings: string[];
  };
}

export interface AuditLogEntry {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "EXPORT" | "AI_ACCEPT" | "AI_OVERRIDE";
  entity: string;
  entityId?: string;
  details: string;
  userName: string;
  timestamp: string;
}

export interface Project {
  id: string;
  psId: string; // e.g. "PRJ-2026-0142"
  name: string;
  description: string;
  status: ProjectStatus;
  departmentId: string;
  sector: string;
  scheme: string;
  state: string;
  district: string;
  latitude: number;
  longitude: number;
  startDate: string;
  targetDate: string;
  estimatedEndDate?: string;
  progress: number; // 0-100

  /* money in lakhs */
  totalBudget: number;
  spentBudget: number;
  projectedBudget: number;

  /* health block */
  healthScore: number;
  healthStatus: HealthStatus;
  scheduleScore: number;
  budgetScore: number;
  resourceScore: number;
  milestoneScore: number;
  healthComputedAt: string;

  /* narrative */
  story?: string;
  projectManager: string;
  contractor: string;

  /* children */
  milestones: Milestone[];
  tasks: Task[];
  budgetRecords: BudgetRecord[];
  resources: ResourceAllocation[];
  riskAssessment?: RiskAssessment;
  prediction?: PredictionResult;
  documents: DocumentItem[];
  alerts: Alert[];
  auditTrail: AuditLogEntry[];
}

export interface PortfolioStats {
  totalProjects: number;
  active: number;
  healthy: number;
  atRisk: number;
  critical: number;
  totalBudget: number; // lakhs
  totalSpent: number;
  avgHealth: number;
  avgProgress: number;
  projectsBehind: number;
  projectedOverruns: number;
  alertsUnread: number;
  criticalAlerts: number;
}

export type ViewId =
  | "dashboard"
  | "projects"
  | "project-detail"
  | "analytics"
  | "ai-assistant"
  | "alerts"
  | "reports"
  | "settings";
