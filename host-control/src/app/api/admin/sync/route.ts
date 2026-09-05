import { NextResponse } from "next/server";
import { getState, getSnapshot } from "@/lib/host/store";
export const dynamic = "force-dynamic";
export async function GET() {
  const s = getState();
  return NextResponse.json({
    snapshot: getSnapshot(),
    users: s.users, projects: s.projects, approvals: s.approvals, alerts: s.alerts, audit: s.audit, activity: s.activity,
    thresholds: s.thresholds, integration: s.integration,
    generatedAt: new Date().toISOString(),
  });
}
