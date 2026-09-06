import { NextResponse } from "next/server";
import { requireHost } from "@/lib/host/auth";
import { audit, getStore, nowIso, upsertAccess } from "@/lib/host/store";
import { postCommandToMain } from "@/lib/host/sync";
import { sendHostEmail } from "@/lib/host/mailer";

export const dynamic = "force-dynamic";

const ROLE_OPTIONS = ["ADMIN", "PM", "STAKEHOLDER", "VIEWER"];

// POST /api/admin/users — real host actions on a mirrored main-app user.
// Access/role changes are recorded in the host store (authoritative on the
// host side, reflected in the grid) AND the user is notified for real via a
// user-alert webhook that lands in their main-app notifications (~20s).
export async function POST(req: Request) {
  const gate = requireHost(req);
  if (!gate.ok) return gate.res;
  const actor = gate.email;

  let payload: { userId?: string; action?: string; value?: string; title?: string; message?: string; severity?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const userId = String(payload.userId ?? "").trim();
  const action = String(payload.action ?? "").trim();
  const store = getStore();
  const user = store.data.mirror.users.find((u) => u.id === userId);
  if (!user) {
    return NextResponse.json({ ok: false, error: "user_not_in_mirror", hint: "the user must exist in the latest snapshot — force a sync" }, { status: 404 });
  }

  const record = store.data.access[userId];
  const nextActive = action === "deactivate" ? false : action === "activate" ? true : record?.active ?? true;

  switch (action) {
    case "activate":
    case "deactivate": {
      upsertAccess({
        userId,
        userName: user.name,
        active: nextActive,
        roleOverride: record?.roleOverride,
        changedAt: nowIso(),
        changedBy: actor,
        reason: action === "deactivate" ? "host-restricted" : "host-restored",
      });
      const outcome = await postCommandToMain({
        kind: "user-alert",
        title: action === "deactivate" ? "Account access restricted by Host Control" : "Account access restored by Host Control",
        message:
          action === "deactivate"
            ? `Hello ${user.name}, your ProjectAssure account access has been restricted by the Central Programme Office (Host Control). Contact the host administrator (${actor}) for details.`
            : `Hello ${user.name}, your ProjectAssure account access has been restored by the Central Programme Office (Host Control).`,
        severity: action === "deactivate" ? "warning" : "info",
        audience: userId,
        createdBy: `host:${actor}`,
      });
      audit(
        `user.${action}`,
        actor,
        `${user.name} <${user.email}> — access ${nextActive ? "restored" : "restricted"} · notify webhook ${outcome.ok ? "queued" : "failed"}`,
        action === "deactivate" ? "warning" : "success",
      );
      return NextResponse.json({ ok: true, active: nextActive, notified: outcome.ok, note: outcome.note });
    }

    case "role": {
      const role = String(payload.value ?? "").trim().toUpperCase();
      if (!ROLE_OPTIONS.includes(role)) {
        return NextResponse.json({ ok: false, error: "invalid_role", allowed: ROLE_OPTIONS }, { status: 422 });
      }
      upsertAccess({
        userId,
        userName: user.name,
        active: record?.active ?? true,
        roleOverride: role,
        changedAt: nowIso(),
        changedBy: actor,
        reason: `role:${role}`,
      });
      const outcome = await postCommandToMain({
        kind: "user-alert",
        title: `Your ProjectAssure role is now ${role}`,
        message: `Hello ${user.name}, the Central Programme Office changed your platform role to ${role} (was ${(record?.roleOverride ?? user.role).toUpperCase()}). Permissions update on your next login.`,
        severity: "info",
        audience: userId,
        createdBy: `host:${actor}`,
      });
      audit("user.role-change", actor, `${user.name} <${user.email}> → role ${role} · notify webhook ${outcome.ok ? "queued" : "failed"}`, "info");
      return NextResponse.json({ ok: true, role, notified: outcome.ok, note: outcome.note });
    }

    case "alert": {
      const title = String(payload.title ?? "").trim().slice(0, 200);
      const message = String(payload.message ?? "").trim().slice(0, 2000);
      const severity = ["info", "warning", "critical"].includes(payload.severity ?? "") ? (payload.severity as "info" | "warning" | "critical") : "info";
      if (!title || !message) {
        return NextResponse.json({ ok: false, error: "title_and_message_required" }, { status: 422 });
      }
      const outcome = await postCommandToMain({
        kind: "user-alert",
        title,
        message,
        severity,
        audience: userId,
        createdBy: `host:${actor}`,
      });
      audit(
        outcome.ok ? "user.alert-sent" : "user.alert-failed",
        actor,
        `direct alert “${title}” → ${user.name} <${user.email}> · ${outcome.note}`,
        outcome.ok ? "success" : "warning",
      );
      return NextResponse.json({ ok: outcome.ok, note: outcome.note }, { status: outcome.ok ? 200 : 502 });
    }

    case "email": {
      const subject = String(payload.title ?? payload.value ?? "Message from ProjectAssure Host Control").slice(0, 300);
      const body = String(payload.message ?? "").slice(0, 4000);
      if (!subject) return NextResponse.json({ ok: false, error: "subject_required" }, { status: 422 });
      const entry = await sendHostEmail({
        to: user.email,
        subject,
        body: body || "(no body)",
        kind: "manual",
      });
      audit(
        entry.status === "SENT" ? "user.email-sent" : entry.status === "SIMULATED" ? "user.email-simulated" : "user.email-failed",
        actor,
        `email to ${user.name} <${user.email}> “${subject}” — ${entry.status} via ${entry.provider}`,
        entry.status === "FAILED" ? "warning" : "info",
      );
      return NextResponse.json({ ok: entry.status !== "FAILED", entry });
    }

    default:
      return NextResponse.json({ ok: false, error: "unknown_action", allowed: ["activate", "deactivate", "role", "alert", "email"] }, { status: 422 });
  }
}
