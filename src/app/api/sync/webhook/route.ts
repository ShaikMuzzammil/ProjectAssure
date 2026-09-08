import { NextRequest, NextResponse } from "next/server";
import { addCommand } from "@/lib/sync/server-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/sync/webhook
 * Host Control pushes commands INTO the main app here (server-to-server).
 * Commands are queued; every logged-in main-app browser polls
 * GET /api/sync/commands and applies them as live notifications.
 *
 * Body: { kind, title, message, severity, linkView?, audience?, createdBy }
 * Auth: optional shared secret via x-sync-token (SYNC_TOKEN).
 */
export async function POST(req: NextRequest) {
  try {
    const expected = process.env.SYNC_TOKEN;
    if (expected && req.headers.get("x-sync-token") !== expected) {
      return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
    }
    const body = await req.json();
    const kindRaw = String(body.kind || "broadcast");
    const allowed = ["broadcast", "user-alert", "request-sync", "announce", "host-message",
      "project-approved", "project-rejected", "document-reviewed", "evidence-reviewed", "ai-request-resolved"] as const;
    const kind = (allowed as readonly string[]).includes(kindRaw)
      ? (kindRaw as (typeof allowed)[number])
      : "broadcast";
    const severityRaw = String(body.severity || "info");
    const severity = (["info", "warning", "critical"] as const).includes(
      severityRaw as "info" | "warning" | "critical"
    )
      ? (severityRaw as "info" | "warning" | "critical")
      : "info";
    const command = addCommand({
      kind,
      title: String(body.title || "Host Control broadcast").slice(0, 200),
      message: String(body.message || "").slice(0, 4000),
      severity,
      linkView: body.linkView ? String(body.linkView).slice(0, 60) : undefined,
      linkProjectId: body.linkProjectId ? String(body.linkProjectId).slice(0, 60) : undefined,
      audience: body.audience ? String(body.audience) : "all",
      createdBy: String(body.createdBy || "Host Control").slice(0, 120),
    });
    return NextResponse.json({ ok: true, commandId: command.id, createdAt: command.createdAt });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "bad_request", detail: String(err) }, { status: 400 });
  }
}
