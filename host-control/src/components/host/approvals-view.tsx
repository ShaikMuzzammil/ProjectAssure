"use client";

// v23 — Approvals Centre — REAL items derived from main-app activity:
//   · new projects  → "New project monitoring activation"
//   · new users     → "Account access approval"
//   · budget breaches (> threshold %) → "Budget escalation"
// Nothing is seeded. Approving sends a live user-alert webhook to the
// involved user's main-app notifications.
//
// v23 — Rejecting now takes an explicit rejectAction:
//   · notify-only       : reject the approval, entity stays untouched
//   · reject-project    : cancel the project in the main app (project-activation)
//   · disband-account   : deactivate the user's account in the main app (account-access)
//   · block-budget      : freeze further spend (budget-escalation)
// Each kind surfaces its allowed actions as buttons in a small popover.

import { useMemo, useState } from "react";
import { Ban, Check, ClipboardCheck, Info, Inbox, Mail, ShieldOff, Snowflake, X } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, EmptyState, Input, PageIntro, severityTone } from "./ui";
import { fmtDateTime, relTime } from "@/lib/host/format";
import type { ApprovalItem, HostStateResponse, RejectAction } from "@/lib/host/types";
import type { ViewProps } from "./view-props";

const KIND_META: Record<ApprovalItem["kind"], { label: string; tone: "sky" | "green" | "orange"; icon: React.ReactNode }> = {
  "project-activation": { label: "New project activation", tone: "sky", icon: <ClipboardCheck className="h-3 w-3" /> },
  "account-access": { label: "Account access", tone: "green", icon: <Info className="h-3 w-3" /> },
  "budget-escalation": { label: "Budget escalation", tone: "orange", icon: <Info className="h-3 w-3" /> },
};

// v23 — the reject actions each kind allows. Mirrors the server's
// ALLOWED_REJECT_BY_KIND map (kept in sync by hand to keep the UI honest).
const REJECT_OPTIONS: Record<ApprovalItem["kind"], { value: RejectAction; label: string; blurb: string; icon: React.ReactNode; tone: "danger" | "warn" }[]> = {
  "project-activation": [
    { value: "notify-only", label: "Reject only", blurb: "Project stays in the user's workspace but won't appear in host dashboards.", icon: <X className="h-3.5 w-3.5" />, tone: "warn" },
    { value: "reject-project", label: "Reject & cancel project", blurb: "Send a webhook to the main app to CANCEL the project entirely. The owner is notified.", icon: <Ban className="h-3.5 w-3.5" />, tone: "danger" },
  ],
  "account-access": [
    { value: "notify-only", label: "Reject only", blurb: "Account stays active in the main app. The user is notified the access approval was rejected.", icon: <X className="h-3.5 w-3.5" />, tone: "warn" },
    { value: "disband-account", label: "Disband account entirely", blurb: "Send a webhook to deactivate the account, block all future logins, and email the user. IRREVERSIBLE.", icon: <ShieldOff className="h-3.5 w-3.5" />, tone: "danger" },
  ],
  "budget-escalation": [
    { value: "notify-only", label: "Reject only", blurb: "The escalation is denied; spend continues. The owner is asked to revise the plan.", icon: <X className="h-3.5 w-3.5" />, tone: "warn" },
    { value: "block-budget", label: "Reject & freeze spend", blurb: "Send a webhook to FREEZE further spend on this project until the host lifts the freeze.", icon: <Snowflake className="h-3.5 w-3.5" />, tone: "danger" },
  ],
};

export function ApprovalsView({ state, refresh }: ViewProps) {
  const [tab, setTab] = useState<"pending" | "decided">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  // v23 — the chosen reject action per item id (null = show the chooser)
  const [rejectChoice, setRejectChoice] = useState<Record<string, RejectAction>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const pending = useMemo(() => state.approvals.filter((a) => a.status === "pending"), [state.approvals]);
  const decided = useMemo(
    () => state.approvals.filter((a) => a.status !== "pending").sort((a, b) => Date.parse(b.decidedAt ?? b.createdAt) - Date.parse(a.decidedAt ?? a.createdAt)),
    [state.approvals],
  );
  const list = tab === "pending" ? pending : decided;

  async function decide(item: ApprovalItem, decision: "approve" | "reject", rejectAction?: RejectAction) {
    setBusy(item.id);
    try {
      const res = await fetch("/api/admin/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, decision, note: notes[item.id] ?? "", rejectAction: rejectAction ?? "notify-only" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        notified?: boolean;
        note?: string;
        action?: { name: RejectAction; delivered: boolean; note: string };
        error?: string;
        hint?: string;
      };
      if (res.ok && data.ok) {
        if (decision === "approve") {
          toast.success("Approved", {
            description: data.notified
              ? `Owner notified via main-app webhook — ${data.note}`
              : "Approved. Owner notification could not be queued (main app unreachable) — it was NOT delivered.",
          });
        } else {
          const action = data.action;
          if (!action || action.name === "notify-only") {
            toast("Rejected", { description: "Decision recorded in the audit trail. The entity stays untouched." });
          } else {
            if (action.delivered) {
              toast.success(`${actionLabel(action.name)} — delivered`, {
                description: `Main app received the webhook (${action.note}). The user has been notified.`,
              });
            } else {
              toast.error(`${actionLabel(action.name)} — delivery FAILED`, {
                description: `${action.note} — the decision is still recorded in the audit trail.`,
              });
            }
          }
        }
        setNotes((n) => {
          const next = { ...n };
          delete next[item.id];
          return next;
        });
        setRejectChoice((rc) => {
          const next = { ...rc };
          delete next[item.id];
          return next;
        });
        await refresh(true);
      } else {
        toast.error("Decision failed", { description: data.hint ?? data.error ?? `HTTP ${res.status}` });
      }
    } catch (e) {
      toast.error("Decision failed", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageIntro
        title="Approvals Centre"
        description="Items are derived from REAL sync data — the first mirror baselines existing records, then any new project, new account or budget breach in the main app surfaces here automatically. Approvals notify the owner in their main-app notifications within ~20 seconds. v23: rejecting offers a follow-up action — cancel the project, disband the account, or freeze the budget — each delivered as a real webhook to the main app."
      />

      <div className="flex items-center gap-2">
        <TabBtn active={tab === "pending"} onClick={() => setTab("pending")} label="Pending" count={pending.length} />
        <TabBtn active={tab === "decided"} onClick={() => setTab("decided")} label="Decided" count={decided.length} />
      </div>

      {list.length === 0 ? (
        tab === "pending" ? (
          <EmptyState
            icon={<Inbox className="h-8 w-8" />}
            title="No approvals pending"
            hint="Create a project or an account in the main app and it appears here within seconds. Budget escalations appear when a project's spend exceeds its sanctioned budget by more than the configured threshold (Settings → budget threshold)."
          />
        ) : (
          <EmptyState icon={<ClipboardCheck className="h-8 w-8" />} title="No decisions yet" hint="Approved and rejected items will be listed here with their notes and reject actions." />
        )
      ) : (
        <div className="space-y-3">
          {list.map((item) => {
            const meta = KIND_META[item.kind];
            return (
              <Card key={item.id} className="overflow-hidden">
                <div className="flex flex-wrap items-start gap-2 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
                  <Badge tone={meta.tone}>
                    {meta.icon} {meta.label}
                  </Badge>
                  <Badge tone={severityTone(item.severity)}>{item.severity}</Badge>
                  <span className="ml-auto text-[10px] text-slate-400">
                    surfaced {relTime(item.createdAt)} · {fmtDateTime(item.createdAt)}
                  </span>
                </div>
                <div className="px-5 py-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{item.description}</p>
                  <p className="mt-2 font-mono text-[10px] text-slate-400">{item.subjectLabel}</p>

                  {item.status === "pending" ? (
                    <div className="mt-4 space-y-2.5">
                      <Input
                        value={notes[item.id] ?? ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [item.id]: e.target.value }))}
                        placeholder="Optional decision note (recorded in the audit trail + owner notification)"
                        aria-label={`Note for ${item.title}`}
                      />

                      {/* v23 — Reject chooser. The admin picks the action that
                          should follow the rejection. The "Reject" button is
                          disabled until they choose. */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                        <p className="mb-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                          If you reject, what should happen?
                        </p>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {REJECT_OPTIONS[item.kind].map((opt) => {
                            const chosen = rejectChoice[item.id] === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setRejectChoice((rc) => ({ ...rc, [item.id]: opt.value }))}
                                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition ${
                                  chosen
                                    ? opt.tone === "danger"
                                      ? "border-rose-500 bg-rose-50 dark:bg-rose-500/10"
                                      : "border-amber-500 bg-amber-50 dark:bg-amber-500/10"
                                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                                }`}
                              >
                                <span className={`mt-0.5 shrink-0 ${opt.tone === "danger" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`}>
                                  {opt.icon}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-[11.5px] font-bold leading-tight text-slate-900 dark:text-slate-100">{opt.label}</p>
                                  <p className="mt-0.5 text-[10.5px] leading-snug text-slate-500 dark:text-slate-400">{opt.blurb}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="success" loading={busy === item.id} onClick={() => void decide(item, "approve")}>
                          <Check className="h-3.5 w-3.5" /> Approve {item.kind === "project-activation" ? "monitoring" : item.kind === "account-access" ? "access" : "escalation"}
                        </Button>
                        <Button
                          size="sm"
                          variant={rejectChoice[item.id] === "disband-account" || rejectChoice[item.id] === "reject-project" || rejectChoice[item.id] === "block-budget" ? "danger" : "warn"}
                          loading={busy === item.id}
                          disabled={!rejectChoice[item.id]}
                          onClick={() => void decide(item, "reject", rejectChoice[item.id])}
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject {rejectChoice[item.id] ? `· ${actionLabel(rejectChoice[item.id])}` : "(pick an action above)"}
                        </Button>
                        <span className="text-[10px] text-slate-400">approving queues a real user-alert; rejecting can also fire a host-message webhook</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={item.status === "approved" ? "green" : "red"}>{item.status}</Badge>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          by {item.decidedBy ?? "—"} · {item.decidedAt ? fmtDateTime(item.decidedAt) : "—"}
                        </span>
                        {item.rejectAction && item.rejectAction !== "notify-only" ? (
                          <Badge tone={item.rejectActionDelivered ? "red" : "amber"}>
                            {actionLabel(item.rejectAction)} · {item.rejectActionDelivered ? "delivered" : "FAILED"}
                          </Badge>
                        ) : null}
                      </div>
                      {item.note ? <p className="w-full text-[11px] italic text-slate-500 dark:text-slate-400">“{item.note}”</p> : null}
                      {item.rejectActionNote ? (
                        <p className="text-[10.5px] text-slate-400 dark:text-slate-500">{item.rejectActionNote}</p>
                      ) : null}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <HonestyNote state={state} />
    </div>
  );
}

function actionLabel(action: RejectAction): string {
  switch (action) {
    case "notify-only":
      return "notify only";
    case "reject-project":
      return "cancel project";
    case "disband-account":
      return "disband account";
    case "block-budget":
      return "freeze spend";
    default:
      return action;
  }
}

function HonestyNote({ state }: { state: HostStateResponse }) {
  const approved = state.approvals.filter((a) => a.status === "approved").length;
  const rejected = state.approvals.filter((a) => a.status === "rejected").length;
  const disbanded = state.approvals.filter((a) => a.rejectAction === "disband-account").length;
  return (
    <Card>
      <div className="px-5 py-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        <p className="font-semibold text-slate-700 dark:text-slate-200">How this stays honest</p>
        <p className="mt-1">
          Decisions live in the host store (persisted locally via <code className="font-mono">.host-store.json</code>, in-memory on Vercel) and are append-only in the Audit Trail.
          Approvals and reject-with-action both send <strong>real webhooks</strong> to the main app — when it is unreachable the decision is still recorded and the UI tells you delivery failed.
          Disbanding an account also emails the user a clear notification.
        </p>
        <p className="mt-1">
          Session totals: {approved} approved · {rejected} rejected · {disbanded} accounts disbanded · threshold {state.settings.budgetThresholdPct}% budget overrun.
        </p>
      </div>
    </Card>
  );
}

function TabBtn({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
        active ? "bg-[#072b49] text-white" : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      {label} <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"}`}>{count}</span>
    </button>
  );
}
