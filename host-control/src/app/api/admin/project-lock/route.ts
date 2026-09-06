// v21: lock / unlock a project (audit-logged). Used by the Project Vault view.
import { NextResponse } from "next/server";
import { lockProject, getState } from "@/lib/host/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id, locked, by } = await req.json();
  const p = await lockProject(String(id), !!locked, String(by || "CPO"));
  if (!p) return NextResponse.json({ ok: false, error: "project not found" }, { status: 404 });
  const s = await getState();
  return NextResponse.json({ ok: true, project: p, projects: s.projects });
}
