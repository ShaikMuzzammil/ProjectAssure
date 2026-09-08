"use client";

// Approvals Centre — REAL items derived from main-app activity:
//   · new projects  → "New project monitoring activation"
//   · new users     → "Account access approval"
//   · budget breaches (> threshold %) → "Budget escalation"
//   · v23: document submissions, site evidence, AI/intelligence requests
// Deciding sends a live command back — the main app updates the project
// state and notifies the requester within seconds.

import { useMemo, useState } from "react";
import { Check, ClipboardCheck, FileText, Info, Inbox, MapPin, Send, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, EmptyState, Input, PageIntro, severityTone } from "./ui";
import { fmtDateTime, relTime } from "@/lib/host/format";
import type { ApprovalItem, HostStateResponse } from "@/lib/host/types";
import type { ViewProps } from "./view-props";

const KIND_META: Record<ApprovalItem["kind"], { label: string; tone: "sky" | "green" | "orange" | "violet"; icon: React.ReactNode }> = {
  "project-activation": { label: "New project activation", tone: "sky", icon: <ClipboardCheck className="h-3 w-3" /> },
  "account-access": { label: "Account access", tone: "green", icon: <ShieldCheck className="h-3 w-3" /> },
  "budget-escalation": { label: "Budget escalation", tone: "orange", icon: <Info className="h-3 w-3" /> },
  "document-review": { label: "Document submission", tone: "sky", icon: <FileText className="h-3 w-3" /> },
  "evidence-verification": { label: "Site evidence", tone: "violet", icon: <MapPin className="h-3 w-3" /> },
  "ai-request": { label: "Intelligence request", tone: "violet", icon: <Send className="h-3 w-3" /> },
};;

export function ApprovalsView({ state, refresh }: ViewProps) {
  const [tab, setTab] = useState<"pending" | "decided">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const pending = useMemo(() => state.approvals.filter((a) => a.status === "pending"), [state.approvals]);
  const decided = useMemo(
    () => state.approvals.filter((a) => a.status !== "pending").sort((a, b) => Date.parse(b.decidedAt ?? b.createdAt) - Date.parse(a.decidedAt ?? a.createdAt)),
    [state.approvals],
  );
  const list = tab === "pending" ? pending : decided;

  async function decide(item: ApprovalItem, decision: "approve" | "reject") {
    setBusy(item.id);
    try {
      const res = await fetch("/api/admin/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, decision, note: notes[item.id] ?? "" }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; notified?: boolean; note?: string; error?: string };
      if (res.ok && data.ok) {
        if (decision === "approve") {
          toast.success("Approved", {
            description: data.notified
              ? `Owner notified via main-app webhook — ${data.note}`
              : "Approved. Owner notification could not be queued (main app unreachable) — it was NOT delivered.",
          });
        } else {
          toast("Rejected", { description: "Decision recorded in the audit trail." });
        }
        setNotes((n) => {
          const next = { ...n };
          delete next[item.id];
          return next;
        });
        await refresh(true);
      } else {
        toast.error("Decision failed", { description: data.error ?? `HTTP ${res.status}` });
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
        description="Real items from live activity — new projects, new accounts, budget breaches, document submissions, site evidence and intelligence requests. Every decision flows straight back to the requester's app within seconds."
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
            hint="Create a project, upload a document, submit site evidence or ask Assure Intelligence for approval in the main app — the request appears here within seconds. Budget escalations appear when spend crosses the threshold (Email Outbox → alert settings)."
          />
        ) : (
          <EmptyState icon={<ClipboardCheck className="h-8 w-8" />} title="No decisions yet" hint="Approved and rejected items will be listed here with their notes." />
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
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="success" loading={busy === item.id} onClick={() => void decide(item, "approve")}>
                          <Check className="h-3.5 w-3.5" /> Approve {item.kind === "project-activation" ? "monitoring" : item.kind === "account-access" ? "access" : "escalation"}
                        </Button>
                        <Button size="sm" variant="danger" loading={busy === item.id} onClick={() => void decide(item, "reject")}>
                          <X className="h-3.5 w-3.5" /> Reject
                        </Button>
                        <span className="text-[10px] text-slate-400">approving queues a real user-alert on the main sync hub</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
                      <Badge tone={item.status === "approved" ? "green" : "red"}>{item.status}</Badge>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        by {item.decidedBy ?? "—"} · {item.decidedAt ? fmtDateTime(item.decidedAt) : "—"}
                      </span>
                      {item.note ? <span className="w-full text-[11px] italic text-slate-500 dark:text-slate-400">“{item.note}”</span> : null}
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

function HonestyNote({ state }: { state: HostStateResponse }) {
  const approved = state.approvals.filter((a) => a.status === "approved").length;
  const rejected = state.approvals.filter((a) => a.status === "rejected").length;
  return (
    <Card>
      <div className="px-5 py-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        <p className="font-semibold text-slate-700 dark:text-slate-200">How this stays honest</p>
        <p className="mt-1">
          Decisions live in the host store (persisted locally via <code className="font-mono">.host-store.json</code>, in-memory on Vercel) and are append-only in the Audit Trail.
          The owner notification is a <strong>real webhook</strong> to the main app — when it is unreachable the decision is still recorded and the UI tells you delivery failed.
        </p>
        <p className="mt-1">
          Session totals: {approved} approved · {rejected} rejected · threshold {state.settings.budgetThresholdPct}% budget overrun.
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
