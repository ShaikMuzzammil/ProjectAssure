/**
 * ProjectAssure Sync Hub (server side)
 * ------------------------------------
 * A single server-side mirror of the client portfolio that the Host Control
 * platform can read (GET /api/sync/state) and command (webhook + command queue).
 *
 * Storage strategy (in order of preference, all optional):
 *   1. In-memory singleton          — always available, per-instance
 *   2. JSON file (.sync-store.json)  — local dev persistence across restarts
 *
 * The main app client pushes snapshots here (POST /api/sync/push, same origin,
 * no CORS). Host-control reads state and writes commands server-to-server.
 * Logged-in browsers poll GET /api/sync/commands to receive host broadcasts.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

import type {
  SyncUser, SyncProject, SyncAlert, SyncEvent, SyncEmail, SyncSnapshot, SyncCommand,
} from "./types";

export type { SyncUser, SyncProject, SyncAlert, SyncEvent, SyncEmail, SyncSnapshot, SyncCommand };

interface HubState {
  snapshot: SyncSnapshot | null;
  commands: SyncCommand[];
  lastPushAt: string | null;
  lastWebhookAt: string | null;
  revision: number;
}

const MAX_COMMANDS = 200;
const MAX_LOGIN_FEED = 60;

let state: HubState = {
  snapshot: null,
  commands: [],
  lastPushAt: null,
  lastWebhookAt: null,
  revision: 0,
};

const storePath = path.join(process.cwd(), ".sync-store.json");

function loadFromFile() {
  try {
    if (existsSync(storePath)) {
      const raw = JSON.parse(readFileSync(storePath, "utf-8"));
      state = { ...state, ...raw };
    }
  } catch {
    /* ignore corrupt file */
  }
}

function persistToFile() {
  try {
    if (process.env.VERCEL) return;
    mkdirSync(path.dirname(storePath), { recursive: true });
    writeFileSync(storePath, JSON.stringify(state));
  } catch {
    /* best effort */
  }
}

loadFromFile();

export function pushSnapshot(snapshot: SyncSnapshot): SyncSnapshot {
  if (snapshot.loginFeed && snapshot.loginFeed.length > MAX_LOGIN_FEED) {
    snapshot.loginFeed = snapshot.loginFeed.slice(0, MAX_LOGIN_FEED);
  }
  state.snapshot = snapshot;
  state.lastPushAt = new Date().toISOString();
  state.revision += 1;
  persistToFile();
  return snapshot;
}

export function getSnapshot(): SyncSnapshot | null {
  return state.snapshot;
}

export function getState() {
  return {
    ...state,
    commands: undefined,
    snapshot: state.snapshot
      ? {
          stats: state.snapshot.stats,
          pushedAt: state.snapshot.pushedAt,
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
  persistToFile();
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
  persistToFile();
}

export function hubHealth() {
  return {
    ok: true,
    service: "projectassure-sync-hub",
    version: "v21",
    revision: state.revision,
    lastPushAt: state.lastPushAt,
    lastWebhookAt: state.lastWebhookAt,
    hasSnapshot: Boolean(state.snapshot),
    commandCount: state.commands.length,
    time: new Date().toISOString(),
  };
}
