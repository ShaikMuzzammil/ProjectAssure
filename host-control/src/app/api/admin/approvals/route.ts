import { NextResponse } from "next/server";
import { requireHost } from "@/lib/host/auth";
import { audit, getStore, nowIso, saveNow } from "@/lib/host/store";
import { postCommandToMain } from "@/lib/host/sync";

export const dynamic = "force-dynamic";

// POST /api/admin/approvals — decide a REAL derived approval item.
// Approving sends an actual user-alert webhook to the involved user's main-app
// notifications (owner / new account) — that is the live integration.
export async function POST(req: Request) {
  const gate = requireHost(req);
  if (!gate.ok) return gate.res;
  const actor = gate.email;

  let payload: { itemId?: string; decision?: string; note?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const itemId = String(payload.itemId ?? "").trim();
  const decision = payload.decision === "approve" ? "approve" : payload.decision === "reject" ? "reject" : null;
  const note = payload.note ? String(payload.note).slice(0, 500) : undefined;
  if (!itemId || !decision) {
    return NextResponse.json({ ok: false, error: "item_and_decision_required" }, { status: 422 });
  }

  const item = getStore().data.approvals.find((a) => a.id === itemId);
  if (!item) return NextResponse.json({ ok: false, error: "item_not_found" }, { status: 404 });
  if (item.status !== "pending") {
    return NextResponse.json({ ok: false, error: "already_decided", status: item.status }, { status: 409 });
  }

  item.status = decision === "approve" ? "approved" : "rejected";
  item.decidedAt = nowIso();
  item.decidedBy = actor;
  item.note = note;

  let notifyOutcome: { ok: boolean; note: string } = { ok: false, note: "no user to notify" };
  if (decision === "approve") {
    // real integration: user-alert webhook to the owner / the new account
    const target = item.kind === "account-access" ? item.subjectId : item.ownerId;
    if (target) {
      notifyOutcome = await postCommandToMain({
        kind: "user-alert",
        title: approvalNotifyTitle(item.kind),
        message: approvalNotifyMessage(item),
        severity: item.severity,
        audience: target,
        createdBy: `host:${actor}`,
      });
    }
  }

  audit(
    decision === "approve" ? "approval.approved" : "approval.rejected",
    actor,
    `${item.kind} “${item.title}” ${decision === "approve" ? "approved" : "rejected"}${note ? ` — note: ${note}` : ""}${notifyOutcome.ok ? ` · owner notified (${notifyOutcome.note})` : decision === "approve" ? " · owner notification failed" : ""}`,
    decision === "approve" ? "success" : "warning",
  );
  saveNow();

  return NextResponse.json({
    ok: true,
    item,
    notified: notifyOutcome.ok,
    note: notifyOutcome.note,
  });
}

function approvalNotifyTitle(kind: string): string {
  switch (kind) {
    case "project-activation":
      return "Monitoring activated — Host Control";
    case "account-access":
      return "Account access confirmed — Host Control";
    case "budget-escalation":
      return "Budget escalation approved — Host Control";
    default:
      return "Host Control decision";
  }
}

function approvalNotifyMessage(item: { kind: string; title: string; subjectLabel: string; note?: string }): string {
  const noteLine = item.note ? `\nAdministrator note: ${item.note}` : "";
  switch (item.kind) {
    case "project-activation":
      return `Your project ${item.subjectLabel} has been approved for active monitoring by the Central Programme Office. Portfolio dashboards, alerts and milestone tracking are now live for it.${noteLine}`;
    case "account-access":
      return `Your ProjectAssure account access has been confirmed by the Central Programme Office. You retain full platform access.${noteLine}`;
    case "budget-escalation":
      return `The budget escalation for ${item.subjectLabel} was approved by the Central Programme Office. Please upload a variance note and revised cash-flow to the project dossier.${noteLine}`;
    default:
      return `Host Control decision on ${item.subjectLabel}.${noteLine}`;
  }
}
