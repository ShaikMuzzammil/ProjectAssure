import { NextResponse } from "next/server";
import { requireHost } from "@/lib/host/auth";
import { audit, getStore, nowIso, saveNow } from "@/lib/host/store";
import { postCommandToMain } from "@/lib/host/sync";
import type { ApprovalItem } from "@/lib/host/types";

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
  // v23: the decision flows back to the requester as a REAL project-state
  // update command — the main app applies it within seconds and the user
  // sees the approved/rejected state on their project + evidence + docs.
  if (decision === "approve" || decision === "reject") {
    const target = item.kind === "account-access" ? item.subjectId : item.ownerId;
    const isProjectScoped = ["project-activation", "document-review", "evidence-verification", "ai-request", "budget-escalation"].includes(item.kind);
    if (target) {
      const kindByDecision = commandKindFor(item.kind, decision === "approve");
      notifyOutcome = await postCommandToMain({
        kind: kindByDecision,
        title: approvalNotifyTitle(item.kind, decision === "approve"),
        message: approvalNotifyMessage(item, decision === "approve"),
        severity: decision === "approve" ? item.severity : "warning",
        linkView: isProjectScoped ? "project-detail" : "alerts",
        linkProjectId: isProjectScoped ? item.subjectId : undefined,
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

function commandKindFor(kind: ApprovalItem["kind"], approve: boolean): "user-alert" | "project-approved" | "project-rejected" | "document-reviewed" | "evidence-reviewed" | "ai-request-resolved" {
  switch (kind) {
    case "project-activation":
      return approve ? "project-approved" : "project-rejected";
    case "document-review":
      return "document-reviewed";
    case "evidence-verification":
      return "evidence-reviewed";
    case "ai-request":
      return "ai-request-resolved";
    case "budget-escalation":
      return approve ? "project-approved" : "project-rejected";
    default:
      return "user-alert";
  }
}

function approvalNotifyTitle(kind: string, approve: boolean): string {
  const s = approve ? "approved" : "rejected";
  switch (kind) {
    case "project-activation":
      return approve ? "Monitoring activated — Host Control" : "Project activation rejected — Host Control";
    case "account-access":
      return approve ? "Account access confirmed — Host Control" : "Account access rejected — Host Control";
    case "budget-escalation":
      return `Budget escalation ${s} — Host Control`;
    case "document-review":
      return `Document submission ${s} — Host Control`;
    case "evidence-verification":
      return `Site evidence ${s} — Host Control`;
    case "ai-request":
      return `Intelligence request ${s} — Host Control`;
    default:
      return "Host Control decision";
  }
}

function approvalNotifyMessage(item: { kind: string; title: string; subjectLabel: string; note?: string }, approve: boolean): string {
  const noteLine = item.note ? `\nAdministrator note: ${item.note}` : "";
  const outcome = approve ? "approved" : "rejected";
  switch (item.kind) {
    case "project-activation":
      return approve
        ? `Your project ${item.subjectLabel} has been approved for active monitoring by the Central Programme Office. Portfolio dashboards, alerts and milestone tracking are now live for it.${noteLine}`
        : `Your project ${item.subjectLabel} was not approved by the Central Programme Office. It remains in your workspace with monitoring paused — see the administrator note and resubmit when ready.${noteLine}`;
    case "account-access":
      return `Your ProjectAssure account access has been ${outcome} by the Central Programme Office.${noteLine}`;
    case "budget-escalation":
      return `The budget escalation for ${item.subjectLabel} was ${outcome} by the Central Programme Office.${noteLine}`;
    case "document-review":
      return `Your document submission for ${item.subjectLabel} was ${outcome} by the Central Programme Office.${noteLine}`;
    case "evidence-verification":
      return `The site evidence for ${item.subjectLabel} was ${outcome} by the Central Programme Office.${noteLine}`;
    case "ai-request":
      return `Your intelligence request (${item.subjectLabel}) was ${outcome} by the Central Programme Office.${noteLine}`;
    default:
      return `Host Control decision on ${item.subjectLabel}.${noteLine}`;
  }
}
