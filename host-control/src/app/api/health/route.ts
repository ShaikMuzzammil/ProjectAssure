import { NextResponse } from "next/server";
import { getStore } from "@/lib/host/store";
import { effectiveMainUrl } from "@/lib/host/sync";

export const dynamic = "force-dynamic";

// GET /api/health — public reachability probe (no session required).
export async function GET() {
  const d = getStore().data;
  return NextResponse.json({
    ok: true,
    service: "projectassure-host-control",
    version: "21.0",
    uptimeSec: Math.floor((Date.now() - Date.parse(d.startedAt)) / 1000),
    mainUrl: effectiveMainUrl(),
    mainReachable: d.sync.mainReachable, // last known state from the poll loop
    lastSyncAt: d.sync.lastSyncAt,
    mirrorStatus: d.mirror.pushedAt ? "has-snapshot" : "empty",
    time: new Date().toISOString(),
  });
}
