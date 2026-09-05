import { NextResponse } from "next/server";

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/email/send — universal email delivery (v3).
// Provider priority (all free tiers, all env-var configured — no keys in code):
//   1. email service via EMAIL_USER + EMAIL_PASS  (Gmail App Password, Brevo email service, any host)
//      · port 465 → implicit TLS · port 587 → STARTTLS (auto)
//      · Gmail requires From == authenticated user — handled below
//   2. Brevo HTTP API  (BREVO_API_KEY · 300 mails/day free)
//   3. Resend HTTP API (RESEND_API_KEY · domain-verified senders)
//   4. Outbox mode     — honest SIMULATED fallback with actionable guidance
// GET  /api/email/status — diagnostics: which provider is configured + a
//      real email service verification attempt so the Email Centre can show live state.
// ═══════════════════════════════════════════════════════════════════════════

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function wrapHtml(title: string, html: string): string {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(90deg,#0b426e,#0c93e7);color:#fff;padding:14px 20px;font-weight:700">ProjectAssure · ${title.replace(/_/g, " ")}</div>
    <div style="padding:20px;color:#0f172a;font-size:14px;line-height:1.6">${html}</div>
    <div style="padding:12px 20px;background:#f8fafc;color:#64748b;font-size:11px">Sent by ProjectAssure (SIH 2026 · SIH26103 · Team NEXGEN) · every alert requires officer verification before escalation.</div>
  </div>`;
}

function markdownish(body: string): string {
  return body
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}

export async function POST(req: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ sent: false, reason: "invalid_json" }, { status: 400 });
  }

  const to = String(payload.to ?? "").trim();
  if (!EMAIL_RE.test(to)) {
    return NextResponse.json({ sent: false, reason: `invalid_recipient: “${to.slice(0, 60)}” is not a valid email address` }, { status: 422 });
  }

  const subject = String(payload.subject ?? "ProjectAssure message").slice(0, 300);
  const body = String(payload.body ?? "");
  const template = String(payload.template ?? "custom");
  const html = wrapHtml(template, markdownish(body));

  const smtpUser = process.env.EMAIL_USER;
  const smtpPass = process.env.EMAIL_PASS;
  const smtpHost = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT ?? 465);

  // 1) email service (Gmail App Password / Brevo email service / any relay)
  if (smtpUser && smtpPass) {
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.default.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,          // 465 → implicit TLS · 587 → STARTTLS
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 10_000,
        greetingTimeout: 8_000,
      });
      // Gmail rewrites/validates From: it must be the authenticated account —
      // anything else is rejected with 550. So default From to the login.
      const from = smtpHost.includes("gmail")
        ? `"ProjectAssure Alerts" <${smtpUser}>`
        : `"ProjectAssure Alerts" <${process.env.ALERT_EMAIL_FROM ?? smtpUser}>`;
      await transport.sendMail({ from, to, subject, html, text: body.replace(/\*\*/g, "") });
      return NextResponse.json({ sent: true, provider: `smtp:${smtpHost}` });
    } catch (err) {
      const msg = (err as Error).message ?? "";
      const hint =
        msg.includes("Missing credentials") ? "Add EMAIL_USER and EMAIL_PASS to your environment."
        : msg.includes("EAUTH") || msg.includes("535") ? "Username/App Password rejected — generate a fresh Gmail App Password (2FA must be on) and paste it without spaces."
        : msg.includes("ETIMEDOUT") || msg.includes("ECONNREFUSED") ? "Could not reach the email service host — check email service_HOST/email service_PORT and network egress."
        : msg.includes("self signed") || msg.includes("certificate") ? "TLS certificate rejected — check email service_PORT (465 implicit TLS vs 587 STARTTLS)."
        : "email service error — see the diagnostics panel in the Email Centre for the full message.";
      return NextResponse.json({ sent: false, reason: `smtp_error: ${msg.slice(0, 160)}`, hint, provider: `smtp:${smtpHost}` }, { status: 502 });
    }
  }

  // 2) Brevo HTTP API (free 300/day)
  if (process.env.BREVO_API_KEY) {
    try {
      const fromBrevo = process.env.ALERT_EMAIL_FROM ?? (smtpUser ?? "noreply@projectassure.app");
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sender: { name: "ProjectAssure Alerts", email: fromBrevo }, to: [{ email: to }], subject, htmlContent: html, textContent: body }),
      });
      if (res.ok) return NextResponse.json({ sent: true, provider: "brevo" });
      const detail = await res.text().catch(() => "");
      return NextResponse.json({ sent: false, reason: `brevo_error_${res.status}: ${detail.slice(0, 160)}`, hint: "Brevo rejected the send — verify the sender address is validated in your Brevo account.", provider: "brevo" }, { status: 502 });
    } catch {
      return NextResponse.json({ sent: false, reason: "brevo_unreachable: network error contacting api.brevo.com", provider: "brevo" }, { status: 502 });
    }
  }

  // 3) Resend HTTP API
  if (process.env.RESEND_API_KEY) {
    try {
      const fromResend = process.env.ALERT_EMAIL_FROM ?? (smtpUser ?? "onboarding@resend.dev");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `ProjectAssure <${fromResend}>`, to: [to], subject, html }),
      });
      if (res.ok) return NextResponse.json({ sent: true, provider: "resend" });
      const detail = await res.text().catch(() => "");
      const hint = res.status === 403
        ? "Resend only delivers to your own account address until you verify a domain — add a domain in the Resend dashboard and set ALERT_EMAIL_FROM."
        : "Resend rejected the send — check RESEND_API_KEY and the verified sender.";
      return NextResponse.json({ sent: false, reason: `resend_error_${res.status}: ${detail.slice(0, 160)}`, hint, provider: "resend" }, { status: 502 });
    } catch {
      return NextResponse.json({ sent: false, reason: "resend_unreachable: network error contacting api.resend.com", provider: "resend" }, { status: 502 });
    }
  }

  // 4) Outbox mode (demo) — honest fallback with actionable guidance
  return NextResponse.json({
    sent: false,
    reason: "outbox_mode: no email provider configured yet.",
    hint: "To send real emails, add ONE of: (a) EMAIL_USER + EMAIL_PASS (Gmail App Password) — see the step-by-step guide in Email Centre → Settings; (b) BREVO_API_KEY (free 300/day); (c) RESEND_API_KEY. Then redeploy. Until then every send is recorded honestly as SIMULATED here.",
    preview: { to, subject },
  });
}

// GET /api/email/status — live diagnostics for the Email Centre panel.
export async function GET() {
  const smtpReady = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
  const brevoReady = Boolean(process.env.BREVO_API_KEY);
  const resendReady = Boolean(process.env.RESEND_API_KEY);
  const provider = smtpReady ? `smtp:${process.env.SMTP_HOST ?? "smtp.gmail.com"}` : brevoReady ? "brevo" : resendReady ? "resend" : "outbox";

  // live email service verification when configured (real connection test)
  let smtpVerify: { ok: boolean; detail: string } | null = null;
  if (smtpReady) {
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST ?? "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT ?? 465),
        secure: Number(process.env.SMTP_PORT ?? 465) === 465,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        connectionTimeout: 8_000,
      });
      await transport.verify();
      smtpVerify = { ok: true, detail: "email service login verified — real delivery is live." };
    } catch (err) {
      smtpVerify = { ok: false, detail: (err as Error).message.slice(0, 200) };
    }
  }

  return NextResponse.json({
    provider,
    smtp: { configured: smtpReady, host: process.env.SMTP_HOST ?? "smtp.gmail.com", port: Number(process.env.SMTP_PORT ?? 465), from: process.env.EMAIL_USER ?? null, verify: smtpVerify },
    brevo: { configured: brevoReady },
    resend: { configured: resendReady },
    checkedAt: new Date().toISOString(),
  });
}
