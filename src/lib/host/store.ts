// ═══════════════════════════════════════════════════════════════════════════
// Host Control store — server-side singleton.
//
// · Lives on globalThis so Next.js dev hot-reload keeps one instance.
// · Persistence chain (first that applies):
//     1. DATABASE_URL → HostState row (survives Vercel cold starts)
//     2. .host-store.json local file (dev restarts)
//     3. in-memory only
// · IP lockouts are deliberately RUNTIME-ONLY (never persisted).
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  AccessRecord,
  ApprovalItem,
  BroadcastRecord,
  EmailLogEntry,
  HostAuditEntry,
  HostSettings,
  LoginFeedEntry,
  SyncAlert,
  SyncEmail,
  SyncEvent,
  SyncProject,
  SyncSnapshot,
  SyncUser,
} from "./types";

const STORE_VERSION = 23;
const PERSIST_PATH = path.join(process.cwd(), ".host-store.json");
const IS_VERCEL = process.env.VERCEL === "1" || Boolean(process.env.VERCEL);

const AUDIT_CAP = 600;
const OUTBOX_CAP = 400;
const BROADCAST_CAP = 80;
const APPROVAL_CAP = 200;

const MIRROR_CAPS = {
  events: 300,
  loginFeed: 400,
  alerts: 300,
  emails: 200,
  users: 500,
  projects: 500,
};

export interface PersistedData {
  version: number;
  startedAt: string;
  sync: {
    mainReachable: boolean;
    lastSyncAt: string | null;
    lastOkSyncAt: string | null;
    lastError: string | null;
    revision: number;
    lastPushAt: string | null;
    lastWebhookAt: string | null;
    commandCount: number;
    pollCount: number;
  };
  mirror: {
    pushedAt: string | null;
    mirroredAt: string | null;
    stats: SyncSnapshot["stats"] | null;
    users: SyncUser[];
    projects: SyncProject[];
    alerts: SyncAlert[];
    events: SyncEvent[];
    loginFeed: LoginFeedEntry[];
    emails: SyncEmail[];
  };
  /** true once the first successful merge happened — everything seen before
   *  it is baseline (no approvals / auto-emails) so only REAL new items surface. */
  baselineDone: boolean;
  seenProjectIds: string[];
  seenUserIds: string[];
  /** v23: approval request ids already turned into ApprovalItems (dedupe). */
  approvalRequests: string[];
  approvals: ApprovalItem[];
  budgetBreached: Record<string, boolean>;
  emailDedupe: {
    loginFeed: Record<string, string>; // loginId → emailed-at ISO
    welcomed: Record<string, string>; // userId → welcomed-at ISO
    budget: Record<string, string>; // projectId → emailed-at ISO
  };
  access: Record<string, AccessRecord>;
  broadcasts: BroadcastRecord[];
  outbox: EmailLogEntry[];
  settings: HostSettings;
  audit: HostAuditEntry[];
}

export interface LockoutState {
  fails: number;
  lockedUntil?: string;
  lastFailAt: string;
}

interface StoreController {
  data: PersistedData;
  lockouts: Record<string, LockoutState>; // runtime-only
  loginAuditCount: number;
  saveTimer: ReturnType<typeof setTimeout> | null;
  dirty: boolean;
}

function freshData(): PersistedData {
  return {
    version: STORE_VERSION,
    startedAt: new Date().toISOString(),
    sync: {
      mainReachable: false,
      lastSyncAt: null,
      lastOkSyncAt: null,
      lastError: null,
      revision: 0,
      lastPushAt: null,
      lastWebhookAt: null,
      commandCount: 0,
      pollCount: 0,
    },
    mirror: {
      pushedAt: null,
      mirroredAt: null,
      stats: null,
      users: [],
      projects: [],
      alerts: [],
      events: [],
      loginFeed: [],
      emails: [],
    },
    baselineDone: false,
    seenProjectIds: [],
    seenUserIds: [],
    approvalRequests: [],
    approvals: [],
    budgetBreached: {},
    emailDedupe: { loginFeed: {}, welcomed: {}, budget: {} },
    access: {},
    broadcasts: [],
    outbox: [],
    settings: {
      loginAlerts: true,
      budgetAlerts: true,
      budgetThresholdPct: 20,
      mainUrlOverride: null,
    },
    audit: [],
  };
}

function loadPersisted(): Partial<PersistedData> {
  try {
    if (fs.existsSync(PERSIST_PATH)) {
      const raw = fs.readFileSync(PERSIST_PATH, "utf8");
      const parsed = JSON.parse(raw) as { version?: number; data?: Partial<PersistedData> };
      if (parsed.version === STORE_VERSION && parsed.data) return parsed.data;
    }
  } catch {
    // corrupt file → fresh start, never crash the server
  }
  return {};
}

// ── v23: database persistence (survives serverless cold starts) ────────────

const gwPersist = globalThis as unknown as { __hostStoreDbLoaded?: boolean; __hostStoreDbTimer?: ReturnType<typeof setTimeout> | null };

async function loadFromDb(): Promise<Partial<PersistedData>> {
  if (!process.env.DATABASE_URL || gwPersist.__hostStoreDbLoaded) return {};
  gwPersist.__hostStoreDbLoaded = true;
  try {
    const prisma = await getHostPrisma();
    const row = await prisma.hostState.findUnique({ where: { id: "singleton-embedded" } });
    if (row?.stateJson) {
      const parsed = JSON.parse(row.stateJson) as Partial<PersistedData>;
      if (parsed && Array.isArray(parsed.approvals)) return parsed;
    }
  } catch {
    /* database unavailable — file/memory mode */
  }
  return {};
}

/** One shared, lazily-created Prisma client for the host store. */
interface HostPrismaShape {
  hostState: {
    findUnique: (args: unknown) => Promise<{ stateJson: string } | null>;
    upsert: (args: unknown) => Promise<unknown>;
  };
  $disconnect?: () => Promise<void>;
}

async function getHostPrisma(): Promise<HostPrismaShape> {
  const gwp = globalThis as unknown as { __hostPrisma?: HostPrismaShape };
  if (gwp.__hostPrisma) return gwp.__hostPrisma;
  const mod = (await import("@prisma/client")) as unknown as { PrismaClient: new () => unknown };
  const prisma = new mod.PrismaClient() as HostPrismaShape;
  gwp.__hostPrisma = prisma;
  return prisma;
}

async function saveToDb(ctl: StoreController): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const prisma = await getHostPrisma();
    await prisma.hostState.upsert({
      where: { id: "singleton" },
      update: { stateJson: JSON.stringify(ctl.data), updatedAt: new Date() },
      create: { id: "singleton-embedded", stateJson: JSON.stringify(ctl.data) },
    });
  } catch {
    /* best-effort — never crash a request */
  }
}

function scheduleDbSave(ctl: StoreController): void {
  if (!process.env.DATABASE_URL) return;
  if (gwPersist.__hostStoreDbTimer) return;
  gwPersist.__hostStoreDbTimer = setTimeout(() => {
    gwPersist.__hostStoreDbTimer = null;
    void saveToDb(ctl);
  }, 1000);
}

const g = globalThis as unknown as { __projectassureHostStore?: StoreController };

export function getStore(): StoreController {
  if (!g.__projectassureHostStore) {
    const ctl: StoreController = {
      data: { ...freshData(), ...loadPersisted() },
      lockouts: {},
      loginAuditCount: 0,
      saveTimer: null,
      dirty: false,
    };
    g.__projectassureHostStore = ctl;
    // v23: hydrate from the database (async — the first poll serves file/
    // memory data, then the DB overlay lands a moment later)
    void loadFromDb().then(dbData => {
      if (dbData && Object.keys(dbData).length) {
        ctl.data = { ...ctl.data, ...dbData };
      }
    });
  }
  return g.__projectassureHostStore;
}

// ── Persistence ─────────────────────────────────────────────────────────────

export function scheduleSave(): void {
  const ctl = getStore();
  ctl.dirty = true;
  scheduleDbSave(ctl);
  if (IS_VERCEL) return; // read-only FS — DB persistence carries it instead
  if (ctl.saveTimer) return;
  ctl.saveTimer = setTimeout(() => {
    ctl.saveTimer = null;
    if (!ctl.dirty) return;
    ctl.dirty = false;
    try {
      fs.writeFileSync(
        PERSIST_PATH,
        JSON.stringify({ version: STORE_VERSION, savedAt: new Date().toISOString(), data: ctl.data }),
        "utf8",
      );
    } catch {
      // best-effort local persistence — never crash a request
    }
  }, 1200);
}

export function saveNow(): void {
  const ctl = getStore();
  void saveToDb(ctl);
  if (IS_VERCEL) return;
  if (ctl.saveTimer) {
    clearTimeout(ctl.saveTimer);
    ctl.saveTimer = null;
  }
  try {
    fs.writeFileSync(
      PERSIST_PATH,
      JSON.stringify({ version: STORE_VERSION, savedAt: new Date().toISOString(), data: ctl.data }),
      "utf8",
    );
  } catch {
    /* best-effort */
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Append an audit entry (append-only). Actor: admin email, "system" or "webhook". */
export function audit(
  action: string,
  actor: string,
  detail?: string,
  severity: HostAuditEntry["severity"] = "info",
): HostAuditEntry {
  const ctl = getStore();
  const entry: HostAuditEntry = { id: newId(), at: nowIso(), actor, action, detail, severity };
  ctl.data.audit.unshift(entry);
  if (ctl.data.audit.length > AUDIT_CAP) ctl.data.audit.length = AUDIT_CAP;
  scheduleSave();
  return entry;
}

export function addOutboxEntry(entry: EmailLogEntry): void {
  const ctl = getStore();
  ctl.data.outbox.unshift(entry);
  if (ctl.data.outbox.length > OUTBOX_CAP) ctl.data.outbox.length = OUTBOX_CAP;
  scheduleSave();
}

export function addBroadcastRecord(record: BroadcastRecord): void {
  const ctl = getStore();
  ctl.data.broadcasts.unshift(record);
  if (ctl.data.broadcasts.length > BROADCAST_CAP) ctl.data.broadcasts.length = BROADCAST_CAP;
  scheduleSave();
}

export function upsertAccess(record: AccessRecord): void {
  const ctl = getStore();
  ctl.data.access[record.userId] = record;
  scheduleSave();
}

export function addApproval(item: ApprovalItem): void {
  const ctl = getStore();
  ctl.data.approvals.unshift(item);
  if (ctl.data.approvals.length > APPROVAL_CAP) ctl.data.approvals.length = APPROVAL_CAP;
  scheduleSave();
}

export function capArray<T>(arr: T[], cap: number): T[] {
  if (arr.length <= cap) return arr;
  return arr.slice(0, cap);
}

export const MIRROR_CAP = MIRROR_CAPS;
