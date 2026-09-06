// v21: admin manually creates a user directly in the host-control plane.
import { NextResponse } from "next/server";
import { addManualUser, getState } from "@/lib/host/store";
import type { UserRole } from "@/lib/host/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { name, email, role, designation, department, by } = await req.json();
  if (!name || !email) return NextResponse.json({ ok: false, error: "missing name/email" }, { status: 400 });
  const u = await addManualUser({
    name: String(name),
    email: String(email),
    role: (role as UserRole) || "VIEWER",
    designation: String(designation || "—"),
    department: String(department || "—"),
    by: String(by || "CPO"),
  });
  const s = await getState();
  return NextResponse.json({ ok: true, user: u, users: s.users });
}
