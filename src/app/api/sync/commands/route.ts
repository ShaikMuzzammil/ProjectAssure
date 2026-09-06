import { NextRequest, NextResponse } from "next/server";
import { pendingCommands, markDelivered, hubHealth } from "@/lib/sync/server-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/sync/commands?client=<userId>&since=<iso>
 * Logged-in main-app browsers poll this every ~20s to receive Host Control
 * broadcasts, user alerts and sync requests, then apply them locally.
 */
export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("client") || "anonymous";
  const since = req.nextUrl.searchParams.get("since") || undefined;
  const pending = pendingCommands(clientId, since);
  if (pending.length > 0 && clientId !== "anonymous") {
    markDelivered(pending.map((p) => p.id), clientId);
  }
  const res = NextResponse.json({
    ok: true,
    commands: pending,
    hub: hubHealth(),
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
