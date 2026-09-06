// v21: send an email alert to a single user (or simulate if no SMTP).
import { NextResponse } from "next/server";
import { sendEmailAlert, getState } from "@/lib/host/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { to, subject, body, userId, template, by } = await req.json();
  const targetUserId = String(userId || to || "");
  if (!targetUserId || !subject || !body) {
    return NextResponse.json({ ok: false, error: "missing userId/subject/body" }, { status: 400 });
  }
  try {
    const em = await sendEmailAlert(targetUserId, String(subject), String(body), String(by || "CPO"), template);
    const s = await getState();
    return NextResponse.json({ ok: true, email: em, emails: s.emails });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}
