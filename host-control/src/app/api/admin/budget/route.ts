// v21: set per-user budget limit (in ₹ lakh).
import { NextResponse } from "next/server";
import { setUserBudget, getState } from "@/lib/host/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id, limitL, by } = await req.json();
  const n = Number(limitL);
  if (!Number.isFinite(n) || n < 0) {
    return NextResponse.json({ ok: false, error: "limitL must be a non-negative number" }, { status: 400 });
  }
  const u = await setUserBudget(String(id), n, String(by || "CPO"));
  if (!u) return NextResponse.json({ ok: false, error: "user not found" }, { status: 404 });
  const s = await getState();
  return NextResponse.json({ ok: true, user: u, users: s.users });
}
