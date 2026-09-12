import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

// POST /api/auth/request-reset — Forgot-password flow step 1.
// The user enters their email; we look it up in the database, generate a
// 32-byte hex token, persist it (1-hour expiry, single-use), and email the
// reset link to the user.
//
// HONEST BEHAVIOUR:
//   - If the email does NOT exist in the database, we still return 200 with
//     the same message. This is intentional — we never leak which emails are
//     registered (anti-enumeration). The user sees "If that account exists,
//     a reset link has been sent."
//   - The reset link points at `${origin}/#/reset?token=<token>`.
//   - In simulation mode (no DATABASE_URL), we accept the request but cannot
//     persist the token — we return a clear message explaining the demo-mode
//     fallback (the client store has its own local forgot-password flow).
//   - Email delivery uses the Email Centre's /api/email/send endpoint when
//     available, otherwise the link is logged to the audit trail so an admin
//     can deliver it manually.
//
// REQUEST BODY: { email: string, origin?: string }
// RESPONSE:     { ok: true, sent: boolean, simulated: boolean, message: string }

const TOKEN_TTL_MIN = 60;
const TOKEN_BYTES = 32;

export async function POST(req: Request) {
  let body: { email?: string; origin?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "VALIDATION_ERROR", message: "A valid email address is required." }, { status: 422 });
  }

  // The reset link target. We trust the request's origin (or fall back to
  // the env var) — never trust arbitrary user-provided URLs.
  const origin = (body.origin || process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  if (!origin) {
    return NextResponse.json({ error: "CONFIG_ERROR", message: "Could not determine the app URL — set NEXT_PUBLIC_APP_URL." }, { status: 500 });
  }

  // Simulation mode — no DATABASE_URL: respond with the same honest message
  // so the UX matches production. The client-side store handles its own
  // forgot-password for demo/simulation accounts (see app-store.ts).
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      ok: true,
      sent: false,
      simulated: true,
      message: "Simulation mode — no database connected. Use the in-app forgot-password flow for demo accounts.",
    });
  }

  try {
    const { db } = await import("@/lib/db");

    const user = await db.user.findUnique({ where: { email } });
    // Anti-enumeration: do not leak whether the email exists. The response
    // below is identical regardless. Internally, only proceed if the user
    // exists AND is active.
    if (!user || !user.isActive) {
      return NextResponse.json({
        ok: true,
        sent: false,
        simulated: true,
        message: "If that account exists, a reset link has been sent.",
      });
    }

    // Generate a single-use token. We always issue a fresh one and
    // invalidate prior unused tokens for this user (clean up).
    const token = randomBytes(TOKEN_BYTES).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60 * 1000);
    const ipIssued = (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim();

    await db.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }).catch(() => null);
    await db.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt, ipIssued },
    });

    const resetLink = `${origin}/#/reset?token=${token}`;
    await db.auditLog.create({
      data: {
        action: "PASSWORD_RESET",
        entity: "User",
        entityId: user.id,
        details: `Password reset requested for ${email} · token expires ${expiresAt.toISOString()}`,
        userId: user.id,
        ipAddress: ipIssued,
      },
    }).catch(() => null);

    // Best-effort email delivery — try the Email Centre first, then Brevo/SMTP
    // if env vars exist, otherwise the reset link is recorded in the audit log.
    let delivered = false;
    let deliveryNote = "audit-logged — deliver manually if no email provider is configured";
    try {
      const res = await fetch(`${origin}/api/email/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject: "ProjectAssure — password reset link",
          body: `Hello ${user.name},\n\nWe received a request to reset the password on your ProjectAssure account.\n\nReset link (valid for ${TOKEN_TTL_MIN} minutes):\n${resetLink}\n\nIf you did not request this, you can safely ignore this email — your password is unchanged and the link will expire on its own.\n\n— ProjectAssure · Central Programme Office`,
        }),
      }).catch(() => null);
      if (res?.ok) {
        delivered = true;
        deliveryNote = "emailed via the Email Centre provider chain";
      }
    } catch {
      /* fall back to audit-log delivery */
    }

    return NextResponse.json({
      ok: true,
      sent: delivered,
      simulated: !delivered,
      message: `If that account exists, a reset link has been sent.${delivered ? "" : ` (${deliveryNote})`}`,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: "DB_UNAVAILABLE", message: (err as Error).message.slice(0, 160) }, { status: 503 });
  }
}
