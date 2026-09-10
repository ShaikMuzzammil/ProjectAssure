import { NextResponse } from "next/server";
import { requireHost } from "@/lib/host/auth";
import { audit } from "@/lib/host/store";
import { sendHostEmail } from "@/lib/host/mailer";

export const dynamic = "force-dynamic";

// POST /api/email/send — manual email from the host (user drawer / outbox
// composer). Goes through the same provider chain as the automated jobs and
// is logged in the outbox (SENT / SIMULATED / FAILED — always honest).
export async function POST(req: Request) {
  const gate = requireHost(req);
  if (!gate.ok) return gate.res;
  const actor = gate.email;

  let payload: { to?: string; subject?: string; body?: string; template?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const to = String(payload.to ?? "").trim();
  const subject = String(payload.subject ?? "").trim().slice(0, 300);
  const body = String(payload.body ?? "").slice(0, 4000);
  if (!to || !subject) {
    return NextResponse.json({ ok: false, error: "to_and_subject_required" }, { status: 422 });
  }

  const entry = await sendHostEmail({ to, subject, body: body || "(no body)", kind: "manual", template: payload.template });

  audit(
    entry.status === "SENT" ? "email.sent" : entry.status === "SIMULATED" ? "email.simulated" : "email.failed",
    actor,
    `manual email to ${to} “${subject}” — ${entry.status} via ${entry.provider}${entry.reason ? ` (${entry.reason.slice(0, 120)})` : ""}`,
    entry.status === "FAILED" ? "warning" : "info",
  );

  return NextResponse.json(
    { ok: entry.status !== "FAILED", entry },
    { status: entry.status === "FAILED" ? 502 : 200 },
  );
}
