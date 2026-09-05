import { NextResponse } from "next/server";
import { approve, getState } from "@/lib/host/store";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const { id, decision, note, by } = await req.json();
  approve(String(id), decision === "approve" ? "approve" : "reject", String(note), String(by || "CPO"));
  return NextResponse.json({ ok: true, approvals: getState().approvals });
}
