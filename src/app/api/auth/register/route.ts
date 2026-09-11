import { NextResponse } from "next/server";
import { randomBytes, scryptSync } from "crypto";

// POST /api/auth/register — real account creation (connected mode).
// The client store always registers locally first (simulation mode keeps the
// demo self-contained); this route mirrors the account into PostgreSQL when
// DATABASE_URL points at Neon, with an scrypt hash — the plaintext password is
// never stored anywhere, only used to derive the salted hash. A successful
// mirror lets other devices and the 3 Vercel domains see the same account.

const ALLOWED_ROLES = new Set(["PROJECT_MANAGER", "STAKEHOLDER", "VIEWER"]); // ADMIN is never self-assignable

export async function POST(req: Request) {
  let body: { name?: string; email?: string; password?: string; role?: string; departmentId?: string; designation?: string; phone?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const role = ALLOWED_ROLES.has(String(body.role)) ? String(body.role) : "PROJECT_MANAGER";

  if (name.length < 3) return NextResponse.json({ error: "VALIDATION_ERROR", message: "Full name must be at least 3 characters." }, { status: 422 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "VALIDATION_ERROR", message: "A valid email address is required." }, { status: 422 });
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json({ error: "VALIDATION_ERROR", message: "Password needs 8+ characters with at least one letter and one number." }, { status: 422 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "SIMULATION_MODE", message: "No DATABASE_URL — account is stored locally in this browser (demo mode)." }, { status: 503 });
  }

  try {
    const { db } = await import("@/lib/db");
    const exists = await db.user.findUnique({ where: { email } });
    if (exists) return NextResponse.json({ error: "CONFLICT_DUPLICATE", message: "An account with this email already exists." }, { status: 409 });

    // resolve department: the client sends demo ids ("dept-ipmd"), while the
    // database rows may use generated ids — match by id OR by code
    let departmentId: string | null = null;
    if (body.departmentId) {
      const clientDept = String(body.departmentId);
      const dept = await db.department.findFirst({
        where: { OR: [{ id: clientDept }, { code: clientDept.replace(/^dept-/, "").toUpperCase() }] },
      }).catch(() => null);
      departmentId = dept?.id ?? null;
    }

    const salt = randomBytes(16).toString("hex");
    const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
    const user = await db.user.create({
      data: {
        name, email, passwordHash, role,
        designation: body.designation ? String(body.designation).slice(0, 120) : "Registered member",
        phone: body.phone ? String(body.phone).slice(0, 24) : null,
        departmentId,
        avatarInitials: name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      },
    });
    await db.auditLog.create({
      data: { action: "CREATE", entity: "User", entityId: user.id, details: `Self-registration: ${email} as ${role} (scrypt-hashed, secure cloud database)` },
    }).catch(() => { /* best-effort */ });

    return NextResponse.json({
      ok: true, mirrored: true,
      user: { id: user.id, name, email, role },
      security: { hash: "scrypt (N=16384, r=8, p=1, 64-byte)", stored: "secure cloud database", plaintext: "never" },
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "DB_UNAVAILABLE", message: (err as Error).message.slice(0, 160) }, { status: 503 });
  }
}
