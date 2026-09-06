// v21: suspend a user. Sets status = SUSPENDED, isActive = false.
import { NextResponse } from "next/server";
import { suspendUser, getState } from "@/lib/host/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id, by, reason } = await req.json();
  const u = await suspendUser(String(id), String(by || "CPO"), String(reason || "no reason given"));
  if (!u) return NextResponse.json({ ok: false, error: "user not found" }, { status: 404 });
  const s = await getState();
  return NextResponse.json({ ok: true, user: u, users: s.users });
}
