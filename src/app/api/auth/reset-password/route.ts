import { NextResponse } from "next/server";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// POST /api/auth/reset-password — Forgot-password flow step 2.
// The user clicks the reset link (`/#/reset?token=<token>`) and submits a
// new password. We verify the token, hash the new password with scrypt
// (same scheme as /api/auth/register), persist it, mark the token as used,
// and audit the change.
//
// HONEST BEHAVIOUR:
//   - Tokens are single-use. Once used (or expired), they cannot be reused.
//   - The new password must meet the same policy as registration: 8+ chars
//     with at least one letter and one number.
//   - On success we return the user's email so the UI can route them to the
//     sign-in tab — we do NOT auto-login (security best practice: a password
//     reset should always be followed by an explicit sign-in).
//   - On any failure (token not found, expired, already used, user no longer
//     active) we return 401 with a clear message. The UI explains the next
//     step (request a fresh link).
//   - In simulation mode (no DATABASE_URL), the client-side store handles
//     the reset entirely — this route returns a clear "SIMULATION_MODE"
//     message so the client knows to fall back to the local flow.
//
// REQUEST BODY: { token: string, password: string }
// RESPONSE:     { ok: true, email: string, message: string }

const TOKEN_BYTES = 32;

function verifyToken(provided: string, stored: string): boolean {
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(stored, "hex");
  if (a.length !== b.length || a.length !== TOKEN_BYTES) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  let body: { token?: string; password?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const token = String(body.token ?? "").trim();
  const password = String(body.password ?? "");
  if (!token || token.length !== TOKEN_BYTES * 2) {
    return NextResponse.json({ error: "TOKEN_INVALID", message: "Reset link is malformed — request a new one." }, { status: 401 });
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json({ error: "VALIDATION_ERROR", message: "Password needs 8+ characters with at least one letter and one number." }, { status: 422 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      error: "SIMULATION_MODE",
      message: "No DATABASE_URL — simulation mode handles the reset client-side.",
    }, { status: 503 });
  }

  try {
    const { db } = await import("@/lib/db");

    // Look up the token. We use findFirst because `token` is unique —
    // we want a single row back. Including the user relation gives us
    // the userId + isActive + email in one trip.
    const record = await db.passwordResetToken.findFirst({
      where: { token },
      include: { user: true },
    });
    if (!record) {
      return NextResponse.json({ error: "TOKEN_INVALID", message: "Reset link is invalid — request a new one." }, { status: 401 });
    }
    if (record.usedAt) {
      return NextResponse.json({ error: "TOKEN_USED", message: "This reset link has already been used — request a new one." }, { status: 401 });
    }
    if (Date.parse(record.expiresAt.toISOString()) < Date.now()) {
      return NextResponse.json({ error: "TOKEN_EXPIRED", message: "This reset link has expired — request a new one." }, { status: 401 });
    }
    if (!record.user || !record.user.isActive) {
      return NextResponse.json({ error: "ACCOUNT_INACTIVE", message: "This account is no longer active — contact the host administrator." }, { status: 401 });
    }
    if (!verifyToken(token, record.token)) {
      return NextResponse.json({ error: "TOKEN_INVALID", message: "Reset link failed verification." }, { status: 401 });
    }

    // Hash the new password with the same scrypt scheme as registration.
    const salt = randomBytes(16).toString("hex");
    const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;

    const ipUsed = (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim();

    await db.$transaction([
      db.user.update({
        where: { id: record.user.id },
        data: { passwordHash, updatedAt: new Date() },
      }),
      db.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date(), ipUsed },
      }),
      db.auditLog.create({
        data: {
          action: "PASSWORD_RESET",
          entity: "User",
          entityId: record.user.id,
          details: `Password reset completed via token (issued ${record.createdAt.toISOString()}, ip ${ipUsed}) — new scrypt hash stored.`,
          userId: record.user.id,
          ipAddress: ipUsed,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      email: record.user.email,
      message: "Password updated — sign in with your new password.",
    });
  } catch (err) {
    return NextResponse.json({ error: "DB_UNAVAILABLE", message: (err as Error).message.slice(0, 160) }, { status: 503 });
  }
}
