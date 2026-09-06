import { NextResponse } from "next/server";
import { clearCookieHeader, getSession } from "@/lib/host/auth";
import { audit, saveNow } from "@/lib/host/store";

export const dynamic = "force-dynamic";

// POST /api/auth/logout — clears the session cookie + audits.
export async function POST(req: Request) {
  const session = getSession(req);
  if (session.ok && session.email) {
    audit("auth.logout", session.email, "host administrator signed out", "info");
    saveNow();
  }
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearCookieHeader());
  return res;
}
