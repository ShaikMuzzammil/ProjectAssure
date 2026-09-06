// v21: add a private admin note on a user (visible in the slide-over detail panel).
import { NextResponse } from "next/server";
import { addNote, getState } from "@/lib/host/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id, body, by } = await req.json();
  if (!id || !body) return NextResponse.json({ ok: false, error: "missing id/body" }, { status: 400 });
  const u = await addNote(String(id), String(body), String(by || "CPO"));
  if (!u) return NextResponse.json({ ok: false, error: "user not found" }, { status: 404 });
  const s = await getState();
  return NextResponse.json({ ok: true, user: u, users: s.users });
}
