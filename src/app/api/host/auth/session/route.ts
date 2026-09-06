import { NextResponse } from "next/server";
import { adminEmail, getSession } from "@/lib/host/auth";

export const dynamic = "force-dynamic";

// GET /api/auth/session — lightweight session probe for the client gate.
export async function GET(req: Request) {
  const session = getSession(req);
  if (session.ok && session.email) {
    return NextResponse.json({ ok: true, email: session.email, adminEmail: adminEmail() });
  }
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}
