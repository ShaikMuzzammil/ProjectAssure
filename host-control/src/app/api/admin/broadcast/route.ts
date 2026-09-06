import { NextResponse } from "next/server";
import { requireHost } from "@/lib/host/auth";
import { addBroadcastRecord, audit, newId, nowIso, saveNow } from "@/lib/host/store";
import { postCommandToMain } from "@/lib/host/sync";
import type { Severity } from "@/lib/host/types";

export const dynamic = "force-dynamic";

const SEVERITIES: Severity[] = ["info", "warning", "critical"];

// POST /api/admin/broadcast — REAL delivery to main-app users:
// queues a command on the main sync hub (/api/sync/webhook); every logged-in
// main-app browser receives it within ~20s via their poll (notification + toast).
export async function POST(req: Request) {
  const gate = requireHost(req);
  if (!gate.ok) return gate.res;
  const actor = gate.email;

  let payload: {
    kind?: string;
    title?: string;
    message?: string;
    severity?: string;
    linkView?: string;
    audience?: string;
    audienceLabel?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const kind = payload.kind === "broadcast" || payload.kind === "announce" ? payload.kind : "user-alert";
  const title = String(payload.title ?? "").trim().slice(0, 200);
  const message = String(payload.message ?? "").trim().slice(0, 2000);
  const severity = (SEVERITIES.includes(payload.severity as Severity) ? payload.severity : "info") as Severity;
  const linkView = payload.linkView ? String(payload.linkView).slice(0, 120) : undefined;

  if (!title || !message) {
    return NextResponse.json({ ok: false, error: "title_and_message_required" }, { status: 422 });
  }

  // audience: "all" for broadcasts/announcements, or a main-app userId
  let audience = "all";
  if (kind === "user-alert") {
    const target = String(payload.audience ?? "").trim();
    if (!target) return NextResponse.json({ ok: false, error: "audience_user_required" }, { status: 422 });
    audience = target;
  }

  const outcome = await postCommandToMain({
    kind,
    title,
    message,
    severity,
    linkView,
    audience,
    createdBy: `host:${actor}`,
  });

  addBroadcastRecord({
    id: newId(),
    kind,
    title,
    message,
    severity,
    audience,
    audienceLabel: String(payload.audienceLabel ?? (audience === "all" ? "All main-app users" : audience)).slice(0, 120),
    at: nowIso(),
    createdBy: actor,
    delivered: outcome.ok,
    deliveryNote: outcome.note,
  });

  audit(
    outcome.ok ? "broadcast.delivered" : "broadcast.failed",
    actor,
    `${kind} “${title}” → ${audience === "all" ? "all users" : `user ${audience}`} · ${outcome.note}`,
    outcome.ok ? "success" : "warning",
  );
  saveNow();

  return NextResponse.json({ ok: outcome.ok, kind, audience, note: outcome.note }, { status: outcome.ok ? 200 : 502 });
}
