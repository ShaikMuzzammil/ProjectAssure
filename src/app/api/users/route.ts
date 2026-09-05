import { NextResponse } from "next/server";

// /api/users — connected-mode user management (ADMIN only).
// GET: list users · POST: create user (scrypt hash). Simulation mode returns
// 503 and the client store handles users locally with the same rules.

async function requireAdmin(req: Request): Promise<boolean> {
  const header = req.headers.get("x-user-role") ?? "";
  return header === "ADMIN";
}

export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "AUTH_FORBIDDEN" }, { status: 403 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "SIMULATION_MODE" }, { status: 503 });
  try {
    const { db } = await import("@/lib/db");
    const users = await db.user.findMany({
      select: { id: true, name: true, email: true, role: true, designation: true, isActive: true, lastLoginAt: true, department: { select: { code: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: users, meta: { total: users.length } });
  } catch (err) {
    return NextResponse.json({ error: "DB_UNAVAILABLE", message: (err as Error).message.slice(0, 160) }, { status: 503 });
  }
}

export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "AUTH_FORBIDDEN" }, { status: 403 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "SIMULATION_MODE" }, { status: 503 });
  let body: Record<string, string>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { name, email, role = "VIEWER", departmentId, designation, password } = body;
  if (!name || !email || !password) return NextResponse.json({ error: "VALIDATION_ERROR", message: "name, email, password required" }, { status: 422 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "VALIDATION_ERROR", message: "invalid email" }, { status: 422 });

  try {
    const { db } = await import("@/lib/db");
    const exists = await db.user.findUnique({ where: { email } });
    if (exists) return NextResponse.json({ error: "CONFLICT_DUPLICATE", message: "email already registered" }, { status: 409 });

    const { randomBytes, scryptSync } = await import("crypto");
    const salt = randomBytes(16).toString("hex");
    const hash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
    const user = await db.user.create({
      data: {
        name, email, passwordHash: hash, role, designation,
        departmentId: departmentId ?? null,
        avatarInitials: name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      },
    });
    await db.auditLog.create({ data: { action: "CREATE", entity: "User", entityId: user.id, details: `User ${email} created with role ${role}` } }).catch(() => {});
    return NextResponse.json({ ok: true, user: { id: user.id, name, email, role } }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "DB_UNAVAILABLE", message: (err as Error).message.slice(0, 160) }, { status: 503 });
  }
}
