import { NextResponse } from "next/server";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// POST /api/auth/change-password — Authenticated password change.
// The signed-in user enters their current password + a new password.
// We verify the current password against the stored hash, then replace it
// with a fresh scrypt hash of the new password. All passwords are one-way
// encrypted; we never see or store plaintext.
//
// HONEST BEHAVIOUR:
//   - The current password must match. We use a constant-time compare so a
//     timing attack cannot reveal information about the stored hash.
//   - The new password must meet the same policy as registration: 8+ chars
//     with at least one letter and one number.
//   - On success we audit the change. We do NOT auto-logout — the user can
//     keep working with the new password. (The session is client-side hash
//     routed; the persisted hash has changed under it.)
//   - In simulation mode (no DATABASE_URL), the client store handles this
//     entirely and we return a clear "SIMULATION_MODE" message so the client
//     knows to fall back to the local flow.
//
// REQUEST BODY: { email: string, currentPassword: string, newPassword: string }
// RESPONSE:     { ok: true, message: string }

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64);
  const known = Buffer.from(hash, "hex");
  return test.length === known.length && timingSafeEqual(test, known);
}

export async function POST(req: Request) {
  let body: { email?: string; currentPassword?: string; newPassword?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const email = String(body.email ?? "").trim().toLowerCase();
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");
  if (!email || !currentPassword || !newPassword) {
    return NextResponse.json({ error: "VALIDATION_ERROR", message: "Email, current password and new password are required." }, { status: 422 });
  }
  if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return NextResponse.json({ error: "VALIDATION_ERROR", message: "New password needs 8+ characters with at least one letter and one number." }, { status: 422 });
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "VALIDATION_ERROR", message: "New password must be different from the current one." }, { status: 422 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      error: "SIMULATION_MODE",
      message: "No DATABASE_URL — simulation mode handles the change client-side.",
    }, { status: 503 });
  }

  try {
    const { db } = await import("@/lib/db");
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "AUTH_INVALID", message: "No active account for this email." }, { status: 401 });
    }
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return NextResponse.json({ error: "AUTH_INVALID", message: "Current password is incorrect." }, { status: 401 });
    }

    const salt = randomBytes(16).toString("hex");
    const passwordHash = `${salt}:${scryptSync(newPassword, salt, 64).toString("hex")}`;
    const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim();

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { passwordHash, updatedAt: new Date() },
      }),
      db.auditLog.create({
        data: {
          action: "PASSWORD_RESET",
          entity: "User",
          entityId: user.id,
          details: `Password changed by authenticated user (${email}) · new scrypt hash stored.`,
          userId: user.id,
          ipAddress: ip,
        },
      }),
    ]);

    return NextResponse.json({ ok: true, message: "Password changed — your new password is now active." });
  } catch (err) {
    return NextResponse.json({ error: "DB_UNAVAILABLE", message: (err as Error).message.slice(0, 160) }, { status: 503 });
  }
}
