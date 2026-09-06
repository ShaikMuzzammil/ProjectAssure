// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure Host Control — Seed Data (v21 rebuild)
// SIH 2026 · SIH26103 · Team NEXGEN
//
// v21 changes:
//   • Adds 2 fresh-user personas (webhook-ingested look) + 1 suspended user
//   • Each user carries derived KPIs (loginCount, projectCount, budgetUtilisedPct,
//     alertsCount, riskLevel, status)
//   • Each project links to an ownerId, carries vault metadata (locked,
//     documentsCount, lastAuditAt, integrityHash, accessLog)
//   • Includes a starter email outbox + webhook receipt log so the Email
//     Centre and Security & Audit views are non-empty on first load.
// ═══════════════════════════════════════════════════════════════════════════

import type {
  User,
  Project,
  ApprovalItem,
  AlertItem,
  AuditEntry,
  ActivityEvent,
  EmailItem,
  WebhookReceipt,
  PortfolioSnapshot,
  BudgetThresholds,
  IntegrationStatus,
  AiProviderStatus,
  RiskLevel,
} from "./types";

const now = Date.now();
const DAY = 86_400_000;
const HOUR = 3_600_000;

function deriveRiskLevel(healthScore: number, variancePct: number): RiskLevel {
  if (healthScore < 50 || variancePct > 20) return "CRITICAL";
  if (healthScore < 65 || variancePct > 10) return "HIGH";
  if (healthScore < 75 || variancePct > 5) return "MEDIUM";
  return "LOW";
}

// ─── Users ─────────────────────────────────────────────────────────────────
export const ADMIN_PERSONA: User = {
  id: "u-admin",
  name: "Chief Programme Officer",
  email: "cpo@mospi.gov.in",
  role: "ADMIN",
  source: "DEMO",
  avatarInitials: "CP",
  designation: "Chief Programme Officer, MoSPI",
  department: "IPMD",
  isActive: true,
  lastLoginAt: new Date(now - 1 * HOUR).toISOString(),
  createdAt: new Date(now - 90 * DAY).toISOString(),
  lastActivityAt: new Date(now - 1 * HOUR).toISOString(),
  loginCount: 142,
  projectCount: 8,
  totalBudgetL: 7240,
  budgetUtilisedPct: 58,
  alertsCount: 1,
  riskLevel: "LOW",
  status: "ACTIVE",
  notes: [],
};

export const USERS: User[] = [
  ADMIN_PERSONA,
  {
    id: "u-pm",
    name: "Priya Venkatesh",
    email: "priya.venkatesh@mospi.gov.in",
    role: "PROJECT_MANAGER",
    source: "DEMO",
    avatarInitials: "PV",
    designation: "Director (Projects), IPMD",
    department: "IPMD",
    isActive: true,
    lastLoginAt: new Date(now - 1 * HOUR).toISOString(),
    createdAt: new Date(now - 80 * DAY).toISOString(),
    lastActivityAt: new Date(now - 1 * HOUR).toISOString(),
    loginCount: 87,
    projectCount: 3,
    totalBudgetL: 2210,
    budgetUtilisedPct: 72,
    alertsCount: 2,
    riskLevel: "HIGH",
    status: "ACTIVE",
    notes: [
      { id: "n-1", body: "Asked to verify steel dispatch with JSW vendor.", by: "CPO", at: new Date(now - 2 * DAY).toISOString() },
    ],
  },
  {
    id: "u-analyst",
    name: "Sneha Iyer",
    email: "sneha.iyer@mospi.gov.in",
    role: "STAKEHOLDER",
    source: "DEMO",
    avatarInitials: "SI",
    designation: "Deputy Director (Analysis), IPMD",
    department: "IPMD",
    isActive: true,
    lastLoginAt: new Date(now - 2 * HOUR).toISOString(),
    createdAt: new Date(now - 70 * DAY).toISOString(),
    lastActivityAt: new Date(now - 2 * HOUR).toISOString(),
    loginCount: 53,
    projectCount: 2,
    totalBudgetL: 1480,
    budgetUtilisedPct: 41,
    alertsCount: 0,
    riskLevel: "MEDIUM",
    status: "ACTIVE",
    notes: [],
  },
  {
    id: "u-pmo",
    name: "Meera Nair",
    email: "meera.nair@pmo.gov.in",
    role: "VIEWER",
    source: "DEMO",
    avatarInitials: "MN",
    designation: "Director, PMO Coordination",
    department: "IPMD",
    isActive: true,
    lastLoginAt: new Date(now - 1 * DAY).toISOString(),
    createdAt: new Date(now - 60 * DAY).toISOString(),
    lastActivityAt: new Date(now - 1 * DAY).toISOString(),
    loginCount: 19,
    projectCount: 0,
    totalBudgetL: 0,
    budgetUtilisedPct: 0,
    alertsCount: 0,
    riskLevel: "LOW",
    status: "ACTIVE",
    notes: [],
  },
  // v21: fresh-user personas (look like webhook-ingested registrations)
  {
    id: "u-fresh-1",
    name: "Arjun Reddy",
    email: "arjun.reddy@tnrd.gov.in",
    role: "PROJECT_MANAGER",
    source: "FRESH_USER",
    avatarInitials: "AR",
    designation: "Executive Engineer, Highways Department",
    department: "TNRD",
    isActive: true,
    lastLoginAt: new Date(now - 30 * 60_000).toISOString(),
    createdAt: new Date(now - 6 * HOUR).toISOString(),
    lastActivityAt: new Date(now - 30 * 60_000).toISOString(),
    loginCount: 4,
    projectCount: 1,
    totalBudgetL: 880,
    budgetUtilisedPct: 49,
    alertsCount: 1,
    riskLevel: "CRITICAL",
    status: "ACTIVE",
    notes: [
      { id: "n-2", body: "Registered this morning — flagged critical delay on Bharatmala P-4.", by: "system", at: new Date(now - 5 * HOUR).toISOString() },
    ],
  },
  {
    id: "u-fresh-2",
    name: "Kavitha Subramaniam",
    email: "kavitha.s@mof.gov.in",
    role: "STAKEHOLDER",
    source: "FRESH_USER",
    avatarInitials: "KS",
    designation: "Under Secretary, Department of Economic Affairs",
    department: "MOF",
    isActive: true,
    lastLoginAt: new Date(now - 2 * HOUR).toISOString(),
    createdAt: new Date(now - 2 * DAY).toISOString(),
    lastActivityAt: new Date(now - 2 * HOUR).toISOString(),
    loginCount: 7,
    projectCount: 1,
    totalBudgetL: 540,
    budgetUtilisedPct: 22,
    alertsCount: 0,
    riskLevel: "LOW",
    status: "ACTIVE",
    notes: [],
  },
  // v21: suspended user — demonstrates grid filter + reactivate action
  {
    id: "u-suspended",
    name: "Vikram Patel",
    email: "vikram.patel@gidb.gov.in",
    role: "VIEWER",
    source: "FRESH_USER",
    avatarInitials: "VP",
    designation: "Project Officer (suspended — pending enquiry)",
    department: "GIDB",
    isActive: false,
    lastLoginAt: new Date(now - 14 * DAY).toISOString(),
    createdAt: new Date(now - 45 * DAY).toISOString(),
    lastActivityAt: new Date(now - 14 * DAY).toISOString(),
    loginCount: 11,
    projectCount: 0,
    totalBudgetL: 0,
    budgetUtilisedPct: 0,
    alertsCount: 0,
    riskLevel: "MEDIUM",
    status: "SUSPENDED",
    notes: [
      { id: "n-3", body: "Suspended on 14-day inactivity + access-policy violation.", by: "CPO", at: new Date(now - 13 * DAY).toISOString() },
    ],
  },
];

// ─── Projects ──────────────────────────────────────────────────────────────
const PROJECT_DATA: Array<
  Partial<Project> & { name: string; psId: string; state: string; sector: string; ownerId: string }
> = [
  { name: "Bharatmala P-4, Karur–Dindigul Corridor", psId: "BM-P4-KDR", state: "Tamil Nadu", sector: "Transport", ownerId: "u-fresh-1" },
  { name: "NH-44 Vijayawada–Hyderabad Corridor", psId: "NH-44-VH", state: "Andhra Pradesh", sector: "Transport", ownerId: "u-pm" },
  { name: "Mumbai Coastal Road Phase 2", psId: "MCR-P2", state: "Maharashtra", sector: "Urban", ownerId: "u-pm" },
  { name: "Bundelkhand Water Grid", psId: "BWG-BL", state: "Uttar Pradesh", sector: "Water", ownerId: "u-pm" },
  { name: "Prayagraj ICCC Phase-2", psId: "PICCC-P2", state: "Uttar Pradesh", sector: "Urban", ownerId: "u-analyst" },
  { name: "Delhi-Mumbai Industrial Corridor", psId: "DMIC-CD", state: "Maharashtra", sector: "Industry", ownerId: "u-analyst" },
  { name: "Chenab River Bridge Project", psId: "CRB-JK", state: "Jammu & Kashmir", sector: "Transport", ownerId: "u-pm" },
  { name: "Kerala Coastal Protection Works", psId: "KCP-KL", state: "Kerala", sector: "Water", ownerId: "u-fresh-2" },
];

// Deterministic pseudo-random so the demo is stable across restarts
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 0xffffffff;
    return s / 0xffffffff;
  };
}

export function buildProjects(): Project[] {
  const r = rng(0x5eed21);
  return PROJECT_DATA.map((d, i) => {
    const sanction = 800 + Math.floor(r() * 1200);
    const spent = Math.floor(sanction * (0.4 + r() * 0.4));
    const projected = Math.floor(spent * (1.05 + r() * 0.2));
    const variance = ((projected - sanction) / sanction) * 100;
    const health = 30 + Math.floor(r() * 60);
    return {
      id: `prj-${String(i + 1).padStart(2, "0")}`,
      psId: d.psId!,
      name: d.name!,
      status: "ACTIVE",
      healthScore: health,
      healthStatus: health >= 75 ? "HEALTHY" : health >= 50 ? "AT_RISK" : "CRITICAL",
      totalBudgetL: sanction,
      spentBudgetL: spent,
      projectedBudgetL: projected,
      variancePct: variance,
      progress: 30 + Math.floor(r() * 60),
      department: "IPMD",
      state: d.state!,
      sector: d.sector!,
      source: i === 0 || i === 7 ? "FRESH_USER" : "DEMO",
      ownerId: d.ownerId,
      locked: i === 6, // Chenab bridge locked for sensitivity
      documentsCount: 14 + Math.floor(r() * 40),
      lastAuditAt: new Date(now - (i + 1) * DAY).toISOString(),
      integrityHash: `sha256:${Math.floor(r() * 0xffffffff).toString(16).padStart(8, "0")}`,
      accessLog: [
        { id: `al-${i}-1`, userId: d.ownerId, userName: USERS.find(u => u.id === d.ownerId)?.name ?? "—", at: new Date(now - i * HOUR).toISOString(), action: "READ" },
        { id: `al-${i}-2`, userId: "u-admin", userName: "Chief Programme Officer", at: new Date(now - (i + 2) * HOUR).toISOString(), action: "READ" },
      ],
    };
  });
}

// ─── Approvals ─────────────────────────────────────────────────────────────
export const SEED_APPROVALS: ApprovalItem[] = [
  {
    id: "ap-1",
    type: "CHANGE_ORDER",
    title: "Steel specification upgrade for T-3 viaduct",
    description: "Replace IS 2062 with high-strength Cor-ten steel for 14 spans. Net cost impact: +₹42 Cr (4.2%).",
    projectName: "Bharatmala P-4, Karur–Dindigul Corridor",
    projectPsId: "BM-P4-KDR",
    raisedBy: "Arjun Reddy",
    raisedAt: new Date(now - 2 * DAY).toISOString(),
    status: "PENDING",
  },
  {
    id: "ap-2",
    type: "BUDGET_INCREASE",
    title: "Land acquisition cost escalation (+18%)",
    description: "Revenue department revised land rates; ₹87 Cr additional sanction required for Phase-2 acquisition.",
    projectName: "Bundelkhand Water Grid",
    projectPsId: "BWG-BL",
    raisedBy: "Priya Venkatesh",
    raisedAt: new Date(now - 5 * DAY).toISOString(),
    status: "PENDING",
  },
  {
    id: "ap-3",
    type: "EXTENSION_OF_TIME",
    title: "EoT request — 6 months for monsoon recovery",
    description: "July–Sep 2025 monsoon caused 47 lost working days. Requesting 6-month extension to original target date.",
    projectName: "Mumbai Coastal Road Phase 2",
    projectPsId: "MCR-P2",
    raisedBy: "Priya Venkatesh",
    raisedAt: new Date(now - 1 * DAY).toISOString(),
    status: "PENDING",
  },
  {
    id: "ap-4",
    type: "PROCUREMENT",
    title: "Single-source procurement — tunnel boring machine",
    description: "TBM model Herrenknecht M-1665 specified by design consultant; request approval for single-source procurement.",
    projectName: "Chenab River Bridge Project",
    projectPsId: "CRB-JK",
    raisedBy: "Procurement Officer",
    raisedAt: new Date(now - 3 * DAY).toISOString(),
    status: "PENDING",
  },
];

// ─── Alerts ────────────────────────────────────────────────────────────────
export const SEED_ALERTS: AlertItem[] = [
  {
    id: "al-1",
    severity: "CRITICAL",
    title: "75% delay probability — 44 days early",
    description: "AssurePredict 2.3 flags 75% delay probability on Bharatmala P-4. Top factor: steel dispatch stalled (32% weight).",
    projectName: "Bharatmala P-4, Karur–Dindigul Corridor",
    projectPsId: "BM-P4-KDR",
    pathway: "fresh",
    isRead: false,
    createdAt: new Date(now - 1 * HOUR).toISOString(),
    recommendedAction: "Verify steel dispatch with JSW; submit recovery plan.",
    recommendedOwner: "Arjun Reddy",
    recommendedDeadline: "7 days",
    targetUserId: "u-fresh-1",
  },
  {
    id: "al-2",
    severity: "HIGH",
    title: "Budget variance +12.7% over warning threshold",
    description: "Projected outturn ₹1,012 Cr against sanctioned ₹898 Cr — exceeds 10% warn band.",
    projectName: "Prayagraj ICCC Phase-2",
    projectPsId: "PICCC-P2",
    pathway: "demo",
    isRead: false,
    createdAt: new Date(now - 2 * HOUR).toISOString(),
    recommendedAction: "Review cost breakdown with executive engineer.",
    recommendedOwner: "Sneha Iyer",
    recommendedDeadline: "5 days",
    targetUserId: "u-analyst",
  },
  {
    id: "al-3",
    severity: "MEDIUM",
    title: "5-month statutory approval stale",
    description: "Environment clearance pending 152 days; statutory SLA is 120 days.",
    projectName: "Bundelkhand Water Grid",
    projectPsId: "BWG-BL",
    pathway: "demo",
    isRead: false,
    createdAt: new Date(now - 5 * HOUR).toISOString(),
    recommendedAction: "Escalate to MoEFCC regional office.",
    recommendedOwner: "Priya Venkatesh",
    recommendedDeadline: "10 days",
    targetUserId: "u-pm",
  },
  {
    id: "al-4",
    severity: "LOW",
    title: "Report staleness — 28 days since last field report",
    description: "Last progress report received 28 days ago; SLA is 14 days.",
    projectName: "Kerala Coastal Protection Works",
    projectPsId: "KCP-KL",
    pathway: "demo",
    isRead: true,
    createdAt: new Date(now - 1 * DAY).toISOString(),
    recommendedAction: "Email field engineer for update.",
    recommendedOwner: "Kavitha Subramaniam",
    recommendedDeadline: "3 days",
    targetUserId: "u-fresh-2",
  },
];

// ─── Activity feed ─────────────────────────────────────────────────────────
export const SEED_ACTIVITY: ActivityEvent[] = [
  { id: "ev-1", kind: "new-alert", title: "Critical delay alert raised on BM-P4-KDR", at: new Date(now - 1 * HOUR).toISOString(), projectId: "prj-01" },
  { id: "ev-2", kind: "user-registered", title: "Arjun Reddy registered from main app", at: new Date(now - 6 * HOUR).toISOString() },
  { id: "ev-3", kind: "prediction-run", title: "AssurePredict 2.3 re-scored portfolio", at: new Date(now - 7 * HOUR).toISOString() },
  { id: "ev-4", kind: "budget-update", title: "Budget variance crossed 10% on PICCC-P2", at: new Date(now - 10 * HOUR).toISOString(), projectId: "prj-05" },
  { id: "ev-5", kind: "user-login", title: "Kavitha Subramaniam logged in", at: new Date(now - 2 * HOUR).toISOString() },
  { id: "ev-6", kind: "document-processed", title: "Field report processed for BWG-BL", at: new Date(now - 1 * DAY).toISOString(), projectId: "prj-04" },
];

// ─── Audit ─────────────────────────────────────────────────────────────────
export const SEED_AUDIT: AuditEntry[] = [
  { id: "au-1", action: "LOGIN", entityType: "Session", note: "CPO session established · JWT HS256 · 24h TTL", by: "Chief Programme Officer", at: new Date(now - 1 * HOUR).toISOString() },
  { id: "au-2", action: "PREDICTION_RUN", entityType: "Portfolio", note: "Portfolio re-scored · 8 projects · 18 signals each", by: "system", at: new Date(now - 7 * HOUR).toISOString() },
  { id: "au-3", action: "ALERT_ACK", entityType: "Alert", note: "Critical alert acknowledged with action note on BM-P4-KDR", by: "Chief Programme Officer", at: new Date(now - 10 * HOUR).toISOString() },
  {
    id: "au-4",
    action: "REGISTER",
    entityType: "User",
    note: "Arjun Reddy registered via main app webhook",
    by: "system",
    at: new Date(now - 6 * HOUR).toISOString(),
    webhookReceivedAt: new Date(now - 6 * HOUR).toISOString(),
    webhookSource: "main-app:POST /api/webhook/user-registered",
  },
  {
    id: "au-5",
    action: "USER_SUSPENDED",
    entityType: "User",
    note: "Vikram Patel suspended — 14-day inactivity + access-policy violation",
    by: "Chief Programme Officer",
    at: new Date(now - 13 * DAY).toISOString(),
  },
];

// ─── Email outbox (v21) ────────────────────────────────────────────────────
export const SEED_EMAILS: EmailItem[] = [
  {
    id: "em-1",
    toUserId: "u-fresh-1",
    toEmail: "arjun.reddy@tnrd.gov.in",
    toName: "Arjun Reddy",
    subject: "Welcome to ProjectAssure Host Control",
    body: "Welcome aboard, Arjun. Your registration was received and your account is now ACTIVE. You can access the host-control plane and your assigned projects immediately.",
    template: "WELCOME",
    status: "SIMULATED",
    sentAt: new Date(now - 6 * HOUR).toISOString(),
    sentBy: "system",
  },
  {
    id: "em-2",
    toUserId: "u-pm",
    toEmail: "priya.venkatesh@mospi.gov.in",
    toName: "Priya Venkatesh",
    subject: "Critical alert — Bharatmala P-4 delay probability 75%",
    body: "Priya, an automated alert flagged 75% delay probability on Bharatmala P-4. Please verify steel dispatch with JSW and submit a recovery plan within 7 days.",
    template: "CRITICAL_ALERT",
    status: "SIMULATED",
    sentAt: new Date(now - 1 * HOUR).toISOString(),
    sentBy: "CPO",
  },
];

// ─── Webhook receipts (v21) ────────────────────────────────────────────────
export const SEED_WEBHOOKS: WebhookReceipt[] = [
  {
    id: "wh-1",
    event: "USER_REGISTERED",
    receivedAt: new Date(now - 6 * HOUR).toISOString(),
    payload: { id: "u-fresh-1", email: "arjun.reddy@tnrd.gov.in" },
    ok: true,
    note: "User ingested into host-control store",
  },
  {
    id: "wh-2",
    event: "USER_LOGIN",
    receivedAt: new Date(now - 30 * 60_000).toISOString(),
    payload: { userId: "u-fresh-1", at: new Date(now - 30 * 60_000).toISOString() },
    ok: true,
    note: "Login recorded · lastLoginAt updated",
  },
];

// ─── Thresholds / Integration / AI status ──────────────────────────────────
export const DEFAULT_THRESHOLDS: BudgetThresholds = {
  amberAt: 50,
  redAt: 30,
  budgetWarnPct: 10,
  budgetCriticalPct: 20,
  delayProbEmailAt: 60,
};

export const DEFAULT_INTEGRATION: IntegrationStatus = {
  mainProjectUrl: "https://project-assure.vercel.app",
  mainProjectReachable: null,
  aiProviderConnected: false,
  emailServiceConnected: false,
  webhookUrl: "/api/webhook/user-registered",
  webhookSecret: "",
  lastSyncAt: new Date(now - 5 * 60_000).toISOString(),
  syncActive: true,
  syncHistory: [
    { id: "sh-1", at: new Date(now - 5 * 60_000).toISOString(), recordCount: 8, ok: true, note: "Initial seed sync" },
  ],
};

export const BUILTIN_AI_STATUS: AiProviderStatus = {
  connected: false,
  tier: "built-in",
  label: "built-in engine · add GEMINI_API_KEY for live answers",
  model: null,
};

// ─── Snapshot derivation ──────────────────────────────────────────────────
export function computeSnapshot(
  projects: Project[],
  alerts: AlertItem[],
  approvals: ApprovalItem[],
): PortfolioSnapshot {
  const totalProjects = projects.length;
  const freshProjects = projects.filter((p) => p.source === "FRESH_USER").length;
  const totalSanctionedL = projects.reduce((s, p) => s + p.totalBudgetL, 0);
  const totalSpentL = projects.reduce((s, p) => s + p.spentBudgetL, 0);
  const totalProjectedL = projects.reduce((s, p) => s + p.projectedBudgetL, 0);
  const openAlerts = alerts.filter((a) => !a.isRead).length;
  const pendingApprovals = approvals.filter((a) => a.status === "PENDING").length;
  const criticalProjects = projects.filter((p) => p.healthStatus === "CRITICAL").length;
  const atRiskProjects = projects.filter((p) => p.healthStatus === "AT_RISK").length;
  const healthyProjects = projects.filter((p) => p.healthStatus === "HEALTHY").length;
  const avgHealth = totalProjects ? projects.reduce((s, p) => s + p.healthScore, 0) / totalProjects : 0;
  const proportional = totalSanctionedL * 0.6;
  const portfolioVariancePct = proportional > 0 ? ((totalSpentL - proportional) / proportional) * 100 : 0;
  const topRisky = [...projects].sort((a, b) => a.healthScore - b.healthScore).slice(0, 5);
  const topOverruns = [...projects].sort((a, b) => b.variancePct - a.variancePct).slice(0, 5);
  return {
    totalProjects,
    freshProjects,
    totalSanctionedL,
    totalSpentL,
    totalProjectedL,
    openAlerts,
    pendingApprovals,
    criticalProjects,
    atRiskProjects,
    healthyProjects,
    avgHealth,
    portfolioVariancePct,
    healthBand: { healthy: healthyProjects, atRisk: atRiskProjects, critical: criticalProjects },
    topRisky,
    topOverruns,
  };
}

export { deriveRiskLevel };
