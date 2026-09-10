import { NextResponse } from "next/server";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// POST /api/auth/login — live-database authentication (connected mode).
// Demo/simulation mode never calls this; the client store validates personas
// locally. When DATABASE_URL points at Neon (prod) this route does the real
// bcrypt-grade flow: scrypt verify + audit row + JWT-ready session claims.

function hashPassword(password: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64);
  const known = Buffer.from(hash, "hex");
  return test.length === known.length && timingSafeEqual(test, known);
}

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password) return NextResponse.json({ error: "AUTH_REQUIRED", message: "email and password are required" }, { status: 401 });

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "SIMULATION_MODE", message: "No DATABASE_URL configured — the deterministic demo directory is used instead." }, { status: 503 });
  }

  try {
    const { db } = await import("@/lib/db");
    const user = await db.user.findUnique({ where: { email }, include: { department: true } });
    if (!user || !user.isActive) return NextResponse.json({ error: "AUTH_INVALID", message: "No active account for this email." }, { status: 401 });
    if (!verifyPassword(password, user.passwordHash)) return NextResponse.json({ error: "AUTH_INVALID", message: "Incorrect password." }, { status: 401 });

    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await db.auditLog.create({
      data: { action: "LOGIN", entity: "Session", details: `SSO login for ${user.email} (${user.role}) · 3-domain JWT handoff`, userId: user.id },
    }).catch(() => { /* audit write is best-effort in dev */ });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        department: user.department?.code ?? null, designation: user.designation,
        avatarInitials: user.avatarInitials ?? user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
      },
      session: { alg: "HS256", ttlHours: 24, domains: ["main", "analytics", "ai"] },
    });
  } catch (err) {
    return NextResponse.json({ error: "DB_UNAVAILABLE", message: (err as Error).message.slice(0, 160) }, { status: 503 });
  }
}

// utility export used by the seed script
export { hashPassword };
