// v21: force-sync endpoint — used by the AppShell "Force Sync" button.
// Pings the main app's /api/health (if MAIN_PROJECT_URL configured) and
// records the result. The actual user ingestion still happens via webhooks,
// but this route gives the admin a "manual refresh" affordance.
import { NextResponse } from "next/server";
import { getState, setIntegration, recordSync } from "@/lib/host/store";

export const dynamic = "force-dynamic";

export async function POST() {
  const url = process.env.MAIN_PROJECT_URL || process.env.NEXT_PUBLIC_MAIN_PROJECT_URL;
  let reachable = false;
  let note = "no MAIN_PROJECT_URL configured";
  if (url) {
    try {
      const res = await fetch(`${url.replace(/\/$/, "")}/api/health`, { cache: "no-store" });
      reachable = res.ok;
      note = reachable ? `OK · ${url}` : `status ${res.status}`;
    } catch (err) {
      note = `error: ${(err as Error).message}`;
    }
  }
  await setIntegration({ mainProjectReachable: reachable, lastHealthCheck: new Date().toISOString() });
  const s = await getState();
  await recordSync(s.users.length + s.projects.length, reachable, note);
  return NextResponse.json({ ok: true, reachable, note, integration: s.integration });
}

export async function GET() {
  return POST();
}
