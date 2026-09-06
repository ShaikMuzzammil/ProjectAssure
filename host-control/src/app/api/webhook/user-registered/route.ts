// v21: webhook receiver for main-app sign-ups. Validates x-host-secret header.
// The main app POSTs here from its signUp() action with the new user payload.
import { NextResponse } from "next/server";
import { addUser, recordWebhook, getState } from "@/lib/host/store";
import type { UserRegisteredWebhookPayload } from "@/lib/host/types";

export const dynamic = "force-dynamic";

function authorised(req: Request): boolean {
  const secret = process.env.HOST_CONTROL_SECRET || process.env.WEBHOOK_SECRET;
  // In simulation mode (no secret configured), accept everything — useful for demos
  if (!secret) return true;
  const got = req.headers.get("x-host-secret") || req.headers.get("x-webhook-secret");
  return got === secret;
}

export async function POST(req: Request) {
  if (!authorised(req)) {
    await recordWebhook("USER_REGISTERED", null, false, "unauthorised — bad x-host-secret");
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  let payload: UserRegisteredWebhookPayload;
  try {
    payload = (await req.json()) as UserRegisteredWebhookPayload;
  } catch {
    await recordWebhook("USER_REGISTERED", null, false, "invalid JSON");
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  if (!payload?.email || !payload?.name) {
    await recordWebhook("USER_REGISTERED", payload, false, "missing required fields");
    return NextResponse.json({ ok: false, error: "missing email/name" }, { status: 400 });
  }
  const user = await addUser(payload, "FRESH_USER");
  await recordWebhook("USER_REGISTERED", payload, true, `ingested ${user.email}`);
  const s = await getState();
  return NextResponse.json({ ok: true, userId: user.id, usersCount: s.users.length });
}
