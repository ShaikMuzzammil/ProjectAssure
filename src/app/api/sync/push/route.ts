import { NextRequest, NextResponse } from "next/server";
import { pushSnapshot, SyncSnapshot } from "@/lib/sync/server-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/sync/push
 * The main app client (browser, same origin) pushes its portfolio snapshot here
 * after every meaningful mutation (sign-up, login, project change, alert...).
 * Optional shared secret: set SYNC_TOKEN and send it as x-sync-token.
 */
export async function POST(req: NextRequest) {
  try {
    const expected = process.env.SYNC_TOKEN;
    if (expected && req.headers.get("x-sync-token") !== expected) {
      return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
    }
    const body = (await req.json()) as SyncSnapshot;
    if (!body || typeof body !== "object" || !Array.isArray(body.users)) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }
    const saved = pushSnapshot(body);
    return NextResponse.json({
      ok: true,
      revision: saved.stats.users,
      users: saved.users.length,
      projects: saved.projects.length,
      pushedAt: saved.pushedAt,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "bad_request", detail: String(err) },
      { status: 400 }
    );
  }
}
