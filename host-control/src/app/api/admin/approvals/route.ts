import { NextResponse } from "next/server";
import { requireHost, adminEmail } from "@/lib/host/auth";
import { audit, getStore, nowIso, saveNow } from "@/lib/host/store";
import { postCommandToMain } from "@/lib/host/sync";
import { sendHostEmail } from "@/lib/host/mailer";
import type { ApprovalItem, RejectAction } from "@/lib/host/types";

export const dynamic = "force-dynamic";

// v23 — POST /api/admin/approvals — decide a REAL derived approval item.
//
// Approving sends an actual user-alert webhook to the involved user's main-app
// notifications (owner / new account) — that is the live integration.
//
// Rejecting now also takes a `rejectAction`:
//   - "notify-only"      : reject the approval but the entity stays untouched (default)
//   - "reject-project"   : for project-activation — send a webhook to cancel the project
//   - "disband-account"  : for account-access — send a webhook to deactivate the account
//                          AND email the user that their account has been disbanded
//   - "block-budget"     : for budget-escalation — send a webhook to freeze further spend
//
// Each kind validates its allowed rejectAction; sending an unknown or
// mismatched action returns 422. The main app receives a real webhook with
// the kind `host-message` + a structured payload so its sync handler can
// act on it (the main app's /api/sync/webhook will route it through).

const ALLOWED_REJECT_BY_KIND: Record<ApprovalItem["kind"], RejectAction[]> = {
  "project-activation": ["notify-only", "reject-project"],
  "account-access": ["notify-only", "disband-account"],
  "budget-escalation": ["notify-only", "block-budget"],
};

export async function POST(req: Request) {
  const gate = requireHost(req);
  if (!gate.ok) return gate.res;
  const actor = gate.email;

  let payload: { itemId?: string; decision?: string; note?: string; rejectAction?: string };
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

  // Parse the reject action — default to "notify-only" so the v21 API stays
  // backwards compatible (clients that don't send the field still work).
  const requestedAction = String(payload.rejectAction ?? "notify-only") as RejectAction;
  if (!["notify-only", "reject-project", "disband-account", "block-budget"].includes(requestedAction)) {
    return NextResponse.json({ ok: false, error: "invalid_reject_action" }, { status: 422 });
  }

  const item = getStore().data.approvals.find((a) => a.id === itemId);
  if (!item) return NextResponse.json({ ok: false, error: "item_not_found" }, { status: 404 });
  if (item.status !== "pending") {
    return NextResponse.json({ ok: false, error: "already_decided", status: item.status }, { status: 409 });
  }

  // Validate reject action against the kind
  if (decision === "reject") {
    const allowed = ALLOWED_REJECT_BY_KIND[item.kind];
    if (!allowed.includes(requestedAction)) {
      return NextResponse.json({
        ok: false,
        error: "reject_action_not_allowed_for_kind",
        hint: `Kind "${item.kind}" allows: ${allowed.join(", ")}`,
      }, { status: 422 });
    }
  }

  item.status = decision === "approve" ? "approved" : "rejected";
  item.decidedAt = nowIso();
  item.decidedBy = actor;
  item.note = note;

  let notifyOutcome: { ok: boolean; note: string } = { ok: false, note: "no user to notify" };
  let actionOutcome: { ok: boolean; note: string } = { ok: false, note: "no action requested" };

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
  } else {
    // v23 — REJECT path. Set the chosen action on the item.
    item.rejectAction = requestedAction;

    if (requestedAction === "notify-only") {
      // The classic v21 behaviour: reject the approval, no entity-side effect.
      // The owner is notified so they know the approval was rejected.
      const target = item.kind === "account-access" ? item.subjectId : item.ownerId;
      if (target) {
        notifyOutcome = await postCommandToMain({
          kind: "user-alert",
          title: `${approvalNotifyTitle(item.kind)} — not approved`,
          message: rejectionNotifyMessage(item),
          severity: "warning",
          audience: target,
          createdBy: `host:${actor}`,
        });
      }
      actionOutcome = { ok: true, note: "no entity action taken (notify-only)" };
    } else {
      // v23 — the host wants the main app to do something to the entity.
      // Send a host-message webhook with the structured action payload. The
      // main app's /api/sync/webhook handler routes host-message events to
      // the appropriate entity action (cancel project / deactivate user /
      // freeze budget).
      const actionTitle = rejectActionTitle(item.kind, requestedAction);
      const actionMessage = rejectActionMessage(item, requestedAction, note);
      const target = item.kind === "account-access" ? item.subjectId : item.ownerId;
      actionOutcome = await postCommandToMain({
        kind: "host-message",
        title: actionTitle,
        message: actionMessage,
        severity: "critical",
        linkView: "alerts",
        audience: target ?? "all",
        createdBy: `host:${actor}`,
      });
      item.rejectActionDelivered = actionOutcome.ok;
      item.rejectActionNote = actionOutcome.note;

      // v23 — when disbanded, also email the user a clear notification
      // (this is the user-facing side of the action).
      if (requestedAction === "disband-account" && item.subjectLabel.includes("@")) {
        // subjectLabel is "<name> · <email>" — extract the email
        const email = item.subjectLabel.split("·").pop()?.trim() ?? "";
        if (email && /\S+@\S+\.\S+/.test(email)) {
          void sendHostEmail({
            to: email,
            subject: "ProjectAssure — account access revoked",
            body: disbandEmailBody(item.subjectLabel.split("·")[0].trim(), note),
            kind: "disband",
          }).catch(() => null);
        }
        // also notify the host admin inbox
        void sendHostEmail({
          to: adminEmail(),
          subject: `Account disbanded: ${item.subjectLabel}`,
          body: `The host administrator ${actor} disbanded account ${item.subjectLabel} via the Approvals Centre.\n\nReason: ${note ?? "(no note provided)"}\n\nThe main app has been instructed to deactivate this account. The user can no longer sign in.`,
          kind: "disband",
        }).catch(() => null);
      }
    }
  }

  audit(
    decision === "approve" ? "approval.approved" : "approval.rejected",
    actor,
    `${item.kind} “${item.title}” ${decision === "approve" ? "approved" : `rejected (${requestedAction})`}${note ? ` — note: ${note}` : ""}${notifyOutcome.ok ? ` · owner notified (${notifyOutcome.note})` : decision === "approve" ? " · owner notification failed" : ""}${requestedAction !== "notify-only" ? ` · action: ${actionOutcome.ok ? "delivered" : "FAILED"} (${actionOutcome.note})` : ""}`,
    decision === "approve" ? "success" : (requestedAction === "disband-account" || requestedAction === "reject-project" ? "critical" : "warning"),
  );
  saveNow();

  return NextResponse.json({
    ok: true,
    item,
    notified: notifyOutcome.ok,
    note: notifyOutcome.note,
    action: decision === "reject" ? { name: requestedAction, delivered: actionOutcome.ok, note: actionOutcome.note } : null,
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

function rejectionNotifyMessage(item: { kind: string; title: string; subjectLabel: string; note?: string }): string {
  const noteLine = item.note ? `\nAdministrator note: ${item.note}` : "";
  switch (item.kind) {
    case "project-activation":
      return `Your project ${item.subjectLabel} was NOT approved for active monitoring by the Central Programme Office. The project stays in your workspace but will not appear in the host portfolio dashboards. Please contact the CPO if you believe this was in error.${noteLine}`;
    case "account-access":
      return `Your ProjectAssure account access approval was rejected by the Central Programme Office. Your account stays active in the main app — please contact the CPO for clarification.${noteLine}`;
    case "budget-escalation":
      return `The budget escalation for ${item.subjectLabel} was not approved by the Central Programme Office. Please revise the spend plan and re-submit if needed.${noteLine}`;
    default:
      return `Host Control rejected the approval on ${item.subjectLabel}.${noteLine}`;
  }
}

function rejectActionTitle(kind: string, action: RejectAction): string {
  if (action === "reject-project") return "Project rejected by Host Control — cancel project";
  if (action === "disband-account") return "Account disbanded by Host Control — deactivate user";
  if (action === "block-budget") return "Budget escalation rejected — freeze further spend";
  return "Host Control rejection";
}

function rejectActionMessage(item: { kind: string; subjectId: string; subjectLabel: string; ownerId?: string; note?: string }, action: RejectAction, note?: string): string {
  const noteLine = note ? `\nAdministrator note: ${note}` : "";
  const target = item.kind === "account-access" ? item.subjectId : item.ownerId ?? item.subjectId;
  if (action === "reject-project") {
    return `Host Control rejected the new project ${item.subjectLabel} and instructed the main app to CANCEL it. Project ID: ${item.subjectId}. Owner: ${item.ownerId ?? "—"}. The owner's workspace will be updated to reflect the cancellation.${noteLine}`;
  }
  if (action === "disband-account") {
    return `Host Control DISBANDED the account ${item.subjectLabel}. User ID: ${target}. The main app should deactivate this account immediately: set isActive=false on the user record and block any future login attempts. A notification email has been sent to the user.${noteLine}`;
  }
  if (action === "block-budget") {
    return `Host Control rejected the budget escalation for ${item.subjectLabel} and instructed the main app to FREEZE further spend on this project. Project ID: ${item.subjectId}. No new budget records should be accepted until the freeze is lifted by the host.${noteLine}`;
  }
  return `Host Control rejected the approval on ${item.subjectLabel}.${noteLine}`;
}

function disbandEmailBody(name: string, note?: string): string {
  return `Hello ${name},\n\nYour ProjectAssure account access has been revoked by the Central Programme Office following a Host Control review.${note ? `\nReason: ${note}\n` : "\n"}You can no longer sign in to the platform. If you believe this was in error, please contact the Central Programme Office directly.\n\n— ProjectAssure Host Control`;
}
