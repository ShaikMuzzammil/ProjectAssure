// v21: webhook receiver for main-app login events. Updates lastLoginAt + loginCount.
import { NextResponse } from "next/server";
import { recordLogin, recordWebhook } from "@/lib/host/store";
import type { UserLoginWebhookPayload } from "@/lib/host/types";

export const dynamic = "force-dynamic";

function authorised(req: Request): boolean {
  const secret = process.env.HOST_CONTROL_SECRET || process.env.WEBHOOK_SECRET;
  if (!secret) return true;
  const got = req.headers.get("x-host-secret") || req.headers.get("x-webhook-secret");
  return got === secret;
}

export async function POST(req: Request) {
  if (!authorised(req)) {
    await recordWebhook("USER_LOGIN", null, false, "unauthorised");
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  let payload: UserLoginWebhookPayload;
  try {
    payload = (await req.json()) as UserLoginWebhookPayload;
  } catch {
    await recordWebhook("USER_LOGIN", null, false, "invalid JSON");
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  if (!payload?.userId && !payload?.email) {
    await recordWebhook("USER_LOGIN", payload, false, "missing userId/email");
    return NextResponse.json({ ok: false, error: "missing userId/email" }, { status: 400 });
  }
  await recordLogin(payload);
  await recordWebhook("USER_LOGIN", payload, true, "login recorded");
  return NextResponse.json({ ok: true });
}
