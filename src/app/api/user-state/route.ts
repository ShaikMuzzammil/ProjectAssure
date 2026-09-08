import { NextRequest, NextResponse } from "next/server";
import { verifyStateToken } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// /api/user-state — universal per-user workspace persistence.
//   GET  → { snapshot } for the token's user (hydrate after login)
//   PUT  → save the user's snapshot (projects, notifications, emails, …)
// Auth: x-user-token (HMAC state token issued at register/login).
// Storage: UserState row keyed by userId — each account is fully isolated.
// Without DATABASE_URL the route answers 503 SIMULATION_MODE and the app
// keeps persisting privately in the browser.
// ═══════════════════════════════════════════════════════════════════════════

const MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024; // 4 MB safety cap

function unauthorized() {
  return NextResponse.json({ ok: false, error: "AUTH_REQUIRED", message: "A valid x-user-token is required." }, { status: 401 });
}

function simulation() {
  return NextResponse.json({ ok: false, error: "SIMULATION_MODE", message: "No DATABASE_URL — the workspace persists in this browser only." }, { status: 503 });
}

export async function GET(req: NextRequest) {
  const payload = verifyStateToken(req.headers.get("x-user-token"));
  if (!payload) return unauthorized();
  if (!process.env.DATABASE_URL) return simulation();

  try {
    const { db } = await import("@/lib/db");
    const row = await db.userState.findUnique({ where: { userId: payload.userId } });
    if (!row) return NextResponse.json({ ok: true, snapshot: null, updatedAt: null });
    let snapshot: unknown = null;
    try { snapshot = JSON.parse(row.snapshotJson); } catch { snapshot = null; }
    return NextResponse.json({ ok: true, snapshot, updatedAt: row.updatedAt });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "DB_UNAVAILABLE", message: String(err).slice(0, 160) }, { status: 503 });
  }
}

export async function PUT(req: NextRequest) {
  const payload = verifyStateToken(req.headers.get("x-user-token"));
  if (!payload) return unauthorized();
  if (!process.env.DATABASE_URL) return simulation();

  let snapshotJson: string;
  try {
    const body = await req.json();
    const raw = JSON.stringify(body?.snapshot ?? {});
    if (raw.length > MAX_SNAPSHOT_BYTES) {
      return NextResponse.json({ ok: false, error: "SNAPSHOT_TOO_LARGE", message: "Workspace snapshot exceeds the 4 MB cap." }, { status: 413 });
    }
    snapshotJson = raw;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  try {
    const { db } = await import("@/lib/db");
    await db.userState.upsert({
      where: { userId: payload.userId },
      update: { snapshotJson, email: payload.email },
      create: { userId: payload.userId, email: payload.email, snapshotJson },
    });
    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "DB_UNAVAILABLE", message: String(err).slice(0, 160) }, { status: 503 });
  }
}
