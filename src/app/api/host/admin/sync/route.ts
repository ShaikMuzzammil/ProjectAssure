import { NextResponse } from "next/server";
import { requireHost } from "@/lib/host/auth";
import { audit, getStore, nowIso, scheduleSave } from "@/lib/host/store";
import { buildHostState, mergeSnapshot, runSync } from "@/lib/host/sync";
import type { SyncSnapshot } from "@/lib/host/types";

export const dynamic = "force-dynamic";

// GET /api/admin/sync — THE live engine (called by the UI every 5s).
// 1. Server-side fetch of {MAIN}/api/sync/state (never from the browser).
// 2. Merge snapshot → approvals + automated emails.
// 3. Return the full host state.
// ?force=1 → manual force-sync (audited, bypasses the in-flight guard).
export async function GET(req: Request) {
  const gate = requireHost(req);
  if (!gate.ok) return gate.res;
  const email = gate.email;

  const force = new URL(req.url).searchParams.get("force") === "1";
  const result = await runSync(force ? "manual" : "poll", force);
  if (force && result.ran) {
    audit("sync.manual", email, `manual force-sync triggered — ${result.reachable ? "main reachable" : `unreachable (${result.error ?? "?"})`}`, result.reachable ? "info" : "warning");
    scheduleSave();
  }

  return NextResponse.json(buildHostState(email), {
    headers: { "Cache-Control": "no-store" },
  });
}

// POST /api/admin/sync — OPTIONAL webhook/push mode: the main app (or any
// trusted caller holding SYNC_TOKEN) pushes a snapshot directly. Polling
// remains the default path; this exists for deployments that prefer pushes.
export async function POST(req: Request) {
  // shared-token auth (independent of the host session cookie)
  if (process.env.SYNC_TOKEN) {
    const provided = req.headers.get("x-sync-token");
    if (provided !== process.env.SYNC_TOKEN) {
      return NextResponse.json({ ok: false, error: "invalid_sync_token" }, { status: 403 });
    }
  } else {
    // no token configured → still require a host session OR explicit opt-in
    const gate = requireHost(req);
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, error: "push_mode_requires_sync_token_or_session", hint: "set SYNC_TOKEN in host env to enable unattended main→host pushes" },
        { status: 401 },
      );
    }
  }

  let body: { snapshot?: SyncSnapshot; hub?: { revision?: number } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const snapshot = body?.snapshot;
  if (!snapshot || !Array.isArray(snapshot.users) || !Array.isArray(snapshot.projects) || !snapshot.pushedAt) {
    return NextResponse.json({ ok: false, error: "invalid_snapshot" }, { status: 422 });
  }

  const d = getStore().data;
  const merged = await mergeSnapshot(snapshot, "webhook");
  d.sync.mainReachable = true; // someone just pushed to us
  d.sync.lastSyncAt = nowIso();
  d.sync.lastOkSyncAt = nowIso();
  d.sync.lastError = null;
  if (body?.hub?.revision) d.sync.revision = body.hub.revision;
  if (merged) {
    audit("sync.webhook-received", "webhook", `snapshot pushed directly (pushedAt ${snapshot.pushedAt}) — merged`, "info");
  }
  scheduleSave();

  return NextResponse.json({ ok: true, merged, mirroredAt: d.mirror.mirroredAt });
}
