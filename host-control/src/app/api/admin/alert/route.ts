// v21: broadcast an alert. Optionally auto-email the targeted recipients.
import { NextResponse } from "next/server";
import { broadcastAlert, getState } from "@/lib/host/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { title, message, severity, by, targetUserId, targetRole, autoEmail, projectName, projectPsId } = await req.json();
  await broadcastAlert(
    String(title),
    String(message),
    severity || "HIGH",
    String(by || "CPO"),
    { targetUserId, targetRole, autoEmail: !!autoEmail, projectName, projectPsId },
  );
  const s = await getState();
  return NextResponse.json({ ok: true, alerts: s.alerts, emails: s.emails });
}
