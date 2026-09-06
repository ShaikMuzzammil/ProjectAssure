"use client";
import React, { useState } from "react";
import { useAdminStore } from "@/store/admin-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Send, Inbox, FileText, User } from "lucide-react";
import { toast } from "sonner";
import { relTime } from "@/lib/host/format";

// v21: Email Centre — compose + outbox + per-user history + template library.
// Templates pre-fill the compose form to make admin comms one-click.

const TEMPLATES: { key: string; label: string; subject: string; body: string }[] = [
  {
    key: "CRITICAL_ALERT",
    label: "Critical alert",
    subject: "[Action required] Critical project alert — needs your review",
    body: "Hello {{name}},\n\nA critical alert has been raised on one of your projects. Please review the alert details in the ProjectAssure host-control plane and submit a recovery plan within the recommended deadline.\n\nRegards,\nProjectAssure Host Control",
  },
  {
    key: "WELCOME",
    label: "Welcome",
    subject: "Welcome to ProjectAssure Host Control",
    body: "Hello {{name}},\n\nYour registration was received and your account is now ACTIVE. You can access the host-control plane and your assigned projects immediately.\n\nRegards,\nProjectAssure Host Control",
  },
  {
    key: "BUDGET_WARNING",
    label: "Budget warning",
    subject: "Budget utilisation crossed 80% — review required",
    body: "Hello {{name}},\n\nYour portfolio's budget utilisation has crossed 80%. Please review the spending breakdown and confirm whether the projected outturn is justified.\n\nRegards,\nProjectAssure Host Control",
  },
  {
    key: "SUSPENSION_NOTICE",
    label: "Suspension notice",
    subject: "Account suspended — action required",
    body: "Hello {{name}},\n\nYour account has been suspended due to access-policy violation. Please contact the Chief Programme Officer to begin the reactivation process.\n\nRegards,\nProjectAssure Host Control",
  },
  {
    key: "REACTIVATION_NOTICE",
    label: "Reactivation notice",
    subject: "Account reactivated — access restored",
    body: "Hello {{name}},\n\nYour account has been reactivated. You can resume accessing the host-control plane with your existing credentials.\n\nRegards,\nProjectAssure Host Control",
  },
  {
    key: "WEEKLY_DIGEST",
    label: "Weekly digest",
    subject: "ProjectAssure weekly portfolio digest",
    body: "Hello {{name}},\n\nHere is your weekly portfolio digest. Please review the open alerts and pending approvals in your host-control dashboard.\n\nRegards,\nProjectAssure Host Control",
  },
];

export function EmailCentre() {
  const { users, emails } = useAdminStore();
  const [tab, setTab] = useState<"compose" | "outbox" | "history">("compose");
  const [toUserId, setToUserId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachReport, setAttachReport] = useState(false);
  const [historyUserId, setHistoryUserId] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!toUserId || !subject.trim() || !body.trim()) {
      toast.error("Pick a recipient, subject and body");
      return;
    }
    setSending(true);
    try {
      const r = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: toUserId, subject, body, by: "CPO" }),
      });
      const j = await r.json();
      if (j.ok) {
        toast.success(j.email?.status === "SENT" ? "Email sent via SMTP" : "Email queued (simulated)", {
          description: `→ ${j.email.toEmail}`,
        });
        setSubject("");
        setBody("");
        setToUserId("");
        setAttachReport(false);
        const sync = await fetch("/api/admin/sync");
        useAdminStore.getState().hydrate(await sync.json());
      } else {
        toast.error(j.error || "Send failed");
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setSending(false);
    }
  };

  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    const u = users.find((x) => x.id === toUserId);
    const name = u?.name ?? "user";
    setSubject(t.subject);
    setBody(t.body.replace(/\{\{name\}\}/g, name));
  };

  const history = historyUserId ? emails.filter((e) => e.toUserId === historyUserId) : emails;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Email Centre</h2>
        <p className="text-xs text-slate-500">
          Compose and dispatch emails to any registered user. Without SMTP configured, emails are queued as SIMULATED.
        </p>
      </div>

      <div className="flex gap-1.5">
        {(
          [
            ["compose", "Compose", Mail],
            ["outbox", `Outbox (${emails.length})`, Inbox],
            ["history", "Per-user history", User],
          ] as ["compose" | "outbox" | "history", string, React.ElementType][]
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition",
              tab === key ? "bg-[#0b426e] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "compose" && (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          {/* Compose form */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <label className="text-[11px] font-semibold">To *</label>
              <select
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0c93e7]"
              >
                <option value="">Select recipient…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold">Subject *</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-[11px] font-semibold">Body *</label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="mt-1 min-h-32" />
            </div>
            <label className="flex items-center gap-2 text-[11px] font-semibold">
              <input type="checkbox" checked={attachReport} onChange={(e) => setAttachReport(e.target.checked)} />
              <FileText className="h-3.5 w-3.5" /> Attach portfolio report
            </label>
            <div className="flex justify-end">
              <Button onClick={send} disabled={sending || !toUserId || !subject.trim() || !body.trim()}>
                <Send className="h-3.5 w-3.5" /> {sending ? "Sending…" : "Send email"}
              </Button>
            </div>
          </div>

          {/* Template library */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-bold">Template library</h3>
            <p className="mt-0.5 text-[10px] text-slate-500">One-click templates. Use <code>{"{{name}}"}</code> for personalisation.</p>
            <div className="mt-3 space-y-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => applyTemplate(t)}
                  className="block w-full rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold hover:border-[#0c93e7]/40 hover:bg-blue-50"
                >
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3 w-3 text-[#0c93e7]" />
                    {t.label}
                  </div>
                  <div className="mt-0.5 truncate text-[9px] text-slate-500">{t.subject}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "outbox" && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-4">
            <h3 className="text-sm font-bold">Outbox — last 20 emails sent from host-control</h3>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {emails.length === 0 && (
              <div className="py-16 text-center text-sm text-slate-400">
                <Inbox className="mx-auto mb-2 h-10 w-10 opacity-30" />
                No emails sent yet
              </div>
            )}
            {emails.slice(0, 20).map((e) => (
              <div key={e.id} className="border-b border-slate-100 p-3 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[9px] font-bold",
                      e.status === "SENT"
                        ? "bg-emerald-100 text-emerald-700"
                        : e.status === "SIMULATED"
                          ? "bg-amber-100 text-amber-700"
                          : e.status === "FAILED"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-slate-100 text-slate-700",
                    )}
                  >
                    {e.status}
                  </span>
                  {e.template && (
                    <span className="rounded-full bg-[#e0effe] px-2 py-0.5 text-[9px] font-bold text-[#015ca0]">{e.template}</span>
                  )}
                  <span className="text-xs font-bold">{e.subject}</span>
                  <span className="ml-auto text-[9px] text-slate-500">{relTime(e.sentAt)}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500">
                  → <span className="font-semibold">{e.toName}</span> <span className="font-mono">&lt;{e.toEmail}&gt;</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[10px] text-slate-600">{e.body}</p>
                {e.error && <div className="mt-1 text-[9px] text-rose-600">Error: {e.error}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h3 className="text-sm font-bold">Per-user email history</h3>
            <div className="w-full max-w-xs">
              <select
                value={historyUserId}
                onChange={(e) => setHistoryUserId(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0c93e7]"
              >
                <option value="">All users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {history.length === 0 && (
              <div className="py-12 text-center text-[11px] text-slate-400">No emails for this user</div>
            )}
            {history.slice(0, 30).map((e) => (
              <div key={e.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[9px] font-bold",
                      e.status === "SENT"
                        ? "bg-emerald-100 text-emerald-700"
                        : e.status === "SIMULATED"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-700",
                    )}
                  >
                    {e.status}
                  </span>
                  <span className="text-[11px] font-bold">{e.subject}</span>
                  <span className="ml-auto text-[9px] text-slate-500">{relTime(e.sentAt)}</span>
                </div>
                <div className="mt-0.5 text-[9px] text-slate-500">
                  To: {e.toName} &lt;{e.toEmail}&gt;
                </div>
                <p className="mt-1 line-clamp-3 text-[10px] text-slate-600">{e.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
