// ═══════════════════════════════════════════════════════════════════════════
// Host Control — shared types.
//
// The mirror section below is copied EXACTLY from the main app's
// `prototype/src/lib/sync/types.ts` so the two stay wire-compatible:
// GET {MAIN}/api/sync/state → { ok, hub, snapshot } (server-to-server only).
// ═══════════════════════════════════════════════════════════════════════════

// ── Mirror types (wire contract with the main app — do not drift) ──────────

export interface SyncUser {
  id: string;
  name: string;
  email: string;
  role: string;
  source: string; // "demo" | "registered"
  designation?: string;
  department?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  projectCount: number;
  notificationCount: number;
  unreadAlerts: number;
}

export interface SyncProject {
  id: string;
  psId: string;
  name: string;
  department: string;
  state: string;
  district?: string;
  sector: string;
  status: string;
  progress: number;
  health: number;
  budgetTotalCr: number;
  budgetSpentCr: number;
  delayRisk: number; // 0-100
  ownerId: string;
  ownerName: string;
  milestonesTotal: number;
  milestonesCompleted: number;
  milestonesDelayed: number;
  lastActivityAt?: string;
}

export interface SyncAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  projectName?: string;
  projectPsId?: string;
  pathway: string;
  createdAt: string;
  status: string;
}

export interface SyncEvent {
  id: string;
  kind: string;
  title: string;
  at: string;
  projectId?: string;
}

export interface SyncEmail {
  id: string;
  to: string;
  subject: string;
  status: string;
  at: string;
}

export interface SyncSnapshot {
  pushedAt: string;
  stats: {
    users: number;
    registeredUsers: number;
    demoUsers: number;
    projects: number;
    activeProjects: number;
    criticalProjects: number;
    openAlerts: number;
    budgetTotalCr: number;
    budgetSpentCr: number;
    avgHealth: number;
  };
  users: SyncUser[];
  projects: SyncProject[];
  alerts: SyncAlert[];
  events: SyncEvent[];
  emails: SyncEmail[];
  loginFeed: { id: string; userId: string; userName: string; at: string; ip?: string }[];
}

export interface SyncCommand {
  id: string;
  kind: "broadcast" | "user-alert" | "announce" | "request-sync" | "host-message";
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  linkView?: string;
  audience: "all" | string;
  createdAt: string;
  createdBy: string;
  deliveredTo: string[];
}

// Shape returned by GET {MAIN}/api/sync/state
export interface MainSyncStateResponse {
  ok: boolean;
  hub: {
    revision: number;
    lastPushAt: string | null;
    lastWebhookAt: string | null;
    hasSnapshot: boolean;
    commandCount: number;
    time: string;
  };
  snapshot: SyncSnapshot | null;
}

// ── Host-control own types ──────────────────────────────────────────────────

export type Severity = "info" | "warning" | "critical";

export interface HostAuditEntry {
  id: string;
  at: string;
  actor: string; // admin email, "system", or "webhook"
  action: string; // e.g. "auth.login.success", "broadcast.sent"
  detail?: string;
  severity: "info" | "success" | "warning" | "critical";
}

export type EmailStatus = "SENT" | "SIMULATED" | "FAILED";
export type EmailKind = "manual" | "login" | "budget" | "welcome" | "admin" | "disband";

export interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  status: EmailStatus;
  provider: string; // smtp:… | brevo | resend | outbox
  kind: EmailKind;
  reason?: string;
  at: string;
}

export type ApprovalKind = "project-activation" | "account-access" | "budget-escalation";

// v23 — reject actions: when the host rejects an approval, the admin picks
// what should happen to the underlying entity. Each kind has its own set of
// allowed actions; the API validates against this union.
export type RejectAction =
  | "notify-only"            // reject the approval but the entity stays untouched (the old default)
  | "reject-project"         // project-activation: cancel the project in the main app (sends a webhook)
  | "disband-account"        // account-access: deactivate the user's account in the main app + block future logins
  | "block-budget";          // budget-escalation: freeze further spend on the project (sends a webhook)

export interface ApprovalItem {
  id: string;
  kind: ApprovalKind;
  title: string;
  description: string;
  subjectId: string; // project id or user id
  subjectLabel: string; // "PS-1023 · Coastal Ring Rail Phase II" or user email
  ownerId?: string;
  ownerName?: string;
  severity: Severity;
  createdAt: string; // when the item surfaced in host
  status: "pending" | "approved" | "rejected";
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
  // v23: when status === "rejected", the action that was taken on the entity
  rejectAction?: RejectAction;
  // v23: when status === "rejected" and rejectAction != "notify-only", did
  // the main-app webhook succeed? used by the Approvals Centre UI to show
  // honest delivery state.
  rejectActionDelivered?: boolean;
  rejectActionNote?: string;
}

export interface BroadcastRecord {
  id: string;
  kind: "broadcast" | "user-alert" | "announce";
  title: string;
  message: string;
  severity: Severity;
  audience: string; // "all" or userId
  audienceLabel: string;
  at: string;
  createdBy: string;
  delivered: boolean;
  deliveryNote: string;
}

export interface AccessRecord {
  userId: string;
  userName: string;
  active: boolean; // host-side access flag (false = host-deactivated)
  roleOverride?: string;
  changedAt: string;
  changedBy: string;
  reason?: string;
}

export interface HostSettings {
  loginAlerts: boolean; // auto email on new logins
  budgetAlerts: boolean; // auto email on budget breaches
  budgetThresholdPct: number; // overrun % that triggers escalation
  mainUrlOverride: string | null; // persisted MAIN_PROJECT_URL override
}

export interface SyncStatus {
  mainUrl: string;
  mode: "poll"; // default path: host polls main every 5s server-side
  mainReachable: boolean;
  lastSyncAt: string | null;
  lastOkSyncAt: string | null;
  lastError: string | null;
  revision: number;
  lastPushAt: string | null;
  lastWebhookAt: string | null;
  commandCount: number;
  pollCount: number;
  mirrorStatus: "empty" | "fresh" | "stale"; // empty=no snapshot yet
}

export interface LoginFeedEntry {
  id: string;
  userId: string;
  userName: string;
  at: string;
  ip?: string;
}

/** Snapshot user enriched with host-computed fields for the UI grid. */
export interface HostUserView extends SyncUser {
  loginCount: number; // from snapshot loginFeed
  effectiveActive: boolean; // app isActive AND host access flag
  effectiveRole: string; // host override ?? snapshot role
  hostManaged: boolean; // has a host access record
}

export interface EnvCheckItem {
  key: string;
  label: string;
  set: boolean;
  purpose: string;
}

/** Full state payload returned by GET /api/admin/sync (the UI's 5s poll). */
export interface HostStateResponse {
  ok: true;
  serverTime: string;
  session: { email: string };
  sync: SyncStatus;
  mirror: {
    mirroredAt: string | null;
    pushedAt: string | null;
    stats: SyncSnapshot["stats"] | null;
    users: SyncUser[];
    projects: SyncProject[];
    alerts: SyncAlert[];
    events: SyncEvent[];
    loginFeed: LoginFeedEntry[];
    emails: SyncEmail[];
  };
  users: HostUserView[];
  approvals: ApprovalItem[];
  broadcasts: BroadcastRecord[];
  outbox: EmailLogEntry[];
  audit: HostAuditEntry[];
  access: AccessRecord[];
  settings: HostSettings;
  emailProvider: string; // human label, e.g. "smtp:smtp.gmail.com" | "outbox"
}
