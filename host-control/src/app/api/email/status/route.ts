import { NextResponse } from "next/server";
import { requireHost } from "@/lib/host/auth";
import { emailProviderLabel } from "@/lib/host/mailer";

export const dynamic = "force-dynamic";

// GET /api/email/status — provider diagnostics for the Outbox view.
// ?verify=1 → attempts a REAL SMTP verification (up to ~6s).
export async function GET(req: Request) {
  const gate = requireHost(req);
  if (!gate.ok) return gate.res;

  const doVerify = new URL(req.url).searchParams.get("verify") === "1";
  const smtpReady = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
  const smtpHost = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT ?? 465);

  let smtpVerify: { ok: boolean; detail: string } | null = null;
  if (doVerify && smtpReady) {
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.default.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        connectionTimeout: 6_000,
      });
      await transport.verify();
      smtpVerify = { ok: true, detail: "SMTP login verified — real delivery is live." };
    } catch (err) {
      smtpVerify = { ok: false, detail: (err as Error).message.slice(0, 200) };
    }
  }

  return NextResponse.json({
    provider: emailProviderLabel(),
    smtp: { configured: smtpReady, host: smtpHost, port: smtpPort, from: process.env.EMAIL_USER ?? null, verify: smtpVerify },
    brevo: { configured: Boolean(process.env.BREVO_API_KEY) },
    resend: { configured: Boolean(process.env.RESEND_API_KEY) },
    sender: process.env.ALERT_EMAIL_FROM ?? null,
    checkedAt: new Date().toISOString(),
  });
}
