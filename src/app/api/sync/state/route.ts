import { NextRequest, NextResponse } from "next/server";
import { getSnapshot, hubHealth } from "@/lib/sync/server-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/sync/state
 * The Host Control platform (server-to-server) reads the live main-app mirror
 * from here. CORS is open for the host deployment origin when HOST_ORIGIN is
 * set; server-to-server fetches are unaffected by CORS anyway.
 */
export async function GET(req: NextRequest) {
  const token = process.env.SYNC_TOKEN;
  if (token && req.headers.get("x-sync-token") !== token && req.nextUrl.searchParams.get("token") !== token) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }
  const snapshot = getSnapshot();
  const origin = process.env.HOST_ORIGIN || "*";
  const res = NextResponse.json({
    ok: true,
    hub: hubHealth(),
    snapshot,
  });
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Access-Control-Allow-Origin", process.env.HOST_ORIGIN || "*");
  res.headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type,x-sync-token");
  return res;
}
