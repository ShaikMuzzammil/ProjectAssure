import { NextResponse } from "next/server";
import { broadcastAlert, getState } from "@/lib/host/store";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const { title, message, severity, by } = await req.json();
  broadcastAlert(String(title), String(message), severity || "HIGH", String(by || "CPO"));
  return NextResponse.json({ ok: true, alerts: getState().alerts });
}
