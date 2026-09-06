// v21: reactivate a previously suspended user.
import { NextResponse } from "next/server";
import { reactivateUser, getState } from "@/lib/host/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id, by } = await req.json();
  const u = await reactivateUser(String(id), String(by || "CPO"));
  if (!u) return NextResponse.json({ ok: false, error: "user not found" }, { status: 404 });
  const s = await getState();
  return NextResponse.json({ ok: true, user: u, users: s.users });
}
