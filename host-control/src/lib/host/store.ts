// ═══════════════════════════════════════════════════════════════════════════
// Host Control store — server-side singleton, in-RAM + JSON file persistence.
//
// · Lives on globalThis so Next.js dev hot-reload keeps one instance.
// · Persists to `.host-store.json` in the project root (local dev survives
//   restarts). Persistence is skipped entirely on Vercel (read-only FS) —
//   there the store lives in memory for the life of the lambda instance.
// · No DATABASE_URL required at runtime.
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

const STORE_VERSION = 21;
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
  if (IS_VERCEL) return {}; // read-only FS — always start fresh
  try {
    if (!fs.existsSync(PERSIST_PATH)) return {};
    const raw = fs.readFileSync(PERSIST_PATH, "utf8");
    const parsed = JSON.parse(raw) as { version?: number; data?: Partial<PersistedData> };
    if (parsed.version !== STORE_VERSION || !parsed.data) return {};
    return parsed.data;
  } catch {
    return {}; // corrupt file → fresh start, never crash the server
  }
}

const g = globalThis as unknown as { __projectassureHostStore?: StoreController };

export function getStore(): StoreController {
  if (!g.__projectassureHostStore) {
    g.__projectassureHostStore = {
      data: { ...freshData(), ...loadPersisted() },
      lockouts: {},
      loginAuditCount: 0,
      saveTimer: null,
      dirty: false,
    };
  }
  return g.__projectassureHostStore;
}

// ── Persistence ─────────────────────────────────────────────────────────────

export function scheduleSave(): void {
  if (IS_VERCEL) return;
  const ctl = getStore();
  ctl.dirty = true;
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
  if (IS_VERCEL) return;
  const ctl = getStore();
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
