// ═══════════════════════════════════════════════════════════════════════════
// Host Control mailer — automated + manual email with provider chain.
//
// Priority (all env-var configured, no keys in code):
//   1. SMTP via EMAIL_USER + EMAIL_PASS (+ SMTP_HOST/SMTP_PORT, nodemailer)
//      · port 465 → implicit TLS · port 587 → STARTTLS
//      · Gmail requires From == authenticated user — handled below
//   2. Brevo HTTP API  (BREVO_API_KEY · 300/day free)
//   3. Resend HTTP API (RESEND_API_KEY)
//   4. Outbox mode — honest SIMULATED entry in the outbox log with reason
//
// Every send (real, simulated or failed) is logged to the host outbox.
// ═══════════════════════════════════════════════════════════════════════════

import { addOutboxEntry, newId, nowIso } from "./store";
import type { EmailKind, EmailLogEntry } from "./types";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  kind: EmailKind;
  template?: string;
  /** v23: optional attachments — {filename, contentType, base64} */
  attachments?: { filename: string; contentType: string; base64: string }[];
}

function wrapHtml(title: string, html: string): string {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(90deg,#072b49,#0c93e7);color:#fff;padding:14px 20px;font-weight:700">ProjectAssure Host Control · ${title.replace(/_/g, " ")}</div>
    <div style="padding:20px;color:#0f172a;font-size:14px;line-height:1.6">${html}</div>
    <div style="padding:12px 20px;background:#f8fafc;color:#64748b;font-size:11px">Sent by ProjectAssure Host Control (SIH 2026 · SIH26103 · Team NEXGEN) · automated alerts require officer verification before escalation.</div>
  </div>`;
}

function markdownish(body: string): string {
  return body
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}

/** Human label of the provider that WOULD serve right now (for status UI). */
export function emailProviderLabel(): string {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) return `smtp:${process.env.SMTP_HOST ?? "smtp.gmail.com"}`;
  if (process.env.BREVO_API_KEY) return "brevo";
  if (process.env.RESEND_API_KEY) return "resend";
  return "outbox";
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Send one email through the provider chain. NEVER throws — every outcome is
 * logged to the outbox and returned as an EmailLogEntry.
 */
export async function sendHostEmail(input: SendEmailInput): Promise<EmailLogEntry> {
  const to = String(input.to ?? "").trim();
  const subject = String(input.subject ?? "ProjectAssure Host Control").slice(0, 300);
  const body = String(input.body ?? "");
  const kind = input.kind;
  const template = input.template ?? kind;
  const html = wrapHtml(template, markdownish(body));
  // v23: attachments ride with every provider that supports them
  const attachments = (input.attachments ?? [])
    .filter(a => a && a.filename && a.base64)
    .slice(0, 5)
    .map(a => ({ filename: String(a.filename).slice(0, 120), content: a.base64, contentType: a.contentType || "application/octet-stream", encoding: "base64" as const }));

  const log = (status: EmailLogEntry["status"], provider: string, reason?: string): EmailLogEntry => {
    const entry: EmailLogEntry = { id: newId(), to, subject, status, provider, kind, reason, at: nowIso(), attachments: attachments.length ? attachments.map(a => a.filename) : undefined };
    addOutboxEntry(entry);
    return entry;
  };

  if (!EMAIL_RE.test(to)) {
    return log("FAILED", "invalid", `invalid recipient address: “${to.slice(0, 60)}”`);
  }

  const smtpUser = process.env.EMAIL_USER;
  const smtpPass = process.env.EMAIL_PASS;
  const smtpHost = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT ?? 465);

  // 1) SMTP / nodemailer
  if (smtpUser && smtpPass) {
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.default.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 10_000,
        greetingTimeout: 8_000,
      });
      const from = smtpHost.includes("gmail")
        ? `"ProjectAssure Host Control" <${smtpUser}>`
        : `"ProjectAssure Host Control" <${process.env.ALERT_EMAIL_FROM ?? smtpUser}>`;
      await transport.sendMail({ from, to, subject, html, text: body.replace(/\*\*/g, ""), attachments: attachments.length ? attachments : undefined });
      return log("SENT", `smtp:${smtpHost}`);
    } catch (err) {
      const msg = (err as Error).message ?? "smtp error";
      return log("FAILED", `smtp:${smtpHost}`, msg.slice(0, 200));
    }
  }

  // 2) Brevo HTTP API
  if (process.env.BREVO_API_KEY) {
    try {
      const from = process.env.ALERT_EMAIL_FROM ?? (smtpUser ?? "noreply@projectassure.app");
      const res = await fetchWithTimeout("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { name: "ProjectAssure Host Control", email: from },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: body,
          // v23: real attachments over Brevo too
          attachment: attachments.map(a => ({ name: a.filename, content: a.content, contentType: a.contentType })),
        }),
      }, 12000);
      if (res && res.ok) return log("SENT", "brevo");
      const detail = res ? await res.text().catch(() => "") : "unreachable";
      return log("FAILED", "brevo", `brevo_error_${res?.status ?? 0}: ${detail.slice(0, 160)}`);
    } catch {
      return log("FAILED", "brevo", "brevo_unreachable: network error");
    }
  }

  // 3) Resend HTTP API
  if (process.env.RESEND_API_KEY) {
    try {
      const from = process.env.ALERT_EMAIL_FROM ?? (smtpUser ?? "onboarding@resend.dev");
      const res = await fetchWithTimeout("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `ProjectAssure Host Control <${from}>`,
          to: [to],
          subject,
          html,
          // v23: real attachments over Resend too
          attachments: attachments.map(a => ({ filename: a.filename, content: a.content, content_type: a.contentType })),
        }),
      }, 12000);
      if (res && res.ok) return log("SENT", "resend");
      const detail = res ? await res.text().catch(() => "") : "unreachable";
      return log("FAILED", "resend", `resend_error_${res?.status ?? 0}: ${detail.slice(0, 160)}`);
    } catch {
      return log("FAILED", "resend", "resend_unreachable: network error");
    }
  }

  // 4) Outbox mode — honest SIMULATED record
  return log(
    "SIMULATED",
    "outbox",
    "no email provider configured — add EMAIL_USER+EMAIL_PASS, BREVO_API_KEY or RESEND_API_KEY to send for real",
  );
}
