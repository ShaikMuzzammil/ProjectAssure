import { NextResponse } from "next/server";
import { syncPayload } from "@/lib/host/store";

// GET /api/admin/sync — the live portfolio snapshot the client polls every
// 5 seconds. Returns the full mirror: projects, approvals, alerts, activity,
// audit, thresholds, integration status, AI provider status, and admin persona.
//
// In production you would replace the in-memory store with a Redis/KV-backed
// poll that also fetches /api/health on the MAIN_PROJECT_URL; the contract
// below stays stable so the client does not change.
export async function GET() {
  return NextResponse.json(syncPayload());
}

// POST /api/admin/sync — inbound webhook the MAIN ProjectAssure can call to
// push fresh events into the host-control mirror (e.g. a new alert fired, a
// milestone slipped, an approval was raised). Optional WEBHOOK_SECRET guard.
export async function POST(req: Request) {
  const secret = req.headers.get("x-webhook-secret");
  if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "invalid_secret" }, { status: 401 });
  }
  let payload: any;
  try { payload = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  // For the in-memory demo we just acknowledge — a real impl would upsert the
  // payload's projects/alerts/approvals into the store.
  return NextResponse.json({ ok: true, received: Object.keys(payload ?? {}).length, at: new Date().toISOString() });
}
