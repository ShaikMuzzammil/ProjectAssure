// v21: approve / reject a change order. Logs an audit entry + activity event.
import { NextResponse } from "next/server";
import { approve, getState } from "@/lib/host/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id, decision, note, by } = await req.json();
  await approve(String(id), decision === "approve" ? "approve" : "reject", String(note), String(by || "CPO"));
  const s = await getState();
  return NextResponse.json({ ok: true, approvals: s.approvals, audit: s.audit.slice(0, 30) });
}
