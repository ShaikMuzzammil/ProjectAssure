import { NextResponse } from "next/server";
import {
  getApprovals, appendApproval, appendAudit, appendActivity, getAdmin,
} from "@/lib/host/store";
import type { ApprovalItem, AuditEntry, ActivityEvent, AuditActionType } from "@/lib/host/types";

// POST /api/admin/approve — record an approval decision in the host-control
// audit log + mirror. Body:
//   { type: "CHANGE_ORDER" | "BUDGET_INCREASE" | "EXTENSION_OF_TIME" | "PROCUREMENT",
//     id: string, decision: "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED",
//     note?: string }
//
// Returns the updated ApprovalItem. Every decision becomes an audit entry
// and an activity ticker event — so the audit trail + dashboard live ticker
// reflect the CPO's actions in real time.
export async function POST(req: Request) {
  let payload: { type?: string; id?: string; decision?: string; note?: string };
  try { payload = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { type, id, decision, note } = payload;
  if (!type || !id || !decision) {
    return NextResponse.json({ error: "missing_fields" }, { status: 422 });
  }
  if (!["APPROVED", "APPROVED_WITH_CONDITIONS", "REJECTED"].includes(decision)) {
    return NextResponse.json({ error: "invalid_decision" }, { status: 422 });
  }

  const approvals = getApprovals();
  const idx = approvals.findIndex(a => a.id === id && a.type === type);
  if (idx < 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const existing = approvals[idx];
  const admin = getAdmin();

  const updated: ApprovalItem = {
    ...existing,
    status: decision as ApprovalItem["status"],
    decidedAt: new Date().toISOString(),
    decidedBy: admin.name,
    decisionNote: note ?? undefined,
  };
  appendApproval(updated);

  const actionMap: Record<string, AuditActionType> = {
    APPROVED: "APPROVE",
    APPROVED_WITH_CONDITIONS: "APPROVE_WITH_CONDITIONS",
    REJECTED: "REJECT",
  };
  const audit: AuditEntry = {
    id: `au-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    admin: admin.name,
    action: actionMap[decision],
    target: `${type} ${id} · ${existing.projectName}`,
    note: note ?? undefined,
    category: type,
  };
  appendAudit(audit);

  const activity: ActivityEvent = {
    id: `ev-${Date.now()}`,
    timestamp: new Date().toISOString(),
    kind: "approval",
    message: `${decision.replace("_", " ").toLowerCase()} · ${type.replace("_", " ").toLowerCase()} ${id} — ${existing.projectName}`,
    projectName: existing.projectName,
  };
  appendActivity(activity);

  return NextResponse.json({ ok: true, approval: updated, audit });
}
