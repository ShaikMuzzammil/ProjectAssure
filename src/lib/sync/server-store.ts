/**
 * ProjectAssure Sync Hub (server side)
 * ------------------------------------
 * A server-side mirror that the Host Control platform reads
 * (GET /api/sync/state) and commands (webhook + command queue).
 *
 * Storage strategy (all optional, automatic):
 *   1. DATABASE (SyncHubState row)     — survives serverless cold starts,
 *      keeps a MERGED directory of every user/project ever pushed so the
 *      host sees the full portfolio while each main-app user stays isolated.
 *   2. JSON file (.sync-store.json)    — local dev persistence across restarts
 *   3. In-memory singleton             — always available, per-instance
 *
 * The main app client pushes snapshots (POST /api/sync/push, same origin).
 * Host-control reads state and writes commands server-to-server.
 * Logged-in browsers poll GET /api/sync/commands to receive host decisions.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

import type {
  SyncUser, SyncProject, SyncAlert, SyncEvent, SyncEmail, SyncSnapshot, SyncCommand,
} from "./types";

export type { SyncUser, SyncProject, SyncAlert, SyncEvent, SyncEmail, SyncSnapshot, SyncCommand };

interface HubState {
  /** merged directory of all users ever pushed (keyed by id) */
  users: SyncUser[];
  /** merged directory of all projects ever pushed (keyed by id) */
  projects: SyncProject[];
  alerts: SyncAlert[];
  events: SyncEvent[];
  emails: SyncEmail[];
  loginFeed: { id: string; userId: string; userName: string; at: string; ip?: string }[];
  lastSnapshot: SyncSnapshot | null;
  commands: SyncCommand[];
  lastPushAt: string | null;
  lastWebhookAt: string | null;
  revision: number;
}

const MAX_COMMANDS = 200;
const MAX_LOGIN_FEED = 60;
const MAX_USERS = 500;
const MAX_PROJECTS = 500;
const MAX_ALERTS = 300;
const MAX_EVENTS = 300;
const MAX_EMAILS = 200;

let state: HubState = {
  users: [],
  projects: [],
  alerts: [],
  events: [],
  emails: [],
  loginFeed: [],
  lastSnapshot: null,
  commands: [],
  lastPushAt: null,
  lastWebhookAt: null,
  revision: 0,
};

const storePath = path.join(process.cwd(), ".sync-store.json");
let dbLoaded = false;
let dbSaveTimer: ReturnType<typeof setTimeout> | null = null;

// ── database persistence (optional, automatic) ─────────────────────────────

async function loadFromDb() {
  if (dbLoaded || !process.env.DATABASE_URL) return;
  dbLoaded = true;
  try {
    const mod = await import("@/lib/db");
    const db = mod.db as unknown as { syncHubState: { findUnique: (args: unknown) => Promise<{ snapshotJson: string | null; commandsJson: string; revision: number; lastPushAt: Date | null; lastWebhookAt: Date | null } | null> } };
    const row = await db.syncHubState.findUnique({ where: { id: "singleton" } });
    if (row) {
      const saved = JSON.parse(row.snapshotJson ?? "null") as HubState | null;
      if (saved && Array.isArray(saved.users)) {
        state = { ...state, ...saved, commands: [] };
      }
      try {
        const cmds = JSON.parse(row.commandsJson || "[]") as SyncCommand[];
        if (Array.isArray(cmds)) state.commands = cmds.slice(0, MAX_COMMANDS);
      } catch { /* ignore */ }
      state.revision = Math.max(state.revision, row.revision ?? 0);
      state.lastPushAt = row.lastPushAt?.toISOString() ?? state.lastPushAt;
      state.lastWebhookAt = row.lastWebhookAt?.toISOString() ?? state.lastWebhookAt;
    }
  } catch {
    /* database unavailable — stay in memory/file mode */
  }
}

async function saveToDb() {
  if (!process.env.DATABASE_URL) return;
  try {
    const mod = await import("@/lib/db");
    const db = mod.db as unknown as { syncHubState: { upsert: (args: unknown) => Promise<unknown> } };
    await db.syncHubState.upsert({
      where: { id: "singleton" },
      update: {
        snapshotJson: JSON.stringify({
          users: state.users, projects: state.projects, alerts: state.alerts, events: state.events,
          emails: state.emails, loginFeed: state.loginFeed, lastSnapshot: state.lastSnapshot,
          lastPushAt: state.lastPushAt, lastWebhookAt: state.lastWebhookAt,
        }),
        commandsJson: JSON.stringify(state.commands.slice(0, MAX_COMMANDS)),
        revision: state.revision,
        lastPushAt: state.lastPushAt ? new Date(state.lastPushAt) : null,
        lastWebhookAt: state.lastWebhookAt ? new Date(state.lastWebhookAt) : null,
      },
      create: {
        id: "singleton",
        snapshotJson: JSON.stringify({
          users: state.users, projects: state.projects, alerts: state.alerts, events: state.events,
          emails: state.emails, loginFeed: state.loginFeed, lastSnapshot: state.lastSnapshot,
          lastPushAt: state.lastPushAt, lastWebhookAt: state.lastWebhookAt,
        }),
        commandsJson: JSON.stringify(state.commands.slice(0, MAX_COMMANDS)),
        revision: state.revision,
        lastPushAt: state.lastPushAt ? new Date(state.lastPushAt) : null,
        lastWebhookAt: state.lastWebhookAt ? new Date(state.lastWebhookAt) : null,
      },
    });
  } catch {
    /* database unavailable — file/memory mode still works */
  }
}

function scheduleDbSave() {
  if (!process.env.DATABASE_URL) return;
  if (dbSaveTimer) clearTimeout(dbSaveTimer);
  dbSaveTimer = setTimeout(() => { void saveToDb(); }, 800);
}

// ── local file persistence (dev) ───────────────────────────────────────────

function loadFromFile() {
  if (process.env.VERCEL) return; // serverless FS is read-only
  try {
    if (existsSync(storePath)) {
      const raw = JSON.parse(readFileSync(storePath, "utf-8"));
      const merged = { ...state, ...raw };
      state = merged;
    }
  } catch {
    /* ignore corrupt file */
  }
}

function persistToFile() {
  try {
    if (process.env.VERCEL) return;
    mkdirSync(path.dirname(storePath), { recursive: true });
    writeFileSync(storePath, JSON.stringify({
      users: state.users, projects: state.projects, alerts: state.alerts, events: state.events,
      emails: state.emails, loginFeed: state.loginFeed, lastSnapshot: state.lastSnapshot,
      commands: state.commands, lastPushAt: state.lastPushAt, lastWebhookAt: state.lastWebhookAt,
      revision: state.revision,
    }));
  } catch {
    /* best effort */
  }
}

function persist() {
  persistToFile();
  scheduleDbSave();
}

loadFromFile();
void loadFromDb();

// ── snapshot merge: per-user isolation in the app, full directory for host ──

function mergeById<T extends { id: string }>(existing: T[], incoming: T[], cap: number): T[] {
  const map = new Map(existing.map((x) => [x.id, x]));
  for (const item of incoming) map.set(item.id, item);
  return Array.from(map.values()).slice(-cap);
}

export function pushSnapshot(snapshot: SyncSnapshot): SyncSnapshot {
  if (snapshot.loginFeed && snapshot.loginFeed.length > MAX_LOGIN_FEED) {
    snapshot.loginFeed = snapshot.loginFeed.slice(0, MAX_LOGIN_FEED);
  }
  // merge users + projects (each push carries the ACTIVE user's world; the
  // hub keeps the union so Host Control sees the entire portfolio)
  state.users = mergeById(state.users, snapshot.users ?? [], MAX_USERS);
  state.projects = mergeById(state.projects, snapshot.projects ?? [], MAX_PROJECTS);
  state.alerts = snapshot.alerts ?? state.alerts;
  state.events = snapshot.events ?? state.events;
  state.emails = snapshot.emails ?? state.emails;
  state.loginFeed = snapshot.loginFeed ?? state.loginFeed;
  state.lastSnapshot = snapshot;
  state.lastPushAt = new Date().toISOString();
  state.revision += 1;
  persist();
  return snapshot;
}

export function getSnapshot(): SyncSnapshot | null {
  return state.lastSnapshot;
}

/** Full view for Host Control: merged directory + aggregate stats. */
export function getHostSnapshot(): SyncSnapshot | null {
  if (!state.lastSnapshot && state.projects.length === 0 && state.users.length === 0) return null;
  const base = state.lastSnapshot;
  const projects = state.projects;
  const active = projects.filter((p) => p.status === "ACTIVE" || p.status === "ON_HOLD");
  const critical = projects.filter((p) => p.health < 40);
  return {
    pushedAt: state.lastPushAt ?? base?.pushedAt ?? new Date().toISOString(),
    stats: {
      users: state.users.length,
      registeredUsers: state.users.filter((u) => u.source === "registered").length,
      demoUsers: state.users.filter((u) => u.source === "demo").length,
      projects: projects.length,
      activeProjects: active.length,
      criticalProjects: critical.length,
      openAlerts: state.alerts.filter((a) => a.status === "open").length,
      budgetTotalCr: projects.reduce((n, p) => n + (p.budgetTotalCr || 0), 0),
      budgetSpentCr: projects.reduce((n, p) => n + (p.budgetSpentCr || 0), 0),
      avgHealth: projects.length ? Math.round(projects.reduce((n, p) => n + p.health, 0) / projects.length) : 0,
    },
    users: state.users.slice(0, MAX_USERS),
    projects: projects.slice(0, MAX_PROJECTS),
    alerts: state.alerts.slice(0, MAX_ALERTS),
    events: state.events.slice(0, MAX_EVENTS),
    emails: state.emails.slice(0, MAX_EMAILS),
    loginFeed: state.loginFeed.slice(0, MAX_LOGIN_FEED),
    approvalRequests: base?.approvalRequests ?? [],
  };
}

export function getState() {
  return {
    ...state,
    commands: undefined,
    snapshot: state.lastSnapshot
      ? {
          stats: state.lastSnapshot.stats,
          pushedAt: state.lastSnapshot.pushedAt,
        }
      : null,
  };
}

export function addCommand(input: Omit<SyncCommand, "id" | "createdAt" | "deliveredTo">): SyncCommand {
  const command: SyncCommand = {
    ...input,
    id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    deliveredTo: [],
  };
  state.commands.unshift(command);
  if (state.commands.length > MAX_COMMANDS) state.commands.length = MAX_COMMANDS;
  state.lastWebhookAt = new Date().toISOString();
  state.revision += 1;
  persist();
  return command;
}

/** Returns commands not yet delivered to a given client, optionally only for an audience. */
export function pendingCommands(clientId: string, sinceIso?: string): SyncCommand[] {
  const since = sinceIso ? new Date(sinceIso).getTime() : 0;
  return state.commands.filter(
    (c) =>
      new Date(c.createdAt).getTime() > since &&
      !c.deliveredTo.includes(clientId) &&
      (c.audience === "all" || c.audience === clientId)
  );
}

export function markDelivered(commandIds: string[], clientId: string) {
  for (const c of state.commands) {
    if (commandIds.includes(c.id) && !c.deliveredTo.includes(clientId)) {
      c.deliveredTo.push(clientId);
    }
  }
  persist();
}

export function hubHealth() {
  return {
    ok: true,
    service: "projectassure-sync-hub",
    version: "v23",
    revision: state.revision,
    lastPushAt: state.lastPushAt,
    lastWebhookAt: state.lastWebhookAt,
    hasSnapshot: Boolean(state.lastSnapshot),
    commandCount: state.commands.length,
    time: new Date().toISOString(),
  };
}
