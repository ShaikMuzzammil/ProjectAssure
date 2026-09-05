// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure — Core Domain Types (mirrors prisma/schema.prisma 1:1)
// SIH 2026 · SIH26103 · Team NEXGEN
// ═══════════════════════════════════════════════════════════════════════════

export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
export type HealthStatus = "HEALTHY" | "AT_RISK" | "CRITICAL";
export type MilestoneStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DELAYED" | "BLOCKED";
export type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "CANCELLED";
export type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type AlertType =
  | "RISK_LEVEL_CHANGE"
  | "BUDGET_OVERRUN"
  | "MILESTONE_SLIPPAGE"
  | "DATA_STALENESS"
  | "RESOURCE_BOTTLENECK"
  | "DELAY_PREDICTION";
export type UserRole = "ADMIN" | "PROJECT_MANAGER" | "STAKEHOLDER" | "VIEWER";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ResourceCategory = "HUMAN" | "EQUIPMENT" | "MATERIAL";
export type BudgetCategory =
  | "CONSTRUCTION" | "EQUIPMENT" | "HUMAN_RESOURCES" | "MATERIALS"
  | "CONSULTANCY" | "CONTINGENCY" | "LAND_ACQUISITION" | "OTHER";
export type DocumentStatus = "UPLOADED" | "EXTRACTING" | "STRUCTURING" | "VALIDATING" | "PROCESSED" | "FAILED";
export type NotificationType = "ALERT" | "PREDICTION" | "DOCUMENT" | "SYSTEM" | "EMAIL" | "AUDIT" | "COMMENT";
export type EmailStatus = "QUEUED" | "SENT" | "SIMULATED" | "FAILED";
export type AuditAction =
  | "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "EXPORT" | "REGISTER"
  | "AI_ACCEPT" | "AI_OVERRIDE" | "ALERT_ACK" | "EMAIL_SEND" | "PREDICTION_RUN" | "MODEL_RETRAIN" | "SETTINGS" | "UPLOAD";
export type PortalId = "main" | "analytics" | "ai";

// ─── App views (hash-routed) ────────────────────────────────────────────────
export type ViewId =
  | "dashboard" | "projects" | "project-detail" | "analytics" | "ai-assistant"
  | "model-lab" | "vector-store" | "alerts" | "reports" | "email-center"
  | "admin" | "notifications" | "audit"
  | "interventions" | "compare" | "help"
  | "workflow"   // v4: in-app "How the platform works" walkthrough (team onboarding)
  // v5: Simple Monitoring Suite — one-concept-per-page screens for first-time teammates
  | "monitor" | "cost-benchmark" | "budget-variance" | "progress-mismatch"
  | "risk-score" | "procurement" | "change-orders" | "authority-review" | "search";

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
  password: string;               // demo personas ship plain demo passwords; registered accounts never store plaintext
  passwordHash?: string;          // registered accounts: pbkdf2$sha256$100000$salt$hash (Web Crypto, client-verified)
  source?: "demo" | "registered"; // demo = seeded persona · registered = real sign-up with own data
  role: UserRole;
  departmentId: string;
  avatarInitials: string;
  designation: string;
  persona: string;
  personaDescription: string;
  phone?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

// ─── Project graph ──────────────────────────────────────────────────────────
export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: MilestoneStatus;
  plannedDate: string;            // ISO
  actualDate?: string;
  weight: number;
  isCritical: boolean;
  order: number;
  progress: number;               // 0-100
}

export interface Task {
  id: string;
  projectId: string;
  milestoneId: string;
  name: string;
  status: TaskStatus;
  plannedStart: string;
  plannedEnd: string;
  assignee: string;
  progress: number;
  isCritical: boolean;
  dependsOn: string[];            // task ids — FINISH_TO_START
}

export interface BudgetRecord {
  id: string;
  projectId: string;
  category: BudgetCategory;
  month: number;                  // 1-12
  year: number;
  planned: number;                // ₹ lakhs
  spent: number;                  // ₹ lakhs
}

export interface ResourceAllocation {
  id: string;
  projectId: string;
  category: ResourceCategory;
  name: string;
  quantity: number;
  allocated: number;
  utilised: number;               // % of allocated
  unit: string;
  status: "available" | "constrained" | "bottleneck";
}

export interface RiskFactor {
  factor: string;
  impact: number;                 // 0-100
  description: string;
}
export interface RiskAssessment {
  scheduleRisk: number;
  budgetRisk: number;
  resourceRisk: number;
  overallRisk: number;
  riskLevel: RiskLevel;
  factors: RiskFactor[];
  assessedAt: string;
}

// ─── ML ─────────────────────────────────────────────────────────────────────
export interface PredictionFactor {
  feature: string;
  label: string;
  value: number;
  valueLabel: string;
  contribution: number;           // log-odds
  direction: "raises" | "lowers";
  plainLanguage: string;
}
export interface PredictionResult {
  id: string;
  projectId: string;
  predictionType: "delay" | "budget_overrun";
  probability: number;            // 0-1
  estimatedDays: number;
  ciLower: number;
  ciUpper: number;
  confidence: number;             // 0-1
  factors: PredictionFactor[];
  modelVersion: string;
  computedAt: string;
  featureSnapshot: Record<string, number>;
  isBaseline?: boolean;             // v4: true when scored pre-execution (PLANNING)
}

export interface ModelMetrics {
  auc: number; accuracy: number; precision: number; recall: number; f1: number;
  maeDays: number; brier: number; ece: number;
}
export interface ModelVersion {
  version: string;
  trainedAt: string;
  trainedOn: number;              // synthetic projects
  metrics: ModelMetrics;
  status: "champion" | "new version" | "retired";
  notes: string;
}

// ─── Alerts & notifications ─────────────────────────────────────────────────
export interface Alert {
  id: string;
  projectId: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  type: AlertType;
  isRead: boolean;
  actionTaken?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: string;
  recommendedAction: string;
  recommendedOwner: string;
  recommendedDeadline: string;    // human text
  emailQueued?: boolean;
}

export interface Notification {
  id: string;
  userId: string;                 // "all" = broadcast
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  linkView?: ViewId;
  linkProjectId?: string;
}

// ─── Documents & RAG ────────────────────────────────────────────────────────
export interface ExtractedField {
  field: string;
  value: string;
  confidence: number;             // 0-1
  sourcePage: number;
}
export interface DocumentItem {
  id: string;
  projectId: string;
  fileName: string;
  fileType: "pdf" | "xlsx" | "csv" | "png" | "jpg" | "txt";
  fileSize: number;               // bytes
  uploadedAt: string;
  uploadedBy: string;
  status: DocumentStatus;
  totalPages: number;
  ocrConfidence?: number;
  summary?: string;
  extractedData?: {
    fields: ExtractedField[];
    keyFindings: string[];
    risks: string[];
    sentiment: { score: number; label: "positive" | "neutral" | "negative" };
  };
  text?: string;                  // full extracted text (seeded docs carry RAG corpus)
  processingMs?: number;
}

export interface VectorChunk {
  id: string;
  documentId: string;
  projectId: string;
  chunkIndex: number;
  text: string;
  tokens: number;
  pageStart: number;
  pageEnd: number;
  docType: string;
}

// ─── Audit ──────────────────────────────────────────────────────────────────
export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  details: string;
  userName: string;
  userRole: UserRole;
  timestamp: string;
  before?: string;
  after?: string;
}

// ─── Email ──────────────────────────────────────────────────────────────────
export type EmailTemplateId =
  | "critical_alert" | "high_alert" | "weekly_digest" | "report_delivery"
  | "document_processed" | "welcome" | "custom";

export interface EmailAttachment {
  name: string;
  kind: "pdf" | "xlsx" | "csv" | "txt";
  sizeKb: number;
}
export interface EmailMessage {
  id: string;
  to: string;
  toName?: string;
  subject: string;
  body: string;                   // markdown-ish
  template: EmailTemplateId;
  status: EmailStatus;
  createdAt: string;
  sentAt?: string;
  provider?: string;
  error?: string;
  hint?: string;                  // v3: actionable next step when delivery fails
  attachments: EmailAttachment[];
  projectId?: string;
  replyTo?: string;
}

export interface EmailSettings {
  fromName: string;
  fromAddress: string;
  provider: "smtp-gmail" | "resend" | "outbox-only";
  alertEmailsEnabled: boolean;
  digestEmailsEnabled: boolean;
  criticalTo: string[];
}

// ─── Reports ────────────────────────────────────────────────────────────────
export type ReportKind = "executive" | "weekly" | "risk-deep-dive" | "project-status" | "portfolio-flash" | "custom";
export interface ReportSpec {
  kind: ReportKind;
  title: string;
  scope: "portfolio" | "department" | "project";
  scopeId?: string;
  sections: string[];
  generatedBy: string;
  generatedAt: string;
  pages: number;
}
export interface GeneratedReport {
  id: string;
  spec: ReportSpec;
  formats: ("pdf" | "xlsx" | "csv")[];
  fileNameBase: string;
  createdAt: string;
}

// ─── AI chat ────────────────────────────────────────────────────────────────
export interface ToolCall {
  tool: string;
  args: string;
  observation: string;
  durationMs: number;
}
export interface Citation {
  n: number;
  label: string;
  detail: string;
}
export interface AiAnswer {
  answer: string;
  toolCalls: ToolCall[];
  citations: Citation[];
  intent: string;
  dataFreshness: string;
  grounded: boolean;
  source: "deterministic" | "live-llm";
}
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  answer?: AiAnswer;
  createdAt: string;
}
export interface ChatThread {
  id: string;
  title: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// ─── Interventions (issue → action → closure lifecycle) ─────────────────────
export type InterventionStatus =
  | "DETECTED" | "REVIEWED" | "ACTION_ASSIGNED" | "UNDER_INVESTIGATION"
  | "RESOLVED" | "VERIFIED" | "CLOSED";

export const INTERVENTION_FLOW: InterventionStatus[] = [
  "DETECTED", "REVIEWED", "ACTION_ASSIGNED", "UNDER_INVESTIGATION", "RESOLVED", "VERIFIED", "CLOSED",
];

export const INTERVENTION_STATUS_META: Record<InterventionStatus, { label: string; hint: string }> = {
  DETECTED: { label: "Detected", hint: "ProjectAssure found a potential issue automatically." },
  REVIEWED: { label: "Reviewed", hint: "An officer has looked at the issue and confirmed it is real." },
  ACTION_ASSIGNED: { label: "Action Assigned", hint: "A corrective task with an owner and a deadline exists." },
  UNDER_INVESTIGATION: { label: "Under Investigation", hint: "The responsible officer is working on the fix." },
  RESOLVED: { label: "Resolved", hint: "The fix is complete and awaiting proof (evidence)." },
  VERIFIED: { label: "Verified", hint: "Evidence was checked and accepted by the authority." },
  CLOSED: { label: "Closed", hint: "The issue is fully closed. Nothing more to do." },
};

export interface InterventionStep {
  id: string;
  text: string;                  // what the officer should do
  owner: string;
  dueDays: number;
  done: boolean;
  doneAt?: string;
}

export interface Intervention {
  id: string;
  code: string;                  // e.g. #A1024
  projectId: string;
  title: string;                 // short issue name
  issue: string;                 // plain-language: what is happening
  why: string;                   // plain-language: why it matters
  severity: AlertSeverity;
  status: InterventionStatus;
  detectedAt: string;
  source: "alert" | "manual" | "ai";
  raisedBy: string;
  assignedTo: string;
  deadline: string;              // ISO
  steps: InterventionStep[];      // recommended corrective steps
  evidenceCount: number;         // documents/photos attached as proof
  updates: { at: string; by: string; note: string; status: InterventionStatus }[];
  resolution?: string;
  closedAt?: string;
}

// ─── Recommended actions engine ────────────────────────────────────────────
export type ActionArea =
  | "financial" | "schedule" | "procurement" | "compliance" | "evidence" | "resources";

export const ACTION_AREA_META: Record<ActionArea, { label: string; icon: string; hint: string }> = {
  financial: { label: "Money", icon: "💰", hint: "Spending vs approved budget and work done." },
  schedule: { label: "Time", icon: "⏱️", hint: "Completion dates and milestone progress." },
  procurement: { label: "Purchases", icon: "🛒", hint: "Vendor prices and buying decisions." },
  compliance: { label: "Rules", icon: "✅", hint: "Approvals, sanctions and mandatory documents." },
  evidence: { label: "Proof", icon: "📷", hint: "Site photos and documents that verify claims." },
  resources: { label: "People & Machines", icon: "👷", hint: "Staff, equipment and material availability." },
};

export interface RecommendedAction {
  id: string;
  priority: 1 | 2 | 3;           // 1 = do first
  area: ActionArea;
  title: string;
  what: string;                  // What is happening?
  why: string;                   // Why does it matter (plain language)?
  action: string;                // What should the authority do?
  owner: string;
  deadline: string;              // human text
  expectedImpact: string;
}

// ─── KPI tracking ───────────────────────────────────────────────────────────
export interface ProjectKpi {
  id: string;
  projectId: string;
  name: string;                  // e.g. "Road length completed"
  unit: string;                  // km | bridges | jobs | MW | households
  target: number;
  actual: number;
  category: "physical" | "social" | "financial" | "quality";
}

// ─── Root cause analysis ───────────────────────────────────────────────────
export interface RootCauseNode {
  id: string;
  label: string;
  weight: number;                // % contribution
  children: RootCauseNode[];
}

// ─── No-action impact projection ──────────────────────────────────────────
export interface NoActionProjection {
  riskToday: number;
  risk30: number;
  risk60: number;
  risk90: number;
  costToday: number;             // ₹ lakhs
  cost90: number;
  delayToday: number;            // days
  delay90: number;
  riskWithIntervention: number;
  narrative: string;
}

// ─── Executive summary ─────────────────────────────────────────────────────
export interface ExecutiveSummary {
  headline: string;
  verdict: "GOOD" | "WATCH" | "ATTENTION" | "CRITICAL";
  bullets: string[];             // plain-language sentences
  recommendation: string;
}

// ─── Glossary (first-time visitor understandability) ───────────────────────
export interface GlossaryTerm {
  id: string;
  term: string;
  plain: string;                 // one-line plain-language meaning
  detail: string;                // fuller explanation
  where: string;                 // where it appears in the app
  category: "metric" | "ml" | "process" | "security" | "platform";
}

// ─── Project aggregate ──────────────────────────────────────────────────────
export interface Project {
  id: string;
  psId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  departmentId: string;
  ownerId?: string;               // registered account that created this project (per-user data isolation)
  sector: string;
  scheme: string;
  state: string;
  district: string;
  latitude: number;
  longitude: number;
  startDate: string;
  targetDate: string;
  estimatedEndDate?: string;
  actualEndDate?: string;
  durationMonths: number;
  progress: number;               // 0-100
  totalBudget: number;            // ₹ lakhs
  spentBudget: number;            // ₹ lakhs
  projectedBudget: number;        // ₹ lakhs
  healthScore: number;
  healthStatus: HealthStatus;
  scheduleScore: number;
  budgetScore: number;
  resourceScore: number;
  milestoneScore: number;
  healthComputedAt: string;
  projectManager: string;
  contractor: string;
  teamSize: number;
  story?: { tier: "A" | "C"; narrative: string };
  createdAt: string;
  // children
  milestones: Milestone[];
  tasks: Task[];
  budgetRecords: BudgetRecord[];
  resources: ResourceAllocation[];
  riskAssessment?: RiskAssessment;
  prediction?: PredictionResult;
  kpis?: ProjectKpi[];           // v3: sector KPIs (target vs actual)
  documents: DocumentItem[];
  alerts: Alert[];
}

export interface PortfolioStats {
  totalProjects: number;
  active: number;
  healthy: number;
  atRisk: number;
  critical: number;
  totalBudget: number;            // ₹ lakhs
  totalSpent: number;
  avgHealth: number;
  avgProgress: number;
  projectsBehind: number;
  projectedOverruns: number;
  alertsUnread: number;
  criticalAlerts: number;
  documentsProcessed: number;
  emailsSent: number;
}

// ─── Settings ───────────────────────────────────────────────────────────────
export interface ThresholdSettings {
  amberAt: number;                // default 75
  redAt: number;                  // default 50
  budgetWarnPct: number;          // default 10
  budgetCriticalPct: number;      // default 20
  delayProbEmailAt: number;       // default 70
  burnVelocityPct: number;        // default 30
}
export interface AlertRuleSetting {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: AlertSeverity;
  channel: "in-app" | "in-app+email";
}
export interface DataMode {
  mode: "simulation" | "connected";
  databaseUrl: boolean;
  aiProvider: "deterministic" | "z-ai-sandbox" | "gemini" | "openai" | "live";
  emailProvider: "outbox" | "smtp";
  lastCheckedAt: string;
}

// ─── Live events engine ─────────────────────────────────────────────────────
export interface LiveEvent {
  id: string;
  kind: "health-drift" | "milestone-completed" | "budget-update" | "new-alert" | "document-processed" | "prediction-run" | "system";
  title: string;
  detail: string;
  at: string;
  projectId?: string;
}

export const HEALTH_WEIGHTS = { schedule: 0.3, budget: 0.25, resources: 0.2, milestones: 0.25 } as const;
export const DEFAULT_THRESHOLDS: ThresholdSettings = {
  amberAt: 75, redAt: 50, budgetWarnPct: 10, budgetCriticalPct: 20, delayProbEmailAt: 70, burnVelocityPct: 30,
};
