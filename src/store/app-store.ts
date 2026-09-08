"use client";
// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure — Application store (Zustand + persisted).
// Every mutation recomputes ML health, fires alert rules, appends audit
// entries and can email — nothing is a toast-only lie.
// ═══════════════════════════════════════════════════════════════════════════
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  User, Project, ViewId, PortalId, Notification, EmailMessage, AuditLogEntry, ChatThread, ChatMessage,
  ThresholdSettings, AlertRuleSetting, DataMode, LiveEvent, Alert, Milestone, Task, BudgetRecord,
  ResourceAllocation, DocumentItem, EmailTemplateId, AuditAction, UserRole, EmailSettings, Intervention, SiteEvidence,
} from "@/lib/projectassure/types";
import { DEFAULT_THRESHOLDS, INTERVENTION_FLOW } from "@/lib/projectassure/types";
import { buildWorld, USERS, DEPARTMENTS } from "@/lib/projectassure/seed";
import { recomputeProject, computePortfolioStats, scopedProjects, evaluateAlertRules } from "@/lib/projectassure/engine";
import { computeDelayPrediction, simulateRetrain, MODEL_REGISTRY } from "@/lib/projectassure/ml";
import { buildIndex, type VectorIndex } from "@/lib/projectassure/rag";
import { nextPortfolioEvent, runDeadlineWatchdog } from "@/lib/projectassure/events";
import { composeEmail, sendEmail } from "@/lib/projectassure/email";
import { answerQuestion, buildProjectActionPlan, buildProjectDossier } from "@/lib/projectassure/agent";
import { hashPassword, verifyPassword, passwordIssues } from "@/lib/projectassure/auth-crypto";
import { uid, clamp } from "@/lib/projectassure/format";
import { geocodeProject } from "@/lib/projectassure/geo";
import { seedKpis, buildRecommendedActions } from "@/lib/projectassure/recommendations";
import { deriveRiskRegister, riskAlertsFromRegister, riskAssessmentFromRegister, buildInitialBudgetRecords, buildInitialResources, starterAlerts } from "@/lib/projectassure/risks";
import { trainModel, predictWithModel, factorsFromModel, estimatedDaysFromFeatures, type TrainedModel, type TrainOptions } from "@/lib/projectassure/ml-lab";
import { buildSyncSnapshot, scheduleSync, pushSyncNow, pollCommands, startCommandPolling, stopCommandPolling } from "@/lib/sync/client";
import type { SyncCommand, SyncApprovalRequest } from "@/lib/sync/types";
import { toast } from "sonner";

const STORE_VERSION = 12;

// v23: per-user workspace slice that hydrates from / replaces in the store.
export interface WorkspaceSlice {
  projects: Project[];
  notifications: Notification[];
  emails: EmailMessage[];
  interventions: Intervention[];
  globalAudit: AuditLogEntry[];
  liveEvents: LiveEvent[];
  chatThreads: ChatThread[];
  mlModels?: unknown[];
}

export interface Route { page: "landing" | "about" | "login" | "app" | "demo" | "public"; view: ViewId; projectId?: string; detailTab?: string; portal: PortalId; }

export interface ProjectForm {
  name: string; description: string; sector: string; scheme: string; state: string; district: string;
  departmentId: string; totalBudget: number; durationMonths: number; startDate: string; targetDate: string;
  projectManager: string; contractor: string; teamSize: number;
  stage?: "PLANNING" | "ACTIVE";   // v4: wizard asks — execution projects get live scoring immediately
}

export interface SignUpForm {
  name: string; email: string; password: string; role: UserRole;
  departmentId: string; designation?: string; phone?: string;
}

const DEFAULT_ALERT_RULES: AlertRuleSetting[] = [
  { id: "r-overrun-10", name: "Projected overrun > 10%", description: "WARNING band: weekly re-forecast, notify PM.", enabled: true, severity: "MEDIUM", channel: "in-app" },
  { id: "r-overrun-20", name: "Projected overrun > 20%", description: "CRITICAL band: ministry escalation + mandatory review note.", enabled: true, severity: "CRITICAL", channel: "in-app+email" },
  { id: "r-delay-70", name: "Delay probability ≥ 70%", description: "HIGH email alert with driving factors and recommended action.", enabled: true, severity: "HIGH", channel: "in-app+email" },
  { id: "r-burn-30", name: "Burn velocity +30% (2 months)", description: "EARLY_WARNING: fires before the overrun materialises.", enabled: true, severity: "HIGH", channel: "in-app" },
  { id: "r-health-red", name: "Health enters Red band", description: "CRITICAL with R10 human-verification requirement.", enabled: true, severity: "CRITICAL", channel: "in-app+email" },
  { id: "r-staleness", name: "Report staleness > 38 days", description: "LOW: automated reminder to the field officer.", enabled: true, severity: "LOW", channel: "in-app" },
];

const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  fromName: "ProjectAssure Alerts", fromAddress: "alerts@projectassure.example", provider: "smtp-gmail",
  alertEmailsEnabled: true, digestEmailsEnabled: true, criticalTo: ["critical-alerts@projectassure.example"],
};

interface AppState {
  // boot
  booted: boolean;
  user: User | null;
  route: Route;
  // data
  projects: Project[];
  users: User[];
  departments: typeof DEPARTMENTS;
  notifications: Notification[];
  emails: EmailMessage[];
  globalAudit: AuditLogEntry[];
  liveEvents: LiveEvent[];
  chatThreads: ChatThread[];
  interventions: Intervention[];   // v3: issue → action → closure tracking
  // settings
  thresholds: ThresholdSettings;
  alertRules: AlertRuleSetting[];
  emailSettings: EmailSettings;
  modelVersions: typeof MODEL_REGISTRY;
  dataMode: DataMode;
  liveEventsEnabled: boolean;
  density: "comfortable" | "compact";
  tourSeen: boolean;               // v3: first-visit onboarding tour
  // ephemeral (not persisted)
  vectorIndex: VectorIndex | null;
  paletteOpen: boolean;
  aiOpen: boolean;
  aiSeedQuestion: string | null;
  aiContextProjectId: string | null;   // v4: project-scoped Intelligence recommended system
  aiLiveMode: boolean;
  aiUniversalMode: boolean;            // v13: universal assistant — answers general questions too
  aiAttachedFiles: { name: string; type: string; size: number; text: string }[];  // v13: uploaded file context
  aiStatus: { connected: boolean; label: string; tier: string } | null;  // v11: live-service probe result
  refreshAiStatus: () => Promise<void>;                                  // v11: probe /api/ai/status (cached server-side)
  aiActiveThreadId: string | null;                                       // v21: the thread the answer is written to (fixed: was hardcoded to threads[0])
  setActiveThread: (id: string) => void;
  // v21: sync hub — the main app mirrors its live state to the server so the
  // Host Control platform can see users, projects, logins and alerts in real time
  lastSyncAt: string | null;
  syncNow: (immediate?: boolean) => Promise<boolean>;
  hostCommands: { id: string; title: string; from: string; at: string }[];
  broadcastAlert: (opts: { title: string; message: string; severity: "info" | "warning" | "critical" }) => { ok: boolean; error?: string };
  // v23: approval requests raised from THIS workspace (pending host review)
  approvalRequests: SyncApprovalRequest[];
  raiseApprovalRequest: (req: Omit<SyncApprovalRequest, "id" | "at" | "requestedBy" | "ownerId">) => SyncApprovalRequest | null;
  // v23: per-user cloud persistence (registered accounts only)
  cloudSaving: boolean;
  lastCloudSaveAt: string | null;
  loadCloudWorkspace: (token: string, userId: string, opts?: { silent?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  saveUserStateNow: () => Promise<boolean>;
  hydrateWorkspace: (slice: Partial<WorkspaceSlice>) => void;
  // v21: ML Lab — real trained models, persisted, selectable champion
  mlModels: TrainedModel[];
  mlChampionId: string | null;
  trainMlModel: (opts: TrainOptions) => TrainedModel | { error: string };
  promoteMlModel: (id: string) => void;
  deleteMlModel: (id: string) => void;
  // v13: AI centre setters
  setAiUniversalMode: (v: boolean) => void;
  attachAiFile: (f: { name: string; type: string; size: number; text: string }) => void;
  detachAiFile: (name: string) => void;
  clearAiFiles: () => void;
  exportHistory: { id: string; kind: string; format: string; at: string; by: string; scope: string }[];
  eventTick: number;

  // ─── lifecycle ───
  boot: () => void;
  parseHash: () => void;
  navigate: (view: ViewId, opts?: { projectId?: string; detailTab?: string }) => void;
  openProject: (id: string, tab?: string) => void;
  setDetailTab: (tab: string) => void;
  goPage: (page: Route["page"], portal?: PortalId) => void;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string; user?: User }>;
  signUp: (form: SignUpForm) => Promise<{ ok: boolean; error?: string; user?: User; mirrored?: boolean }>;
  logout: () => void;
  resetDemo: () => void;

  // ─── data mutations ───
  audit: (action: AuditAction, entity: string, details: string, opts?: { entityId?: string; before?: string; after?: string }) => void;
  createProject: (form: ProjectForm) => Project | null;
  updateProject: (id: string, patch: Partial<Project>) => void;
  cancelProject: (id: string, reason: string) => void;
  runPrediction: (id: string) => void;
  retrainModel: () => void;
  setMilestoneStatus: (projectId: string, milestoneId: string, status: Milestone["status"]) => { ok: boolean; error?: string };
  addMilestone: (projectId: string, m: Omit<Milestone, "id" | "projectId" | "order">) => void;
  moveTask: (projectId: string, taskId: string, status: Task["status"], progress?: number) => void;
  addBudgetRecord: (projectId: string, r: Omit<BudgetRecord, "id" | "projectId">) => void;
  addResource: (projectId: string, r: Omit<ResourceAllocation, "id" | "projectId">) => void;
  updateResource: (projectId: string, resourceId: string, utilised: number) => void;
  ingestDocument: (projectId: string, doc: DocumentItem) => void;
  submitEvidence: (input: Omit<SiteEvidence, "id" | "submittedAt" | "reviewStatus" | "submittedBy">) => SiteEvidence | null;
  reviewEvidence: (projectId: string, evidenceId: string, accept: boolean, note?: string) => { ok: boolean; error?: string };
  deleteDocument: (projectId: string, docId: string) => void;

  // ─── alerts / notifications / email ───
  markAlertRead: (projectId: string, alertId: string) => void;
  markAllAlertsRead: () => void;
  acknowledgeAlert: (projectId: string, alertId: string, actionTaken: string) => void;
  simulateCriticalSlip: (projectId: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  pushNotification: (n: Omit<Notification, "id" | "createdAt" | "isRead">) => void;
  queueEmail: (opts: { to: string; toName?: string; template: EmailTemplateId; subject?: string; body?: string; attachments?: EmailMessage["attachments"]; attachmentBase64?: string; projectId?: string; project?: Project; reportName?: string; docName?: string; send?: boolean }) => Promise<EmailMessage>;
  updateEmailSettings: (patch: Partial<EmailSettings>) => void;

  // ─── settings ───
  setThresholds: (patch: Partial<ThresholdSettings>) => void;
  toggleAlertRule: (id: string) => void;
  setAlertRuleChannel: (id: string, channel: AlertRuleSetting["channel"]) => void;
  setDensity: (d: "comfortable" | "compact") => void;
  setLiveEventsEnabled: (v: boolean) => void;
  setDataMode: (m: Partial<DataMode>) => void;

  // ─── chat ───
  ask: (question: string) => Promise<ChatMessage>;
  createThread: () => string;
  deleteThread: (id: string) => void;
  setAiOpen: (open: boolean) => void;        // v3: was referenced by shell/panel but missing → AI panel could never open
  clearAiSeed: () => void;                   // v3: consumed by the AI side panel
  setAiContext: (projectId: string | null) => void;  // v4: scope the assistant to one project
  askAi: (question: string, projectId?: string) => Promise<void>;// v3: open panel + seed question + run (was missing → every Ask-AI button crashed)

  // ─── interventions (v3) ───
  createIntervention: (projectId: string, title: string, issue: string, why: string, severity: Intervention["severity"], steps?: string[]) => Intervention | null;
  advanceIntervention: (id: string, note?: string) => { ok: boolean; error?: string };
  reopenIntervention: (id: string, reason: string) => void;
  toggleInterventionStep: (id: string, stepId: string) => void;
  markTourSeen: () => void;

  // ─── exports ───
  recordExport: (kind: string, format: string, scope: string) => void;

  // ─── live events ───
  applyNextEvent: () => void;

  // ─── admin / users ───
  addUser: (u: { name: string; email: string; role: UserRole; departmentId: string; designation: string; password: string }) => User | null;
  setUserRole: (userId: string, role: UserRole) => void;
  setUserActive: (userId: string, active: boolean) => void;

  // ─── selectors ───
  scoped: () => Project[];
  stats: () => ReturnType<typeof computePortfolioStats>;
}

function hashToRoute(): Route {
  const h = typeof window !== "undefined" ? window.location.hash : "";
  const parts = h.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts.length === 0) return { page: "landing", view: "dashboard", portal: "main" };
  if (parts[0] === "about") return { page: "about", view: "dashboard", portal: "main" };
  if (parts[0] === "login") return { page: "login", view: "dashboard", portal: "main" };
  if (parts[0] === "demo") return { page: "demo", view: "dashboard", portal: "main" };
  if (parts[0] === "public") return { page: "public", view: "dashboard", portal: "main" };
  if (parts[0] === "portal") {
    const portal = (parts[1] as PortalId) ?? "main";
    const view: ViewId = portal === "analytics" ? "analytics" : "ai-assistant";
    return { page: "app", view, portal };
  }
  if (parts[0] === "app") {
    const view = (parts[1] as ViewId) ?? "dashboard";
    if (view === "project-detail" && parts[2]) {
      return { page: "app", view, projectId: parts[2], detailTab: parts[3] ?? "overview", portal: "main" };
    }
    return { page: "app", view, portal: "main" };
  }
  return { page: "landing", view: "dashboard", portal: "main" };
}

const cap = <T,>(arr: T[], n: number): T[] => (arr.length > n ? arr.slice(0, n) : arr);

// safe localStorage wrapper that degrades gracefully on quota errors
const safeStorage = {
  getItem: (name: string) => {
    try { return localStorage.getItem(name); } catch { return null; }
  },
  setItem: (name: string, value: string) => {
    try { localStorage.setItem(name, value); } catch {
      try {
        const trimmed = JSON.parse(value);
        if (trimmed?.state) {
          delete trimmed.state.projects; // heavy payload out first
          delete trimmed.state.chatThreads;
          localStorage.setItem(name, JSON.stringify(trimmed));
        }
      } catch { /* ignore */ }
    }
  },
  removeItem: (name: string) => { try { localStorage.removeItem(name); } catch { /* ignore */ } },
};

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      booted: false,
      user: null,
      route: { page: "landing", view: "dashboard", portal: "main" },
      projects: [],
      users: [],
      departments: DEPARTMENTS,
      notifications: [],
      emails: [],
      globalAudit: [],
      liveEvents: [],
      chatThreads: [],
      interventions: [],
      tourSeen: false,
      thresholds: DEFAULT_THRESHOLDS,
      alertRules: DEFAULT_ALERT_RULES,
      emailSettings: DEFAULT_EMAIL_SETTINGS,
      modelVersions: MODEL_REGISTRY,
      dataMode: { mode: "simulation", databaseUrl: false, aiProvider: "deterministic", emailProvider: "outbox", lastCheckedAt: new Date().toISOString() },
      liveEventsEnabled: false,          // v23: live portfolio feed starts OFF — one tap to reveal
      density: "comfortable",
      vectorIndex: null,
      paletteOpen: false,
      aiOpen: false,
      aiSeedQuestion: null,
      aiContextProjectId: null,
      aiLiveMode: false,
      aiUniversalMode: false,           // v13: default project-scoped
      aiAttachedFiles: [],              // v13: empty until user uploads
      exportHistory: [],
      eventTick: 0,
      aiStatus: null,
      aiActiveThreadId: null,
      setActiveThread: (id) => set({ aiActiveThreadId: id }),
      lastSyncAt: null,
      hostCommands: [],
      approvalRequests: [],           // v23: pending host-review requests from this workspace
      cloudSaving: false,
      lastCloudSaveAt: null,
      mlModels: [],
      mlChampionId: null,
      // v13: AI centre setters
      setAiUniversalMode: (v) => set({ aiUniversalMode: v }),
      attachAiFile: (f) => set(s => ({ aiAttachedFiles: cap([...s.aiAttachedFiles.filter(x => x.name !== f.name), f], 5) })),
      detachAiFile: (name) => set(s => ({ aiAttachedFiles: s.aiAttachedFiles.filter(x => x.name !== name) })),
      clearAiFiles: () => set({ aiAttachedFiles: [] }),

      // ─── lifecycle ────────────────────────────────────────────────────────
      boot: () => {
        const s = get();
        if (!s.booted) {
          // v23: NO automatic demo world — the landing page stands alone.
          //   demo persona login  → 5-project curated demo world
          //   registered login    → the user's own isolated workspace
          //   reload while logged in → persisted state keeps serving
          set({ booted: true, vectorIndex: buildIndex(s.projects ?? []) });
          // registered session: refresh the workspace from the cloud so a
          // reload on a new device picks up the latest saved snapshot
          if (s.user?.source === "registered" && s.user.stateToken) {
            void get().loadCloudWorkspace(s.user.stateToken, s.user.id, { silent: true });
          }
        }
        // always sync the route from the URL hash — `booted` is persisted, so a
        // reload with an active session must still restore #/app/... deep links
        get().parseHash();
        if (typeof window !== "undefined") {
          window.addEventListener("hashchange", () => get().parseHash());
        }
        // v11: probe the live intelligence service once per session
        void get().refreshAiStatus();
        // v21: mirror state to the Sync Hub (Host Control reads it) and start
        // listening for Host broadcasts — a real bidirectional bridge.
        // v23: 8s poll so host approvals reach this browser in near-real-time.
        if (get().user) void get().syncNow(true);
        startCommandPolling(
          () => get().user?.id ?? null,
          (cmds) => applyHostCommands(set, get, cmds),
          8000,
        );
      },

      parseHash: () => set({ route: hashToRoute(), paletteOpen: false }),

      navigate: (view, opts) => {
        const r = get().route;
        const hash = view === "project-detail" && opts?.projectId
          ? `#/app/project-detail/${opts.projectId}/${opts.detailTab ?? "overview"}`
          : `#/app/${view}`;
        if (typeof window !== "undefined") window.location.hash = hash;
        set({ route: { ...r, page: "app", view, projectId: opts?.projectId, detailTab: opts?.detailTab ?? "overview" }, paletteOpen: false });
      },

      openProject: (id, tab) => {
        get().navigate("project-detail", { projectId: id, detailTab: tab ?? "overview" });
      },

      setDetailTab: (tab) => {
        const r = get().route;
        if (r.projectId) {
          if (typeof window !== "undefined") window.location.hash = `#/app/project-detail/${r.projectId}/${tab}`;
          set({ route: { ...r, detailTab: tab } });
        }
      },

      goPage: (page, portal) => {
        if (typeof window !== "undefined") {
          window.location.hash = page === "app" ? `#/app/${portal === "analytics" ? "analytics" : portal === "ai" ? "ai-assistant" : "monitor"}` : `#/${page}`;
        }
        const r = get().route;
        // v6: after sign-in you land on the compact Dashboard (Simple Overview)
        set({ route: { ...r, page, portal: portal ?? "main", view: page === "app" ? (portal === "analytics" ? "analytics" : portal === "ai" ? "ai-assistant" : "monitor") : "monitor" } });
      },

      // v23: hydrate a registered user's isolated workspace from the cloud.
      // Called at login (fresh hydration) and on reload (silent refresh).
      loadCloudWorkspace: async (token, userId, opts) => {
        try {
          const res = await fetch("/api/user-state", { headers: { "x-user-token": token }, cache: "no-store" });
          if (!res.ok) return { ok: false, error: "cloud_unavailable" };
          const data = await res.json();
          if (data && data.snapshot && (data.snapshot.projects || data.snapshot.notifications)) {
            const snap = data.snapshot as Partial<WorkspaceSlice>;
            // never wipe a logged-in session with an EMPTY cloud snapshot on
            // silent reload — only replace when the cloud actually has a world
            const cloudHasProjects = Array.isArray(snap.projects) && snap.projects.length > 0;
            const localHasProjects = (get().projects ?? []).length > 0;
            if (opts?.silent && !cloudHasProjects && localHasProjects) return { ok: true };
            get().hydrateWorkspace({
              projects: snap.projects ?? [],
              notifications: snap.notifications ?? [],
              emails: snap.emails ?? [],
              interventions: snap.interventions ?? [],
              globalAudit: cap(snap.globalAudit ?? [], 400),
              chatThreads: snap.chatThreads ?? [],
            });
          }
          return { ok: true };
        } catch {
          return { ok: false, error: "network" };
        }
      },

      hydrateWorkspace: (slice) => {
        set(s => ({
          projects: slice.projects ?? s.projects,
          notifications: slice.notifications ?? s.notifications,
          emails: slice.emails ?? s.emails,
          interventions: slice.interventions ?? s.interventions,
          globalAudit: slice.globalAudit ?? s.globalAudit,
          chatThreads: slice.chatThreads ?? s.chatThreads,
          liveEvents: [],
          vectorIndex: buildIndex(slice.projects ?? s.projects),
        }));
      },

      login: async (email, password) => {
        const normalized = email.trim().toLowerCase();
        let local = get().users.find(x => x.email.toLowerCase() === normalized);
        // v23: demo personas live in the seed directory (USERS) — the store's
        // user list starts EMPTY now, so look personas up there when the
        // browser has never seen them.
        if (!local) {
          const persona = USERS.find(u => u.email.toLowerCase() === normalized && (u.source ?? "demo") === "demo");
          if (persona) local = persona;
        }

        // ── demo personas: always local, never hit the database ──
        if (local && (local.source ?? "demo") === "demo") {
          if (!local.isActive) return { ok: false, error: "Account is deactivated. Contact your administrator." };
          if (password !== local.password) return { ok: false, error: "Incorrect password for this demo account." };
          // v23: (re)build the curated 5-project demo world for persona sessions
          const world = buildWorld();
          const stamp = new Date().toISOString();
          set({
            user: { ...local, lastLoginAt: stamp },
            projects: world.projects,
            users: world.users.map(x => x.id === local.id ? { ...x, lastLoginAt: stamp } : x),
            notifications: world.notifications,
            emails: world.emails,
            globalAudit: cap([world.globalAudit[0], ...world.globalAudit], 300),
            interventions: [], liveEvents: [], chatThreads: [], approvalRequests: [],
            vectorIndex: buildIndex(world.projects),
          });
          get().audit("LOGIN", "Session", `Demo persona session for ${local.email} (${local.role}) — curated 5-project demo world loaded`, { entityId: local.id });
          get().goPage("app");
          void get().syncNow(true);
          return { ok: true, user: { ...local, lastLoginAt: stamp } };
        }

        // ── registered accounts: database-first (works cross-device) ──
        let serverLogin: { user?: { id: string; name: string; email: string; role: UserRole; department?: string | null; designation?: string | null; avatarInitials?: string }; stateToken?: string } | null = null;
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: normalized, password }),
          });
          if (res.ok) serverLogin = await res.json();
          else if (res.status === 401 && !local) return { ok: false, error: "Invalid email or password." };
        } catch { /* offline — fall back to the local record */ }

        if (serverLogin?.user) {
          // database account confirmed — hydrate the user's isolated workspace
          const su = serverLogin.user;
          const stamp = new Date().toISOString();
          const u: User = {
            id: su.id,
            name: su.name,
            email: su.email,
            password: "••••••••",
            stateToken: serverLogin.stateToken,
            source: "registered",
            role: su.role,
            departmentId: su.department ? `dept-${su.department.toLowerCase()}` : (local?.departmentId ?? "dept-ipmd"),
            avatarInitials: su.avatarInitials ?? su.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
            designation: su.designation ?? "Registered member",
            persona: "Registered Member",
            personaDescription: "Own isolated workspace — projects, evidence, reports and approvals, saved per-user in the cloud database.",
            isActive: true,
            lastLoginAt: stamp,
            createdAt: local?.createdAt ?? stamp,
          };
          set(s => ({
            user: u,
            users: s.users.some(x => x.id === u.id)
              ? s.users.map(x => x.id === u.id ? { ...u, lastLoginAt: stamp } : x)
              : [...s.users, u],
          }));
          get().audit("LOGIN", "Session", `Account login for ${u.email} (${u.role}) — verified against the cloud database, personal workspace hydrated`, { entityId: u.id });
          get().pushNotification({ userId: u.id, title: "🔐 New sign-in to your account", message: `Signed in at ${new Date(stamp).toLocaleString("en-IN")}. If this wasn't you, contact your administrator.`, type: "SYSTEM", linkView: "notifications" });
          if (serverLogin.stateToken) {
            await get().loadCloudWorkspace(serverLogin.stateToken, u.id, {});
            get().pushNotification({ userId: u.id, title: "☁ Workspace restored", message: `Your projects, reports and approvals were restored from the cloud database — they follow you on any device.`, type: "SYSTEM", linkView: "projects" });
          }
          get().goPage("app");
          void get().syncNow(true);
          return { ok: true, user: u };
        }

        // ── simulation fallback (no DATABASE_URL): local PBKDF2 record ──
        if (!local) return { ok: false, error: "No account found for this email — create one on the Create account tab." };
        if (!local.isActive) return { ok: false, error: "Account is deactivated. Contact your administrator." };
        if (local.passwordHash) {
          const okPw = await verifyPassword(password, local.passwordHash);
          if (!okPw) return { ok: false, error: "Incorrect password." };
        } else if (password !== local.password) {
          return { ok: false, error: "Incorrect password." };
        }
        const stamp2 = new Date().toISOString();
        // v23: local registered login swaps to THIS user's isolated world —
        // projects they created only (never another user's or demo data)
        const DEMO_NOTIFICATION_IDS = new Set(["nt-1", "nt-2", "nt-3", "nt-4", "nt-5"]);
        const own = get().projects.filter(p => p.ownerId === local.id);
        const ownNotifs = get().notifications.filter(n =>
          n.userId === local.id || (n.userId === "all" && !DEMO_NOTIFICATION_IDS.has(n.id)));
        set(s => ({
          user: { ...local, lastLoginAt: stamp2 },
          users: s.users.map(x => x.id === local.id ? { ...x, lastLoginAt: stamp2 } : x),
          projects: own.length ? own : [],
          notifications: ownNotifs,
          vectorIndex: buildIndex(own),
        }));
        get().audit("LOGIN", "Session", `Account login for ${local.email} (${local.role}) — browser-persisted mode (no cloud database configured)`, { entityId: local.id });
        get().pushNotification({ userId: local.id, title: "🔐 New sign-in to your account", message: `Signed in at ${new Date(stamp2).toLocaleString("en-IN")} (browser-persisted mode).`, type: "SYSTEM", linkView: "notifications" });
        get().goPage("app");
        void get().syncNow(true);
        return { ok: true, user: { ...local, lastLoginAt: stamp2 } };
      },

      signUp: async (form) => {
        const name = form.name.trim().replace(/\s+/g, " ");
        const email = form.email.trim().toLowerCase();
        if (name.length < 3 || name.split(" ").filter(Boolean).length < 2) return { ok: false, error: "Enter your full name (first and last name)." };
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
        const issues = passwordIssues(form.password);
        if (issues.length) return { ok: false, error: `Password needs ${issues.join(", ")}.` };
        if (!["PROJECT_MANAGER", "STAKEHOLDER", "VIEWER"].includes(form.role)) return { ok: false, error: "Choose a valid account type." };

        const role = form.role as UserRole;

        // ── v23: DATABASE-FIRST registration ──
        // The account is created in the cloud database (when configured) and
        // the local record mirrors the server identity so this browser, other
        // devices and Host Control all agree on one user id.
        let serverId: string | null = null;
        let stateToken: string | null = null;
        let mirrored = false;
        let conflict = false;
        try {
          const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password: form.password, role, departmentId: form.departmentId, designation: form.designation, phone: form.phone }),
          });
          if (res.ok) {
            const data = await res.json();
            serverId = data?.user?.id ?? null;
            stateToken = data?.stateToken ?? null;
            mirrored = true;
          } else if (res.status === 409) {
            conflict = true;
          }
          /* 503 SIMULATION_MODE / 503 DB_UNAVAILABLE → local account stands */
        } catch { /* offline — local account still works */ }
        if (conflict) return { ok: false, error: "An account with this email already exists — switch to Sign in." };

        const passwordHash = await hashPassword(form.password);
        const u: User = {
          id: serverId ?? `u-reg-${Date.now().toString(36).slice(-6)}`,
          name, email,
          password: "••••••••",            // plaintext is never stored for registered accounts
          passwordHash,
          stateToken: stateToken ?? undefined,
          source: "registered",
          role,
          departmentId: form.departmentId || "dept-ipmd",
          avatarInitials: name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
          designation: form.designation?.trim() || (role === "PROJECT_MANAGER" ? "Project Manager" : role === "STAKEHOLDER" ? "Stakeholder" : "Observer"),
          persona: "Registered Member",
          personaDescription: "Own isolated workspace — projects, evidence, reports and approvals, saved per-user in the cloud database.",
          phone: form.phone?.trim() || undefined,
          isActive: true,
          createdAt: new Date().toISOString(),
        };
        set(s => ({
          users: [...s.users.filter(x => x.id !== u.id), u],
          // v23: brand-new account → a CLEAN world. No demo projects, no demo
          // notifications — just the user's own empty workspace.
          projects: [],
          notifications: [],
          emails: [],
          interventions: [],
          liveEvents: [],
          chatThreads: [],
          approvalRequests: [],
          vectorIndex: buildIndex([]),
        }));

        const stamp = new Date().toISOString();
        set({ user: { ...u, lastLoginAt: stamp } });
        get().audit("REGISTER", "User", `Account ${email} created (${u.role}) · one-way encryption with a unique salt · ${mirrored ? "saved to the cloud database (scrypt) — the workspace persists per-user on every device" : "stored locally (demo mode — no cloud database configured)"} · auto-login`, { entityId: u.id });
        // v23: clean welcome for a clean workspace — welcome + explore only
        get().pushNotification({ userId: u.id, title: "Welcome to ProjectAssure", message: `Your workspace is ready, ${name.split(" ")[0]}. ${mirrored ? "Everything you create is saved to your account in the cloud database." : "Everything you create is saved privately in this browser."}`, type: "SYSTEM", linkView: "projects" });
        get().pushNotification({ userId: u.id, title: "Explore — create your first project", message: "Open Projects → Create project, add budget and timeline, upload field documents: monitoring, risk scanning and predictions activate automatically.", type: "SYSTEM", linkView: "projects" });
        get().goPage("app");
        void get().syncNow(true);
        return { ok: true, user: { ...u, lastLoginAt: stamp }, mirrored };
      },

      logout: () => {
        const current = get().user;
        if (current) {
          // v23: flush the workspace to the cloud before ending the session
          if (current.source === "registered" && current.stateToken) {
            void get().saveUserStateNow();
          }
          get().audit("LOGOUT", "Session", "Session terminated by user");
        }
        set({ user: null, aiActiveThreadId: null });
        stopCommandPolling();
        void get().syncNow(true);
        get().goPage("landing");
      },

      resetDemo: () => {
        const world = buildWorld();
        set({
          user: null, projects: world.projects, users: world.users, notifications: world.notifications,
          emails: world.emails, globalAudit: cap(world.globalAudit, 300), liveEvents: [], chatThreads: [], interventions: [],
          thresholds: DEFAULT_THRESHOLDS, alertRules: DEFAULT_ALERT_RULES, emailSettings: DEFAULT_EMAIL_SETTINGS,
          modelVersions: MODEL_REGISTRY, exportHistory: [], eventTick: 0,
          vectorIndex: buildIndex(world.projects), booted: true, tourSeen: true,
        });
        get().goPage("landing");
      },

      // ─── audit ────────────────────────────────────────────────────────────
      audit: (action, entity, details, opts) => {
        const u = get().user;
        const entry: AuditLogEntry = {
          id: uid("au"), action, entity, entityId: opts?.entityId, details,
          userName: u?.name ?? "system", userRole: u?.role ?? "ADMIN", timestamp: new Date().toISOString(),
          before: opts?.before, after: opts?.after,
        };
        set(s => ({ globalAudit: cap([entry, ...s.globalAudit], 400) }));
      },

      // ─── project mutations ────────────────────────────────────────────────
      createProject: (form) => {
        if (!get().user || !["ADMIN", "PROJECT_MANAGER"].includes(get().user!.role)) return null;
        // duplicate-name guard for this owner
        if (get().projects.some(p => p.ownerId === get().user!.id && p.name.trim().toLowerCase() === form.name.trim().toLowerCase())) {
          return null; // caller shows a “project name already exists” error
        }
        const id = `prj-x${Date.now().toString(36).slice(-4)}`;
        const now = new Date();
        const start = form.startDate || now.toISOString();
        const dur = form.durationMonths || 12;
        const target = form.targetDate || new Date(new Date(start).getTime() + dur * 30.4 * 86400000).toISOString();
        // unique PS id: max existing serial + 1 (never collides)
        const maxSerial = get().projects.reduce((m, p) => {
          const n = parseInt((p.psId.match(/(\d+)$/) ?? ["", "0"])[1], 10);
          return Math.max(m, Number.isFinite(n) ? n : 0);
        }, 900);
        const { latitude, longitude } = geocodeProject(form.state, form.district);
        const p: Project = {
          id, psId: `PRJ-2026-${maxSerial + 1}`,
          name: form.name, description: form.description || `${form.scheme} project monitored for the ${form.departmentId.replace("dept-", "").toUpperCase()} division.`,
          status: form.stage ?? "PLANNING", departmentId: form.departmentId, ownerId: get().user!.id, sector: form.sector, scheme: form.scheme,
          state: form.state, district: form.district, latitude, longitude,
          startDate: start, targetDate: target, durationMonths: dur, progress: 0,
          totalBudget: form.totalBudget, spentBudget: 0, projectedBudget: form.totalBudget,
          healthScore: 95, healthStatus: "HEALTHY", scheduleScore: 95, budgetScore: 96, resourceScore: 94, milestoneScore: 95,
          healthComputedAt: now.toISOString(), projectManager: form.projectManager || get().user!.name,
          contractor: form.contractor || "TBD (tender pending)", teamSize: form.teamSize || 12,
          createdAt: now.toISOString(),
          milestones: [], tasks: [], budgetRecords: [], resources: [], documents: [], alerts: [],
        };
        // seed a starter milestone set so Gantt/kanban are immediately usable
        p.milestones = ["DPR Approval", "Statutory Clearances", "Phase-1 Execution", "Commissioning"].map((name, i) => ({
          id: `${id}-ms-${i + 1}`, projectId: id, name, status: "PENDING" as const,
          plannedDate: new Date(new Date(start).getTime() + (i + 1) * dur * 30.4 * 86400000 / 4).toISOString(),
          weight: i === 2 ? 1.5 : 1, isCritical: i === 2, order: i, progress: 0,
        }));
        p.tasks = p.milestones.flatMap((m, i) => [
          { id: `${id}-tk-${i * 2 + 1}`, projectId: id, milestoneId: m.id, name: `Survey & layout — ${i + 1}.1`, status: "NOT_STARTED" as const, plannedStart: m.plannedDate, plannedEnd: new Date(new Date(m.plannedDate).getTime() + 18 * 86400000).toISOString(), assignee: "Unassigned", progress: 0, isCritical: m.isCritical, dependsOn: [] },
          { id: `${id}-tk-${i * 2 + 2}`, projectId: id, milestoneId: m.id, name: `Execution batch — ${i + 1}.2`, status: "NOT_STARTED" as const, plannedStart: new Date(new Date(m.plannedDate).getTime() + 19 * 86400000).toISOString(), plannedEnd: new Date(new Date(m.plannedDate).getTime() + 40 * 86400000).toISOString(), assignee: "Unassigned", progress: 0, isCritical: m.isCritical, dependsOn: [`${id}-tk-${i * 2 + 1}`] },
        ]);
        // sector KPIs (target vs actual) for the new KPI tab
        p.kpis = seedKpis(p);
        // v8 — the "empty after create" fix: every tab gets honest starter data
        // on minute one, so a newly created project is alive everywhere.
        p.budgetRecords = buildInitialBudgetRecords(p);   // S-curve phasing
        p.resources = buildInitialResources(p);           // baseline resource board
        p.alerts = starterAlerts(p);                      // 2 onboarding alerts
        // auto-run the first prediction (baseline for Planning, full for Execution)
        if (p.status === "ACTIVE" || p.status === "ON_HOLD") p.prediction = computeDelayPrediction(p);
        else p.prediction = { ...computeDelayPrediction(p), isBaseline: true };
        // full live risk register: engine + context signals (documents join on upload)
        p.riskAssessment = riskAssessmentFromRegister(deriveRiskRegister(p), p);
        // run the health engine once over the assembled project
        const assembled = recomputeProject(p, get().thresholds);
        // v23: user-created projects go to Host Control for activation review
        // (demo-world projects skip this — they are pre-approved showcase data)
        const isDemoPersona = get().user?.source === "demo";
        if (!isDemoPersona) {
          assembled.approvalStatus = "pending";
        }
        set(s => ({ projects: [assembled, ...s.projects], vectorIndex: buildIndex([assembled, ...s.projects]), liveEvents: cap([{
          id: uid("ev"), kind: "new-alert", at: new Date().toISOString(), projectId: id,
          title: `Project onboarded — ${assembled.psId}`,
          detail: `Monitoring activated: ${assembled.milestones.length} milestones · ${assembled.budgetRecords.length} budget phases · ${assembled.riskAssessment?.factors.length ?? 0} risks on the live register · prediction ${Math.round((assembled.prediction?.probability ?? 0) * 100)}%.`,
        }, ...s.liveEvents], 30) }));
        get().audit("CREATE", "Project", `Project ${p.psId} “${p.name}” created (${form.sector}, ${form.state}, ₹${form.totalBudget} L, ${dur} months) — monitoring, prediction and risk register activated automatically`, { entityId: p.id });
        get().pushNotification({ userId: get().user!.id, title: `🛡️ Monitoring activated — ${p.psId}`, message: `“${p.name}” is live: ${p.milestones.length}-milestone board, budget phasing, baseline prediction ${Math.round((p.prediction?.probability ?? 0) * 100)}% and a ${p.riskAssessment?.factors.length ?? 0}-item risk register. Upload documents to sharpen it.`, type: "SYSTEM", linkView: "project-detail", linkProjectId: p.id });
        // v23: real-time approval request → Host Control Approvals Centre
        if (!isDemoPersona) {
          get().raiseApprovalRequest({
            kind: "project-activation",
            projectId: assembled.id,
            psId: assembled.psId,
            project: assembled.name,
            title: `New project awaiting activation — ${assembled.psId}`,
            message: `“${assembled.name}” (${form.sector}, ${form.state}, ₹${form.totalBudget} L, ${dur} months) was created by ${get().user!.name}. Approve to confirm monitoring activation.`,
          });
        }
        // v23: push immediately — the host sees this within its 5s poll
        void get().syncNow(true);
        return assembled;
      },

      updateProject: (id, patch) => {
        set(s => {
          const projects = s.projects.map(p => {
            if (p.id !== id) return p;
            const merged = { ...p, ...patch };
            return recomputeProject(merged, s.thresholds);
          });
          return { projects, vectorIndex: buildIndex(projects) };
        });
        const p = get().projects.find(x => x.id === id);
        if (p) get().audit("UPDATE", "Project", `Project ${p.psId} updated${patch.status ? ` · status → ${patch.status}` : ""}${patch.progress !== undefined ? ` · progress → ${patch.progress}%` : ""} · health recomputed ${p.healthScore}`, { entityId: id, after: JSON.stringify(patch).slice(0, 200) });
      },

      cancelProject: (id, reason) => {
        get().updateProject(id, { status: "CANCELLED" });
        get().audit("DELETE", "Project", `Project soft-cancelled (status → CANCELLED) — reason: ${reason}. History preserved; audit append-only.`, { entityId: id });
      },

      runPrediction: (id) => {
        set(s => {
          const projects = s.projects.map(p => {
            if (p.id !== id) return p;
            const next = recomputeProject(p, s.thresholds);
            if (next.status === "ACTIVE" || next.status === "ON_HOLD") next.prediction = computeDelayPrediction(next);
            else if (next.status === "PLANNING") {
              // v4: baseline (pre-execution) prediction — Run prediction works
              // from minute one instead of silently doing nothing.
              const base = computeDelayPrediction(next);
              next.prediction = { ...base, isBaseline: true };
            }
            return next;
          });
          return { projects, vectorIndex: buildIndex(projects) };
        });
        const p = get().projects.find(x => x.id === id);
        if (p?.prediction) {
          get().audit("PREDICTION_RUN", "PredictionResult", `Manual scoring run on ${p.psId}: p=${Math.round(p.prediction.probability * 100)}%, slip ${p.prediction.estimatedDays}d, CI ${p.prediction.ciLower}–${p.prediction.ciUpper}, model ${p.prediction.modelVersion}${p.prediction.isBaseline ? " (baseline · pre-execution)" : ""}`, { entityId: id });
          // v4: always give visible feedback — the #1 "nothing happened" complaint
          get().pushNotification({ userId: "all", title: `🧮 Prediction refreshed — ${p.psId}`, message: `${p.prediction.isBaseline ? "Baseline (pre-execution) risk" : "Delay risk"} ${Math.round(p.prediction.probability * 100)}% · est. slip ${p.prediction.estimatedDays}d · 90% CI ${p.prediction.ciLower}–${p.prediction.ciUpper}. Factors: ${p.prediction.factors.slice(0, 2).map(f => f.label).join(", ")}.`, type: "SYSTEM", linkView: "project-detail", linkProjectId: id });
          // evaluate alert rules with fresh prediction
          applyNewAlerts(set, get, p);
        } else {
          get().pushNotification({ userId: "all", title: `Prediction not available — ${p?.psId ?? id}`, message: "Predictions run for Planning and Active projects. Completed or cancelled projects keep their final record only.", type: "SYSTEM" });
        }
      },

      retrainModel: () => {
        const nextVersion = simulateRetrain(get().modelVersions.filter(m => m.status !== "retired").length);
        const registry = [nextVersion, ...get().modelVersions.map(m => ({ ...m, status: "retired" as const }))].slice(0, 8);
        set({ modelVersions: registry });
        get().audit("MODEL_RETRAIN", "ModelVersion", `Retraining job completed → ${nextVersion.version}: accuracy ${nextVersion.metrics.auc}, avg. error ${nextVersion.metrics.maeDays}d on ${nextVersion.trainedOn} samples. Promoted after the shadow-week gate.`);
      },

      setMilestoneStatus: (projectId, milestoneId, status) => {
        const p = get().projects.find(x => x.id === projectId);
        const m = p?.milestones.find(x => x.id === milestoneId);
        if (!p || !m) return { ok: false, error: "not_found" };
        const legal: Record<Milestone["status"], Milestone["status"][]> = {
          PENDING: ["IN_PROGRESS"], IN_PROGRESS: ["COMPLETED", "DELAYED", "PENDING"],
          COMPLETED: [], DELAYED: ["IN_PROGRESS", "COMPLETED"], BLOCKED: ["IN_PROGRESS", "PENDING"],
        };
        if (!legal[m.status].includes(status)) return { ok: false, error: `INVALID_STATE_TRANSITION: ${m.status} → ${status} not allowed (COMPLETED is terminal; use API error code 409 in production).` };
        set(s => ({
          projects: s.projects.map(pp => pp.id !== projectId ? pp : {
            ...recomputeProject({
              ...pp,
              milestones: pp.milestones.map(mm => mm.id !== milestoneId ? mm : {
                ...mm, status, progress: status === "COMPLETED" ? 100 : status === "IN_PROGRESS" ? Math.max(mm.progress, 25) : mm.progress,
                actualDate: status === "COMPLETED" ? new Date().toISOString() : mm.actualDate,
              }),
            }, s.thresholds),
          }),
        }));
        get().audit("UPDATE", "Milestone", `Milestone “${m.name}” status ${m.status} → ${status} (state-machine validated) · health recomputed`, { entityId: milestoneId });
        const updated = get().projects.find(x => x.id === projectId)!;
        applyNewAlerts(set, get, updated);
        return { ok: true };
      },

      addMilestone: (projectId, m) => {
        set(s => ({
          projects: s.projects.map(p => p.id !== projectId ? p : {
            ...p,
            milestones: [...p.milestones, { ...m, id: uid("ms"), projectId, order: p.milestones.length }],
          }),
        }));
        get().audit("CREATE", "Milestone", `Milestone “${m.name}” added (planned ${m.plannedDate.slice(0, 10)}${m.isCritical ? " · critical path" : ""})`, { entityId: projectId });
      },

      moveTask: (projectId, taskId, status, progress) => {
        const before = get().projects.find(p => p.id === projectId)?.tasks.find(t => t.id === taskId);
        set(s => ({
          projects: s.projects.map(p => p.id !== projectId ? p : {
            ...recomputeProject({
              ...p,
              tasks: p.tasks.map(t => t.id !== taskId ? t : { ...t, status, progress: progress ?? (status === "COMPLETED" ? 100 : status === "IN_PROGRESS" ? Math.max(t.progress, 30) : 0) }),
            }, s.thresholds),
          }),
        }));
        if (before) get().audit("UPDATE", "Task", `Kanban move: “${before.name}” ${before.status} → ${status} · task:moved event broadcast to room project:${projectId}`, { entityId: taskId });
      },

      addBudgetRecord: (projectId, r) => {
        set(s => ({
          projects: s.projects.map(p => p.id !== projectId ? p : {
            ...recomputeProject({
              ...p,
              budgetRecords: [...p.budgetRecords, { ...r, id: uid("br"), projectId }],
              spentBudget: r.spent > 0 ? p.spentBudget + r.spent : p.spentBudget,
            }, s.thresholds),
          }),
        }));
        get().audit("CREATE", "BudgetRecord", `Budget line posted: ${r.category} · ${r.month}/${r.year} · planned ₹${r.planned}L · spent ₹${r.spent}L · burn chart refreshed`, { entityId: projectId });
        applyNewAlerts(set, get, get().projects.find(p => p.id === projectId)!);
      },

      addResource: (projectId, r) => {
        set(s => ({
          projects: s.projects.map(p => p.id !== projectId ? p : {
            ...recomputeProject({ ...p, resources: [...p.resources, { ...r, id: uid("rs"), projectId }] }, s.thresholds),
          }),
        }));
        get().audit("CREATE", "ResourceAllocation", `Resource “${r.name}” allocated (${r.quantity} ${r.unit}, ${r.utilised}% planned utilisation)`, { entityId: projectId });
      },

      updateResource: (projectId, resourceId, utilised) => {
        set(s => ({
          projects: s.projects.map(p => p.id !== projectId ? p : {
            ...recomputeProject({
              ...p,
              resources: p.resources.map(r => r.id !== resourceId ? r : {
                ...r, utilised, status: utilised > 90 ? "bottleneck" : utilised > 78 ? "constrained" : "available",
              }),
            }, s.thresholds),
          }),
        }));
        get().audit("UPDATE", "ResourceAllocation", `Resource utilisation updated to ${utilised}% (bottleneck rule >90%)`, { entityId: resourceId });
        applyNewAlerts(set, get, get().projects.find(p => p.id === projectId)!);
      },

      ingestDocument: (projectId, doc) => {
        // v8: ingestion re-derives the LIVE risk register from every document
        // (documents + engine + context), fires risk alerts for high-severity
        // findings, re-runs the prediction and reports the risk count.
        let riskCount = 0;
        let newAlerts = 0;
        set(s => {
          const projects = s.projects.map(p => {
            if (p.id !== projectId) return p;
            const withDoc: Project = { ...p, documents: [doc, ...p.documents] };
            const reg = deriveRiskRegister(withDoc);
            riskCount = reg.counts.total;
            const riskAlerts = riskAlertsFromRegister(withDoc, reg, withDoc.alerts);
            newAlerts = riskAlerts.length;
            const prediction = withDoc.status === "ACTIVE" || withDoc.status === "ON_HOLD"
              ? computeDelayPrediction(withDoc)
              : { ...computeDelayPrediction(withDoc), isBaseline: true };
            const next: Project = { ...withDoc, riskAssessment: riskAssessmentFromRegister(reg, withDoc), alerts: [...riskAlerts, ...withDoc.alerts], prediction };
            return recomputeProject(next, s.thresholds);
          });
          return { projects, vectorIndex: buildIndex(projects) };
        });
        get().audit("UPLOAD", "Document", `${doc.fileName} ingested → ${doc.extractedData?.fields.length ?? 0} fields validated · risk register re-derived (${riskCount} risks · ${newAlerts} new alert${newAlerts === 1 ? "" : "s"}) · prediction re-scored · search index updated`, { entityId: doc.id });
        const project = get().projects.find(p => p.id === projectId);
        const docUser = get().user;
        if (docUser) {
          get().pushNotification({ userId: docUser.id, title: `📄 Document processed — ${riskCount} risks on the register`, message: `${doc.fileName}: ${doc.extractedData?.fields.length ?? 0} fields auto-captured · risk scanner found ${doc.extractedData?.risks.filter(r => !/^No material/.test(r)).length ?? 0} document risk${(doc.extractedData?.risks.filter(r => !/^No material/.test(r)).length ?? 0) === 1 ? "" : "s"} · live register now holds ${riskCount}.`, type: "DOCUMENT", linkView: "project-detail", linkProjectId: projectId });
        }
        if (newAlerts > 0 && docUser) {
          get().pushNotification({ userId: docUser.id, title: `🚨 ${newAlerts} new high-severity risk alert${newAlerts === 1 ? "" : "s"}`, message: `${doc.fileName} raised ${newAlerts} alert${newAlerts === 1 ? "" : "s"} — see the Early Warnings page or the project's Alerts tab.`, type: "ALERT", linkView: "alerts", linkProjectId: projectId });
        }
        // v23: real-time document-review approval request for user projects
        if (project && docUser && docUser.source !== "demo") {
          get().raiseApprovalRequest({
            kind: "document-review",
            projectId: project.id,
            psId: project.psId,
            project: project.name,
            title: `Document submitted for review — ${doc.fileName}`,
            message: `${docUser.name} uploaded “${doc.fileName}” to ${project.psId} · ${project.name}. Extracted ${doc.extractedData?.fields.length ?? 0} fields · ${riskCount} risks on the register. Review to confirm the submission.`,
          });
        }
        void get().syncNow(true);
      },

      // v21: geo-tagged photo evidence — REAL EXIF GPS + haversine verdict
      submitEvidence: (input) => {
        const p = get().projects.find(x => x.id === input.projectId);
        if (!p) return null;
        const ev: SiteEvidence = {
          ...input,
          id: uid("ev"),
          submittedBy: get().user?.name ?? "field officer",
          submittedAt: new Date().toISOString(),
          reviewStatus: "pending",
        };
        set(s => ({
          projects: s.projects.map(pp => pp.id !== p.id ? pp : {
            ...pp,
            evidence: [ev, ...(pp.evidence ?? [])].slice(0, 24),
          }),
        }));
        get().audit("EVIDENCE_SUBMIT", "SiteEvidence", `Geo-tagged photo “${ev.fileName}” submitted for ${p.psId}${ev.milestoneName ? ` · milestone “${ev.milestoneName}”` : ""} — verdict ${ev.verdict}${ev.distanceKm !== undefined ? ` (${ev.distanceKm} km from site)` : ""}`, { entityId: ev.id });
        const evUser = get().user;
        // notify the owner: verified evidence is progress proof
        if (evUser) {
          if (ev.verdict === "VERIFIED" || ev.verdict === "NEAR_SITE") {
            get().pushNotification({ userId: evUser.id, title: `📸 Site evidence ${ev.verdict === "VERIFIED" ? "verified" : "flagged near-site"} — ${p.psId}`, message: `${ev.fileName} · GPS ${ev.distanceKm ?? "?"} km from site · ${ev.verdict === "VERIFIED" ? "auto-acceptable" : "needs manual review"}.`, type: "SYSTEM", linkView: "project-detail", linkProjectId: p.id });
          } else {
            get().pushNotification({ userId: evUser.id, title: `⚠️ Evidence rejected by GPS check — ${p.psId}`, message: `${ev.fileName}: ${ev.reason}`, type: "ALERT", linkView: "project-detail", linkProjectId: p.id });
          }
        }
        // v23: real-time evidence-verification approval request for user projects
        if (evUser && evUser.source !== "demo") {
          get().raiseApprovalRequest({
            kind: "evidence-verification",
            projectId: p.id,
            psId: p.psId,
            project: p.name,
            title: `Site evidence awaiting verification — ${ev.fileName}`,
            message: `${evUser.name} submitted geo-tagged photo “${ev.fileName}” for ${p.psId} · ${p.name} (GPS verdict: ${ev.verdict}${ev.distanceKm !== undefined ? `, ${ev.distanceKm} km from site` : ""}). Verify to accept the field proof.`,
          });
        }
        void get().syncNow(true);
        return ev;
      },

      reviewEvidence: (projectId, evidenceId, accept, note) => {
        const p = get().projects.find(x => x.id === projectId);
        const ev = p?.evidence?.find(e => e.id === evidenceId);
        if (!p || !ev) return { ok: false, error: "not_found" };
        set(s => ({
          projects: s.projects.map(pp => pp.id !== projectId ? pp : {
            ...pp,
            evidence: (pp.evidence ?? []).map(e => e.id !== evidenceId ? e : {
              ...e,
              reviewStatus: accept ? "accepted" : "rejected",
              reviewedBy: get().user?.name ?? "officer",
              reviewedAt: new Date().toISOString(),
              reviewNote: note,
            }),
          }),
        }));
        get().audit("EVIDENCE_REVIEW", "SiteEvidence", `Evidence “${ev.fileName}” on ${p.psId} ${accept ? "ACCEPTED" : "REJECTED"}${note ? ` · note: ${note}` : ""} by ${get().user?.name}`, { entityId: evidenceId });
        void get().syncNow();
        return { ok: true };
      },

      deleteDocument: (projectId, docId) => {
        const doc = get().projects.find(p => p.id === projectId)?.documents.find(d => d.id === docId);
        set(s => {
          const projects = s.projects.map(p => p.id !== projectId ? p : { ...p, documents: p.documents.filter(d => d.id !== docId) });
          return { projects, vectorIndex: buildIndex(projects) };
        });
        get().audit("DELETE", "Document", `${doc?.fileName ?? docId} deleted (soft) · embeddings purged from vector index`, { entityId: docId });
      },

      // ─── alerts / notifications / email ──────────────────────────────────
      markAlertRead: (projectId, alertId) => {
        set(s => ({ projects: s.projects.map(p => p.id !== projectId ? p : { ...p, alerts: p.alerts.map(a => a.id === alertId ? { ...a, isRead: true } : a) }) }));
      },

      markAllAlertsRead: () => {
        set(s => ({ projects: s.projects.map(p => ({ ...p, alerts: p.alerts.map(a => ({ ...a, isRead: true })) })) }));
        get().audit("UPDATE", "Alert", "All alerts marked read across scoped portfolio");
      },

      acknowledgeAlert: (projectId, alertId, actionTaken) => {
        const u = get().user;
        set(s => ({
          projects: s.projects.map(p => p.id !== projectId ? p : {
            ...p, alerts: p.alerts.map(a => a.id === alertId ? { ...a, isRead: true, actionTaken, acknowledgedBy: u?.name, acknowledgedAt: new Date().toISOString() } : a),
          }),
        }));
        get().audit("ALERT_ACK", "Alert", `Alert acknowledged with action note: “${actionTaken}”`, { entityId: alertId });
      },

      simulateCriticalSlip: (projectId) => {
        const s = get();
        const p = s.projects.find(x => x.id === projectId);
        if (!p) return;
        const slip = 21 + Math.floor(Math.random() * 18);
        const alert: Alert = {
          id: uid("al"), projectId,
          title: `Simulated critical slip: ${slip}-day milestone breach`,
          description: `Field event injected (WebSocket alert:broadcast simulation): milestone slipped ${slip} days. Delay model re-scored; probability updated. This is the jury-demo “live alert” moment.`,
          severity: "CRITICAL", type: "MILESTONE_SLIPPAGE", isRead: false, createdAt: new Date().toISOString(),
          recommendedAction: `Confirm the slip with the site office and issue a revised baseline within 48 hours.`, recommendedOwner: p.projectManager, recommendedDeadline: "within 48 hours", emailQueued: true,
        };
        set(st => ({
          projects: st.projects.map(pp => pp.id !== projectId ? pp : {
            ...recomputeProject({ ...pp, alerts: [alert, ...pp.alerts], milestones: pp.milestones.map(m => m.status === "IN_PROGRESS" ? { ...m, status: "DELAYED" as const } : m) }, st.thresholds),
          }),
        }));
        get().pushNotification({ userId: "all", title: `🚨 CRITICAL — ${p.name.replace(/,.*$/, "")}`, message: `Simulated slip: ${slip}-day milestone breach. Email queued to ${get().emailSettings.criticalTo[0]}.`, type: "ALERT", linkView: "alerts", linkProjectId: projectId });
        if (s.emailSettings.alertEmailsEnabled) {
          void get().queueEmail({ to: s.emailSettings.criticalTo[0] ?? "alert-critical@mospi.gov.in", toName: "MoSPI Critical Alerts", template: "critical_alert", project: get().projects.find(x => x.id === projectId), projectId, send: true });
        }
        get().audit("CREATE", "Alert", `Simulated critical slip injected on ${p.psId} (${slip} days) · alert + notification + email chain executed`);
      },

      markNotificationRead: (id) => set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, isRead: true } : n) })),
      markAllNotificationsRead: () => set(s => ({ notifications: s.notifications.map(n => ({ ...n, isRead: true })) })),

      pushNotification: (n) => set(s => ({ notifications: cap([{ ...n, id: (n as { id?: string }).id || uid("nt"), isRead: false, createdAt: new Date().toISOString() }, ...s.notifications], 60) })),

      queueEmail: async (opts) => {
        const msg = composeEmail(opts);
        const finalMsg = opts.send !== false ? await sendEmail(msg) : msg;
        set(s => ({ emails: cap([finalMsg, ...s.emails], 80) }));
        get().audit("EMAIL_SEND", "Email", `${finalMsg.template} email → ${finalMsg.to} [${finalMsg.status}${finalMsg.provider ? " · " + finalMsg.provider : ""}]${finalMsg.attachments.length ? ` · ${finalMsg.attachments.length} attachment(s)` : ""}`);
        get().pushNotification({ userId: "all", title: `📧 Email ${finalMsg.status === "SENT" ? "sent" : "queued to outbox"} — ${finalMsg.to}`, message: finalMsg.subject, type: "EMAIL", linkView: "email-center" });
        return finalMsg;
      },

      updateEmailSettings: (patch) => {
        set(s => ({ emailSettings: { ...s.emailSettings, ...patch } }));
        get().audit("SETTINGS", "EmailSettings", `Email settings updated: ${Object.keys(patch).join(", ")} · ${patch.provider ?? get().emailSettings.provider}`);
      },

      // ─── settings ─────────────────────────────────────────────────────────
      setThresholds: (patch) => {
        set(s => ({ thresholds: { ...s.thresholds, ...patch } }));
        // recompute every project's band under new thresholds
        set(s => ({ projects: s.projects.map(p => ({ ...p, healthStatus: p.healthScore >= get().thresholds.amberAt ? "HEALTHY" : p.healthScore >= get().thresholds.redAt ? "AT_RISK" : "CRITICAL" })) }));
        get().audit("SETTINGS", "Thresholds", `Health thresholds updated: ${JSON.stringify(patch)} · all bands recomputed · live donut preview refreshed`);
      },

      toggleAlertRule: (id) => {
        set(s => ({ alertRules: s.alertRules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r) }));
        const r = get().alertRules.find(x => x.id === id);
        get().audit("SETTINGS", "AlertRule", `Rule “${r?.name}” ${r?.enabled ? "enabled" : "disabled"} (channel: ${r?.channel})`);
      },

      setAlertRuleChannel: (id, channel) => {
        set(s => ({ alertRules: s.alertRules.map(r => r.id === id ? { ...r, channel } : r) }));
      },

      setDensity: (d) => set({ density: d }),
      setLiveEventsEnabled: (v) => set({ liveEventsEnabled: v }),
      setDataMode: (m) => set(s => ({ dataMode: { ...s.dataMode, ...m, lastCheckedAt: new Date().toISOString() } })),

      // ─── chat ─────────────────────────────────────────────────────────────
      createThread: () => {
        const u = get().user;
        const t: ChatThread = { id: uid("th"), title: "New conversation", userId: u?.id ?? "anon", messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        set(s => ({ chatThreads: cap([t, ...s.chatThreads], 6), aiActiveThreadId: t.id }));
        return t.id;
      },

      deleteThread: (id) => set(s => ({ chatThreads: s.chatThreads.filter(t => t.id !== id) })),

      // v3 fix: these three actions were consumed by the shell + side panel but
      // never defined — every “Ask Assure Intelligence” button crashed. Now real:
      setAiOpen: (open) => set({ aiOpen: open, paletteOpen: false }),

      clearAiSeed: () => set({ aiSeedQuestion: null }),

      setAiContext: (projectId) => set({ aiContextProjectId: projectId }),

      askAi: async (question, projectId) => {
        // v4: a project context makes the answer the project's OWN detailed
        // Intelligence recommended system (actions, root causes, KPIs, no-action impact)
        set({ aiOpen: true, aiSeedQuestion: null, aiContextProjectId: projectId ?? get().aiContextProjectId });
        try {
          await get().ask(question);
        } catch {
          // never leave the panel broken: push an honest error message into the thread
          const threadId = get().chatThreads[0]?.id ?? get().createThread();
          const errMsg: ChatMessage = { id: uid("msg"), role: "assistant", content: "⚠ Assure Intelligence could not complete that request. The built-in engine may have hit an edge case — try rephrasing (e.g. name a specific project) or retry in a moment.", createdAt: new Date().toISOString() };
          set(s => ({ chatThreads: s.chatThreads.map(t => t.id === threadId ? { ...t, messages: cap([...t.messages, errMsg], 30) } : t) }));
        }
      },

      // v21: ─── Sync Hub actions ─────────────────────────────────────────
      syncNow: async (immediate) => {
        const s = get();
        if (!immediate) {
          scheduleSync(() => ({ buildArgs: () => buildSyncSnapshot({ projects: get().projects, users: get().users, notifications: get().notifications, emails: get().emails, audit: get().globalAudit, liveEvents: get().liveEvents, approvalRequests: get().approvalRequests }) }));
          scheduleCloudSave(set, get);
          return true;
        }
        const snapshot = buildSyncSnapshot({ projects: s.projects, users: s.users, notifications: s.notifications, emails: s.emails, audit: s.globalAudit, liveEvents: s.liveEvents, approvalRequests: s.approvalRequests });
        const ok = await pushSyncNow(snapshot);
        if (s.user?.source === "registered" && s.user.stateToken) void get().saveUserStateNow();
        if (ok) set({ lastSyncAt: new Date().toISOString() });
        return ok;
      },

      // v23: persist THIS user's isolated workspace to the cloud database.
      saveUserStateNow: async () => {
        const u = get().user;
        if (!u || u.source !== "registered" || !u.stateToken) return false;
        set({ cloudSaving: true });
        try {
          const s = get();
          const snapshot = {
            version: 1,
            projects: s.projects,
            notifications: s.notifications,
            emails: s.emails,
            interventions: s.interventions,
            globalAudit: s.globalAudit.slice(0, 400),
            chatThreads: s.chatThreads.slice(0, 6),
            approvalRequests: s.approvalRequests,
          };
          const res = await fetch("/api/user-state", {
            method: "PUT",
            headers: { "Content-Type": "application/json", "x-user-token": u.stateToken },
            body: JSON.stringify({ snapshot }),
          });
          set({ cloudSaving: false, lastCloudSaveAt: res.ok ? new Date().toISOString() : null });
          return res.ok;
        } catch {
          set({ cloudSaving: false });
          return false;
        }
      },

      // v23: raise an approval request that surfaces in Host Control's
      // Approvals Centre within seconds and returns as a live decision.
      raiseApprovalRequest: (req) => {
        const u = get().user;
        if (!u) return null;
        const entry: SyncApprovalRequest = {
          ...req,
          id: `ar-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          requestedBy: u.name,
          ownerId: u.id,
          at: new Date().toISOString(),
        };
        set(s => ({ approvalRequests: cap([entry, ...s.approvalRequests], 40) }));
        // immediate push so the host sees it on the next 5s poll
        void get().syncNow(true);
        return entry;
      },

      broadcastAlert: ({ title, message, severity }) => {
        const u = get().user;
        if (!u || u.role !== "ADMIN") return { ok: false, error: "Only administrators can broadcast." };
        const at = new Date().toISOString();
        // 1) every user in THIS browser instance gets the notification
        get().pushNotification({ userId: "all", title: `📢 ${title}`, message, type: severity === "critical" ? "ALERT" : "SYSTEM", linkView: "alerts" });
        // 2) push to the Sync Hub so Host Control and every other connected
        //    browser receives it via the command poll (real cross-client path)
        void fetch("/api/sync/webhook", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "broadcast", title, message, severity, createdBy: u.name, audience: "all" }),
        }).catch(() => { /* offline ok */ });
        get().audit("ALERT_BROADCAST", "Alert", `Broadcast “${title}” (${severity}) sent to all users — queued in sync hub for every connected client`, { entityId: u.id });
        return { ok: true };
      },

      // v21: ─── ML Lab actions ─────────────────────────────────────────────
      trainMlModel: (opts) => {
        const projects = get().projects.filter(p => p.status !== "CANCELLED");
        if (projects.length < 3) return { error: "Need at least 3 non-cancelled projects with milestones to train — create a few projects first (or load the demo world)." };
        try {
          const model = trainModel(projects, opts);
          set(s => ({ mlModels: [model, ...s.mlModels].slice(0, 10) }));
          get().audit("MODEL_TRAIN", "MlModel", `${model.name} trained on ${model.trainedOn} rows (${model.realRows} real) — held-out AUC ${model.metricsTest.auc} · accuracy ${model.metricsTest.accuracy} · F1 ${model.metricsTest.f1} · test size ${model.testSize} real projects`, { entityId: model.id });
          return model;
        } catch (err) {
          return { error: `Training failed: ${String(err)}` };
        }
      },

      promoteMlModel: (id) => {
        const m = get().mlModels.find(x => x.id === id);
        if (!m) return;
        set({ mlChampionId: id });
        // re-score every prediction with the new champion
        set(s => ({
          projects: s.projects.map(p => {
            if (p.status === "CANCELLED" || !p.milestones.length) return p;
            const prob = predictWithModel(m, p);
            const days = estimatedDaysFromFeatures(p, prob);
            const ciBand = Math.max(7, Math.round(days * 0.32 + 6));
            return {
              ...p,
              prediction: {
                ...(p.prediction ?? { id: p.id + "-pred", projectId: p.id, predictionType: "delay" as const, computedAt: new Date().toISOString(), featureSnapshot: {} }),
                probability: prob,
                estimatedDays: days,
                ciLower: Math.max(0, days - ciBand),
                ciUpper: days + ciBand,
                confidence: clamp(0.62 + m.metricsTest.auc * 0.3, 0.6, 0.97),
                factors: factorsFromModel(m, p),
                modelVersion: `${m.name.split(" ·")[0]} (${m.algorithm})`,
                computedAt: new Date().toISOString(),
              },
            };
          }),
        }));
        get().audit("MODEL_PROMOTE", "MlModel", `${m.name} promoted to champion — all live delay predictions re-scored with the trained model (held-out AUC ${m.metricsTest.auc})`, { entityId: id });
        get().pushNotification({ userId: "all", title: "🧠 New champion model live", message: `${m.name} now powers every delay prediction. Held-out AUC ${m.metricsTest.auc} · accuracy ${m.metricsTest.accuracy} on ${m.testSize} real projects.`, type: "SYSTEM", linkView: "model-lab" });
        void get().syncNow();
      },

      deleteMlModel: (id) => {
        const m = get().mlModels.find(x => x.id === id);
        if (!m) return;
        if (get().mlChampionId === id) {
          // demote first: fall back to the built-in engine
          set(s => ({
            mlChampionId: null,
            projects: s.projects.map(p => (p.prediction && p.prediction.modelVersion.includes(m.name.split(" ·")[0]) ? { ...p, prediction: computeDelayPrediction(p) } : p)),
          }));
        }
        set(s => ({ mlModels: s.mlModels.filter(x => x.id !== id) }));
        get().audit("MODEL_RETIRE", "MlModel", `${m.name} removed from the registry`, { entityId: id });
      },

      // v11: probe the live intelligence service once per session (server caches
      // for 90s). If it is connected and the user never chose a mode, live mode
      // turns itself on — the assistant is at its best out of the box, on any
      // deployment (sandbox, Vercel with keys, or offline → built-in engine).
      refreshAiStatus: async () => {
        try {
          const res = await fetch("/api/ai/status");
          const data = await res.json();
          const status = { connected: !!data.connected, label: String(data.label ?? "built-in engine"), tier: String(data.tier ?? "built-in") };
          set({ aiStatus: status });
          let chose: string | null = null;
          try { chose = localStorage.getItem("projectassure-ai-live"); } catch { /* ignore */ }
          if (status.connected && chose === null && !get().aiLiveMode) {
            set({ aiLiveMode: true });
            set(s => ({ dataMode: { ...s.dataMode, aiProvider: "live" } }));
            try { localStorage.setItem("projectassure-ai-live", "1"); } catch { /* ignore */ }
          }
        } catch { /* offline — the built-in engine serves everything */ }
      },

      ask: async (question) => {
        // v21 FIX: answers used to always land in threads[0] — the active thread
        // is now tracked explicitly so every conversation stays intact.
        let threadId = get().aiActiveThreadId ?? get().chatThreads[get().chatThreads.length - 1]?.id ?? get().chatThreads[0]?.id;
        if (!threadId) threadId = get().createThread();
        set({ aiActiveThreadId: threadId });
        const userMsg: ChatMessage = { id: uid("msg"), role: "user", content: question, createdAt: new Date().toISOString(), files: get().aiAttachedFiles.map(f => ({ name: f.name, size: f.size })) };
        set(s => ({ chatThreads: s.chatThreads.map(t => t.id === threadId ? { ...t, title: t.messages.length === 0 ? question.slice(0, 48) : t.title, messages: cap([...t.messages, userMsg], 30), updatedAt: new Date().toISOString() } : t) }));

        let answer;
        // RBAC v3: answer from the *scoped* portfolio so viewers/stakeholders only
        // ever see projects they are allowed to see (matches the UI claims).
        const scopedList = get().scoped();
        const ctxProject = get().aiContextProjectId ? scopedList.find(p => p.id === get().aiContextProjectId) : undefined;

        // v11: LIVE SERVICE FIRST — when live mode is on, the live model answers
        // grounded on the FULL project dossier (documents' real text, live risk
        // register, milestones, budget, alerts, KPIs, pending approvals and the
        // engine's own computed recommended actions) plus a compact portfolio
        // snapshot. The prompt enforces short, decision-shaped answers; if the
        // service fails or is off, the deterministic engine answers as before.
        if (get().aiLiveMode) {
          const snapshot = scopedList.slice().sort((a, b) => a.healthScore - b.healthScore).slice(0, 10).map(p =>
            `${p.psId} "${p.name}" | ${p.district}, ${p.state} | ${p.sector} | status ${p.status} | health ${p.healthScore} (${p.healthStatus}) S${p.scheduleScore}/B${p.budgetScore}/R${p.resourceScore}/M${p.milestoneScore} | progress ${p.progress}% | sanction ₹${p.totalBudget}L spent ₹${p.spentBudget}L projected ₹${p.projectedBudget}L | delay ${p.prediction ? Math.round(p.prediction.probability * 100) + "% " + p.prediction.estimatedDays + "d CI" + p.prediction.ciLower + "-" + p.prediction.ciUpper : "n/a"} | top factor: ${p.prediction?.factors[0]?.label ?? "n/a"} | unread alerts: ${p.alerts.filter(a => !a.isRead).map(a => a.title).join("; ") || "none"} | latest doc: ${p.documents[0]?.fileName ?? "none"}`).join("\n");
          const dossier = (!get().aiUniversalMode && ctxProject) ? buildProjectDossier(ctxProject, scopedList) : "";
          // v13: last 6 turns as history for multi-turn continuity
          const history = (threadId ? get().chatThreads.find(t => t.id === threadId)?.messages.slice(-6) : undefined) ?? [];
          // v13: attached files (text already extracted client-side)
          const files = get().aiAttachedFiles.slice(0, 5);
          try {
            const res = await fetch("/api/ai/chat", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                question, user: { name: get().user?.name, role: get().user?.role },
                // In universal mode, no project context — let the model answer freely.
                context: get().aiUniversalMode ? "" : `PORTFOLIO (${scopedList.length} projects, worst first):\n${snapshot}`,
                dossier,
                universal: get().aiUniversalMode,
                files: files.map(f => ({ name: f.name, type: f.type, size: f.size, text: f.text })),
                history: history.map(m => ({ role: m.role, content: typeof m.content === "string" ? m.content : m.content ?? "" })),
              }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data && data.answer) {
                answer = { answer: data.answer, toolCalls: data.toolCalls ?? [], citations: data.citations ?? [], intent: data.intent ?? "live", dataFreshness: data.freshness ?? "", grounded: true, source: "live-llm" as const };
              }
            }
          } catch { /* fall through to the deterministic engine */ }
        }

        // Deterministic path (live mode off, or the live service was unavailable):
        if (!answer) {
          // v13: in universal mode with no project context, defer to a friendly offline message
          if (get().aiUniversalMode && !ctxProject) {
            answer = {
              answer: "Universal mode is on, but live intelligence is not connected on this deployment right now.\n\nThe built-in engine still answers project questions with full grounding — switch off universal mode for portfolio analysis, or ask the administrator to connect a live intelligence provider.",
              toolCalls: [], citations: [], intent: "universal-offline", dataFreshness: "offline · no provider connected", grounded: false, source: "builtin" as const,
            };
          } else if (ctxProject && /plan|should|recommend|next|do|assess|advice|why|risk|status|report/i.test(question)) {
            answer = buildProjectActionPlan(ctxProject, get().vectorIndex);
            const trace0 = answer.toolCalls[0];
            if (trace0) trace0.args = `context: ${ctxProject.psId} · ${question.slice(0, 80)}`;
          }
          if (!answer) answer = answerQuestion(question, scopedList, get().vectorIndex);
        }

        // v23: APPROVAL INTENT — when the user asks the assistant to approve /
        // sanction / escalate something on a project, the request is sent to
        // Host Control in real time and the answer confirms the live loop.
        if (ctxProject && /approv|sanction|permission|authori[sz]e|escalat|sign[- ]?off|clear.*budget|budget.*increase|extend.*time|extension/i.test(question)) {
          const req = get().raiseApprovalRequest({
            kind: "ai-request",
            projectId: ctxProject.id,
            psId: ctxProject.psId,
            project: ctxProject.name,
            title: `Intelligence request — ${ctxProject.psId}`,
            message: `${get().user?.name ?? "A user"} asked Assure Intelligence: “${question.slice(0, 220)}”. The request is grounded on the project's live dossier (health ${Math.round(ctxProject.healthScore)}, delay risk ${Math.round((ctxProject.prediction?.probability ?? 0) * 100)}%). Decide to confirm or decline with a note back to the requester.`,
          });
          if (req) {
            answer = {
              ...answer,
              answer: `${answer.answer}\n\n---\n✅ **Approval request sent to the Central Programme Office.**\n\n- Request: “${question.slice(0, 120)}”\n- Grounded on: health ${Math.round(ctxProject.healthScore)} · delay risk ${Math.round((ctxProject.prediction?.probability ?? 0) * 100)}% · ${ctxProject.milestones.filter(m => m.status === "COMPLETED").length}/${ctxProject.milestones.length} milestones\n- It is now in the host's **Approvals Centre** (real time). You will receive a notification with the decision here, usually within moments.`,
            };
          }
        }

        const aiMsg: ChatMessage = { id: uid("msg"), role: "assistant", content: answer.answer, answer, createdAt: new Date().toISOString() };
        set(s => ({ chatThreads: s.chatThreads.map(t => t.id === threadId ? { ...t, messages: cap([...t.messages, aiMsg], 30), updatedAt: new Date().toISOString() } : t) }));
        return aiMsg;
      },

      // ─── exports ──────────────────────────────────────────────────────────
      recordExport: (kind, format, scope) => {
        const u = get().user;
        set(s => ({ exportHistory: cap([{ id: uid("ex"), kind, format, at: new Date().toISOString(), by: u?.name ?? "system", scope }], 50) }));
        get().audit("EXPORT", "Report", `${kind} exported as ${format.toUpperCase()} — scope: ${scope}`);
      },

      // ─── interventions (v3): issue → action → closure lifecycle ──────────
      createIntervention: (projectId, title, issue, why, severity, steps) => {
        const p = get().projects.find(x => x.id === projectId);
        if (!p) return null;
        const recommended = steps ?? buildRecommendedActions(p).slice(0, 3).map(a => a.action);
        const iv: Intervention = {
          id: uid("iv"), code: `#A${1000 + get().interventions.length + Math.floor(Math.random() * 90)}`,
          projectId, title, issue, why, severity,
          status: "DETECTED", detectedAt: new Date().toISOString(), source: "manual",
          raisedBy: get().user?.name ?? "officer",
          assignedTo: p.projectManager,
          deadline: new Date(Date.now() + 14 * 86400000).toISOString(),
          steps: recommended.slice(0, 5).map((text, i) => ({ id: uid("ivs"), text, owner: i === 0 ? p.projectManager : "Project Officer", dueDays: 7 * (i + 1), done: false })),
          evidenceCount: p.documents.filter(d => d.status === "PROCESSED").length,
          updates: [{ at: new Date().toISOString(), by: get().user?.name ?? "officer", note: "Issue raised manually and registered for tracking.", status: "DETECTED" }],
        };
        set(s => ({ interventions: [iv, ...s.interventions] }));
        get().pushNotification({ userId: "all", title: `📋 Intervention ${iv.code} opened`, message: `${title} — assigned to ${iv.assignedTo}, due ${new Date(iv.deadline).toLocaleDateString("en-IN")}.`, type: "SYSTEM", linkView: "interventions", linkProjectId: projectId });
        get().audit("CREATE", "Intervention", `${iv.code} “${title}” opened on ${p.psId} (${severity}) · assigned to ${iv.assignedTo} · 7-step lifecycle to closure`);
        return iv;
      },

      advanceIntervention: (id, note) => {
        const iv = get().interventions.find(x => x.id === id);
        if (!iv) return { ok: false, error: "not_found" };
        const idx = INTERVENTION_FLOW.indexOf(iv.status);
        if (idx >= INTERVENTION_FLOW.length - 1) return { ok: false, error: "already_closed" };
        const next = INTERVENTION_FLOW[idx + 1];
        const now = new Date().toISOString();
        const by = get().user?.name ?? "officer";
        set(s => ({ interventions: s.interventions.map(x => x.id !== id ? x : {
          ...x, status: next,
          closedAt: next === "CLOSED" ? now : x.closedAt,
          resolution: next === "CLOSED" ? (note ?? x.resolution ?? "Closed after verification.") : x.resolution,
          updates: [...x.updates, { at: now, by, note: note ?? `Status advanced to ${next}.`, status: next }],
        }) }));
        get().audit("UPDATE", "Intervention", `${iv.code} status ${iv.status} → ${next}${note ? ` · note: ${note}` : ""}`);
        return { ok: true };
      },

      reopenIntervention: (id, reason) => {
        const iv = get().interventions.find(x => x.id === id);
        if (!iv) return;
        const now = new Date().toISOString();
        set(s => ({ interventions: s.interventions.map(x => x.id !== id ? x : {
          ...x, status: "UNDER_INVESTIGATION", closedAt: undefined, resolution: undefined,
          updates: [...x.updates, { at: now, by: get().user?.name ?? "officer", note: `Reopened: ${reason}`, status: "UNDER_INVESTIGATION" }],
        }) }));
        get().audit("UPDATE", "Intervention", `${iv.code} reopened — ${reason}`);
      },

      toggleInterventionStep: (id, stepId) => {
        set(s => ({ interventions: s.interventions.map(x => x.id !== id ? x : {
          ...x, steps: x.steps.map(st => st.id !== stepId ? st : { ...st, done: !st.done, doneAt: !st.done ? new Date().toISOString() : undefined }),
        }) }));
      },

      markTourSeen: () => set({ tourSeen: true }),

      // ─── live events ──────────────────────────────────────────────────────
      applyNextEvent: () => {
        const s = get();
        if (!s.liveEventsEnabled || !s.user) return;
        const tick = s.eventTick + 1;
        const outcome = nextPortfolioEvent(s.projects, s.user, s.thresholds, tick);
        set({ eventTick: tick, liveEvents: cap([outcome.event, ...s.liveEvents], 30) });
        if (outcome.notifications.length) set(st => ({ notifications: cap([...outcome.notifications, ...st.notifications], 60) }));

        // v21: AUTOMATED deadline watchdog — every 4th tick (once a minute) it
        // scans for milestones past their planned date with no completion, marks
        // them DELAYED for real, fires alerts and queues the authority email.
        if (tick % 4 === 0) {
          const wd = runDeadlineWatchdog(get().projects);
          if (wd.triggered > 0) {
            set(st => ({
              projects: st.projects.map(p => {
                const patch = wd.patches.find(x => x.projectId === p.id);
                if (!patch) return p;
                return {
                  ...p,
                  milestones: p.milestones.map(m => patch.milestoneIds.includes(m.id) ? { ...m, status: "DELAYED" as const } : m),
                  alerts: [...wd.alerts.filter(a => a.projectId === p.id), ...p.alerts],
                };
              }),
              notifications: cap([...wd.notifications, ...st.notifications], 60),
              liveEvents: cap([{
                id: uid("ev"), kind: "new-alert", at: new Date().toISOString(),
                title: `Deadline watchdog — ${wd.triggered} overdue milestone${wd.triggered > 1 ? "s" : ""} flagged`,
                detail: `Automated scan marked overdue milestones DELAYED, raised ${wd.alerts.filter(a => a.emailQueued).length} authority email(s) and notified owners.`,
              }, ...st.liveEvents], 30),
            }));
            get().audit("DEADLINE_WATCHDOG", "Milestone", `Automated watchdog flagged ${wd.triggered} overdue milestone(s) across ${wd.patches.length} project(s) — marked DELAYED, alerts raised, authority emails queued`);
            // queue the authority email for critical overdue items
            const critical = wd.alerts.filter(a => a.emailQueued);
            for (const a of critical.slice(0, 2)) {
              const p = get().projects.find(x => x.id === a.projectId);
              if (p) void get().queueEmail({ to: get().emailSettings.criticalTo[0] ?? "watchdog@mospi.gov.in", toName: "Milestone Watchdog", template: "high_alert", project: p, projectId: p.id, send: true });
            }
            void get().syncNow();
          }
        }
        if (outcome.projectPatch) {
          const { projectId, patch } = outcome.projectPatch;
          // v3 fix: recompute through the engine so healthStatus band stays in
          // sync with the patched healthScore (map/legend could desync before)
          set(st => ({
            projects: st.projects.map(p => {
              if (p.id !== projectId) return p;
              const next = recomputeProject({ ...p, ...patch }, st.thresholds);
              next.healthComputedAt = new Date().toISOString();
              return next;
            }),
          }));
        }
        if (outcome.alert) {
          set(st => ({ projects: st.projects.map(p => p.id !== outcome.alert!.projectId ? p : { ...p, alerts: [outcome.alert!, ...p.alerts] }) }));
        }
      },

      // ─── users ────────────────────────────────────────────────────────────
      addUser: (u) => {
        if (get().users.some(x => x.email.toLowerCase() === u.email.toLowerCase())) return null;
        const initials = u.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
        const user: User = {
          id: uid("u"), name: u.name, email: u.email, password: u.password || "welcome123", role: u.role,
          departmentId: u.departmentId, avatarInitials: initials, designation: u.designation,
          persona: "Custom user", personaDescription: `Created by ${get().user?.name} with ${u.role} permissions.`,
          isActive: true, createdAt: new Date().toISOString(),
        };
        set(s => ({ users: cap([user, ...s.users], 24) }));
        get().audit("CREATE", "User", `User ${user.email} created with role ${user.role} (dept ${user.departmentId})`, { entityId: user.id });
        return user;
      },

      setUserRole: (userId, role) => {
        const before = get().users.find(u => u.id === userId)?.role;
        set(s => ({ users: s.users.map(u => u.id === userId ? { ...u, role } : u) }));
        get().audit("UPDATE", "User", `Role change ${before} → ${role} for ${get().users.find(u => u.id === userId)?.email} · effective at next DB-backed check (instant session revocation)`, { entityId: userId, before, after: role });
      },

      setUserActive: (userId, active) => {
        set(s => ({ users: s.users.map(u => u.id === userId ? { ...u, isActive: active } : u) }));
        get().audit("UPDATE", "User", `${active ? "Reactivated" : "Deactivated (soft-delete)"} ${get().users.find(u => u.id === userId)?.email}`, { entityId: userId });
      },

      // ─── selectors ────────────────────────────────────────────────────────
      scoped: () => (get().user ? scopedProjects(get().projects, get().user!) : []),
      stats: () => computePortfolioStats(get().scoped()),
    }),
    {
      name: "projectassure-store-v23",
      version: STORE_VERSION,
      // v23: fresh key — the per-user isolation release. Old shared-world
      // sessions boot clean: demo personas rebuild the 5-project world,
      // registered accounts re-hydrate from the cloud database.
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        user: s.user, projects: s.projects, users: s.users, notifications: s.notifications,
        emails: s.emails, globalAudit: s.globalAudit, chatThreads: s.chatThreads, interventions: s.interventions,
        thresholds: s.thresholds, alertRules: s.alertRules, emailSettings: s.emailSettings,
        modelVersions: s.modelVersions, dataMode: s.dataMode, liveEventsEnabled: s.liveEventsEnabled,
        density: s.density, exportHistory: s.exportHistory, eventTick: s.eventTick, booted: s.booted, tourSeen: s.tourSeen,
        aiUniversalMode: s.aiUniversalMode,  // v13: persists universal mode across reloads
        mlModels: s.mlModels, mlChampionId: s.mlChampionId,   // v21: trained models survive reloads
        aiAttachedFiles: s.aiAttachedFiles.slice(0, 3),       // v21: last files persist (text only, capped)
        approvalRequests: s.approvalRequests,                // v23: pending approval requests survive reloads
        lastCloudSaveAt: s.lastCloudSaveAt,                   // v23: cloud-save stamp
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.vectorIndex = buildIndex(state.projects ?? []);
      },
    },
  ),
);

// v21 helper: Host Control broadcasts arrive through the command poll and
// become real notifications + toasts for the addressed audience.
// v23: approval decisions ALSO mutate the project/evidence state directly
// so the user sees the outcome in-project, not only as a notification.
function applyHostCommands(
  set: (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void,
  get: () => AppState,
  cmds: SyncCommand[],
) {
  const me = get().user;
  const notifications = cmds.map((c) => ({
    id: c.id,
    userId: c.audience === "all" ? "all" : (me?.id ?? "all"),
    title: `${c.severity === "critical" ? "🚨" : c.severity === "warning" ? "⚠️" : c.kind === "project-approved" || c.kind === "document-reviewed" || c.kind === "evidence-reviewed" || c.kind === "ai-request-resolved" ? "✅" : "📢"} ${c.title}`,
    message: `${c.message}${c.createdBy ? `\n— ${c.createdBy} · Host Control` : ""}`,
    type: (c.severity === "critical" ? "ALERT" : "SYSTEM") as Notification["type"],
    isRead: false,
    createdAt: c.createdAt,
    linkView: (c.linkView as ViewId) ?? "alerts",
    linkProjectId: c.linkProjectId,
  })) as Notification[];

  // v23: apply approval decisions to the matching projects in THIS workspace
  const approvalKinds = new Set(["project-approved", "project-rejected", "document-reviewed", "evidence-reviewed", "ai-request-resolved"]);
  const approvalCmds = cmds.filter(c => approvalKinds.has(c.kind));
  if (approvalCmds.length) {
    set((s) => ({
      projects: s.projects.map(p => {
        const cmd = approvalCmds.find(c => c.linkProjectId === p.id);
        if (!cmd) return p;
        const approved = cmd.kind !== "project-rejected";
        const stamp = new Date().toISOString();
        return {
          ...p,
          approvalStatus: cmd.kind === "project-approved" ? (approved ? "approved" : "rejected") : (p.approvalStatus ?? (approved ? "approved" : "rejected")),
          approvalNote: cmd.message.slice(0, 240),
          approvalAt: stamp,
          // evidence/document review decisions mark pending evidence accepted
          evidence: (cmd.kind === "evidence-reviewed" || cmd.kind === "document-reviewed")
            ? (p.evidence ?? []).map(e => e.reviewStatus === "pending" ? {
              ...e,
              reviewStatus: approved ? "accepted" as const : "rejected" as const,
              reviewedBy: cmd.createdBy,
              reviewedAt: stamp,
              reviewNote: cmd.message.slice(0, 160),
            } : e)
            : p.evidence,
        };
      }),
      // clear resolved approval requests for the touched projects
      approvalRequests: s.approvalRequests.filter(r => !approvalCmds.some(c => c.linkProjectId === r.projectId)),
    }));
  }

  set((s) => ({
    notifications: cap([...notifications, ...s.notifications], 60),
    hostCommands: cap([...cmds.map((c) => ({ id: c.id, title: c.title, from: c.createdBy, at: c.createdAt })), ...s.hostCommands], 40),
  }));
  for (const c of cmds) {
    if (approvalKinds.has(c.kind)) {
      toast("Host decision received", { description: c.title });
      void get().syncNow(true);
    } else {
      toast(c.severity === "critical" ? "Host Control — critical broadcast" : "Host Control broadcast", { description: c.title });
    }
  }
}

// v23 helper: debounced cloud save piggybacked on the sync scheduler
let cloudSaveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleCloudSave(
  set: (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void,
  get: () => AppState,
) {
  const u = get().user;
  if (!u || u.source !== "registered" || !u.stateToken) return;
  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    void get().saveUserStateNow();
  }, 2500);
}

// helper: apply rule-evaluated alerts for a project after a mutation
function applyNewAlerts(
  set: (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void,
  get: () => AppState,
  p: Project | undefined,
) {
  if (!p) return;
  const s = get();
  const enabledIds = new Set(s.alertRules.filter(r => r.enabled).map(r => r.id));
  const evals = evaluateAlertRules(p, s.thresholds);
  const fresh = evals.filter(e => {
    if (e.rule.includes("Overrun >20%") && !enabledIds.has("r-overrun-20")) return false;
    if (e.rule.includes("Overrun >10%") && !enabledIds.has("r-overrun-10")) return false;
    if (e.rule.includes("Delay probability") && !enabledIds.has("r-delay-70")) return false;
    return true;
  });
  if (!fresh.length) return;
  const newAlerts: Alert[] = fresh.map(e => ({
    id: uid("al"), projectId: p.id, title: e.title, description: e.description, severity: e.severity, type: e.type,
    isRead: false, createdAt: new Date().toISOString(), recommendedAction: e.action, recommendedOwner: e.owner, recommendedDeadline: e.deadline,
    emailQueued: e.severity === "CRITICAL" && s.alertRules.find(r => r.id === "r-health-red" || r.id === "r-overrun-20")?.channel === "in-app+email",
  }));
  set(st => ({ projects: st.projects.map(pp => pp.id === p.id ? { ...pp, alerts: [...newAlerts, ...pp.alerts] } : pp) }));
  const first = newAlerts[0];
  get().pushNotification({ userId: "all", title: `🚨 New ${first.severity} alert — ${p.name.replace(/,.*$/, "")}`, message: first.title, type: "ALERT", linkView: "alerts", linkProjectId: p.id });
  const rule = s.alertRules.find(r => r.channel === "in-app+email" && r.enabled);
  if (rule && first.severity === "CRITICAL" && s.emailSettings.alertEmailsEnabled) {
    void get().queueEmail({ to: s.emailSettings.criticalTo[0] ?? "alert-critical@mospi.gov.in", toName: "MoSPI Critical Alerts", template: "critical_alert", project: { ...p, alerts: [...newAlerts, ...p.alerts] }, projectId: p.id, send: true });
  }
}

export const ROUTE_TITLES: Record<ViewId, string> = {
  monitor: "Dashboard", dashboard: "Command Centre", projects: "Projects", "project-detail": "Project Detail", analytics: "Analytics",
  "ai-assistant": "Assure Intelligence", "model-lab": "Prediction Engine", "vector-store": "Vector Store", alerts: "Early Warning Centre",
  reports: "Reports & Exports", "email-center": "Email Centre", admin: "Administration", notifications: "Notifications", audit: "Audit Trail",
  interventions: "Interventions Centre", compare: "Compare Projects", help: "Help & Guide", workflow: "Workflow — How it works",
  // v5: Simple Monitoring Suite (deep screens — hidden from v6 sidebar, still routable)
  "cost-benchmark": "Cost Benchmark", "budget-variance": "Budget Variance",
  "progress-mismatch": "Progress Mismatch", "risk-score": "Risk Scores", procurement: "Procurement Anomaly",
  "change-orders": "Change Orders", "authority-review": "Authority Review", search: "Project Search",
  // v22: Real-time tracking stack
  tracking: "Real-Time Tracking Dashboard", "geo-audit": "Geo-Tagged Site Audits", "india-map": "India Project Map",
};
