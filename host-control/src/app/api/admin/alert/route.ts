import { NextResponse } from "next/server";
import { appendAlert, appendAudit, appendActivity, getAdmin, getProjects } from "@/lib/host/store";
import type { AlertItem, AuditEntry, ActivityEvent } from "@/lib/host/types";
import { ANCHOR } from "@/lib/host/seed";
import { nextId } from "@/lib/utils";

// POST /api/admin/alert — broadcast a custom alert to ALL projects/users.
// Body:
//   { title: string, description: string, severity: "CRITICAL"|"HIGH"|"MEDIUM"|"LOW",
//     recommendedAction: string, deadline?: ISO string }
//
// Creates one alert per project in the portfolio (so every dashboard feed
// shows the broadcast), appends an audit entry, and pushes an activity
// ticker event. Returns the count of alerts created.
export async function POST(req: Request) {
  let payload: any;
  try { payload = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { title, description, severity, recommendedAction, deadline } = payload;
  if (!title || !description || !severity) {
    return NextResponse.json({ error: "missing_fields" }, { status: 422 });
  }
  if (!["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(severity)) {
    return NextResponse.json({ error: "invalid_severity" }, { status: 422 });
  }

  const admin = getAdmin();
  const projects = getProjects();
  const ts = new Date().toISOString();
  const created: AlertItem[] = [];

  for (const p of projects) {
    const alert: AlertItem = {
      id: nextId("al"),
      projectId: p.id,
      projectName: p.name,
      title,
      description,
      severity,
      type: "BROADCAST",
      recommendedAction: recommendedAction ?? "Review and acknowledge on the project dashboard",
      recommendedOwner: p.projectManager,
      recommendedDeadline: deadline ?? new Date(Date.now() + 7 * 86400000).toISOString(),
      isRead: false,
      departmentId: p.departmentId,
      source: "DEMO",
      createdAt: ts,
    };
    appendAlert(alert);
    created.push(alert);
  }

  const audit: AuditEntry = {
    id: nextId("au"),
    timestamp: ts,
    admin: admin.name,
    action: "BROADCAST_ALERT",
    target: `All ${projects.length} projects · ${severity}`,
    note: title,
    category: "ALERT",
  };
  appendAudit(audit);

  const activity: ActivityEvent = {
    id: nextId("ev"),
    timestamp: ts,
    kind: "alert",
    message: `Broadcast alert "${title}" sent to ${projects.length} projects (${severity})`,
    severity,
  };
  appendActivity(activity);

  return NextResponse.json({ ok: true, count: created.length, audit });
}

export { ANCHOR };
