// v21: get a single user's detail (their projects, alerts, audit, emails).
import { NextResponse } from "next/server";
import { getUserDetail } from "@/lib/host/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getUserDetail(id);
  if (!detail) return NextResponse.json({ ok: false, error: "user not found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...detail });
}
