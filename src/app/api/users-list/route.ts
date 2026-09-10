import { NextResponse } from "next/server";

// v23 — GET /api/users-list — public (no auth header) lightweight user list
// for the client store's boot-time sync. Returns only the fields the client
// needs to recognise a registered user and route their login through
// /api/auth/login. No password hashes, no audit logs, no sensitive data.
//
// Used by app-store.ts syncUsersFromServer() so that accounts created on
// another device (or after a localStorage clear) are visible in this
// browser's local store. Without this, login would fail for any registered
// user that wasn't created in THIS browser.
//
// In simulation mode (no DATABASE_URL) returns 503 — the client store
// falls back to the demo personas only.

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "SIMULATION_MODE" }, { status: 503 });
  }
  try {
    const { db } = await import("@/lib/db");
    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        designation: true,
        isActive: true,
        lastLoginAt: true,
        department: { select: { code: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      data: users,
      meta: { total: users.length, source: "database" },
    });
  } catch (err) {
    return NextResponse.json({ error: "DB_UNAVAILABLE", message: (err as Error).message.slice(0, 160) }, { status: 503 });
  }
}
