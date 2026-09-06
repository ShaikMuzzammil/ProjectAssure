"use client";
import React, { useState } from "react";
import { useAdminStore } from "@/store/admin-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, X, Gavel, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { relTime } from "@/lib/host/format";
import { motion } from "framer-motion";

export function ApprovalCentre() {
  const { approvals, audit } = useAdminStore();
  const [filter, setFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("PENDING");
  const [reviewOpen, setReviewOpen] = useState<{ id: string; title: string; type: string; decision: "approve" | "reject" } | null>(null);
  const [note, setNote] = useState("");
  const list = approvals.filter((a) => filter === "ALL" || a.status === filter);

  const decisionAudit = audit.filter((a) => a.action === "AI_ACCEPT" || a.action === "AI_OVERRIDE").slice(0, 8);

  const submit = async () => {
    if (!reviewOpen) return;
    await fetch("/api/admin/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reviewOpen.id, decision: reviewOpen.decision, note, by: "CPO" }),
    });
    toast.success(`Change order ${reviewOpen.decision === "approve" ? "approved" : "rejected"}`, {
      description: "Decision audit-logged",
    });
    setReviewOpen(null);
    setNote("");
    const r = await fetch("/api/admin/sync");
    useAdminStore.getState().hydrate(await r.json());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Approval Centre</h2>
          <p className="text-xs text-slate-500">
            Every pending change order, budget increase, EoT and procurement request — one queue. Decisions are audit-logged.
          </p>
        </div>
        <div className="flex gap-1.5">
          {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition",
                filter === f ? "bg-[#0b426e] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {f} <span className="opacity-60">{approvals.filter((a) => a.status === f).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {/* Approval list */}
        <div className="space-y-2">
          {list.length === 0 && (
            <div className="py-20 text-center text-sm text-slate-400">
              <Gavel className="mx-auto mb-2 h-12 w-12 opacity-30" />
              No approvals in this filter
            </div>
          )}
          {list.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={a.status === "PENDING" ? "amber" : a.status === "APPROVED" ? "green" : "rose"}>
                  {a.status}
                </Badge>
                <Badge tone="default">{a.type.replace(/_/g, " ")}</Badge>
                <span className="text-sm font-bold">{a.title}</span>
                <span className="ml-auto text-[10px] text-slate-500">{relTime(a.raisedAt)}</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600">{a.description}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                <span className="font-mono">{a.projectPsId}</span>
                <span>·</span>
                <span>{a.projectName}</span>
                <span>·</span>
                <span>raised by {a.raisedBy}</span>
                {a.reviewedBy && (
                  <span className="ml-auto">
                    reviewed by <strong className="text-slate-900">{a.reviewedBy}</strong> · {a.reviewedAt && relTime(a.reviewedAt)}
                  </span>
                )}
                {a.status === "PENDING" && (
                  <div className="ml-auto flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReviewOpen({ id: a.id, title: a.title, type: a.type, decision: "reject" });
                        setNote("");
                      }}
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setReviewOpen({ id: a.id, title: a.title, type: a.type, decision: "approve" });
                        setNote("");
                      }}
                    >
                      <Check className="h-3.5 w-3.5" /> Approve
                    </Button>
                  </div>
                )}
              </div>
              {a.reviewNote && (
                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
                  <span className="font-semibold">Note:</span> {a.reviewNote}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Audit trail of decisions */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <ScrollText className="h-4 w-4 text-[#0c93e7]" /> Decision Audit Trail
          </h3>
          <p className="mt-0.5 text-[10px] text-slate-500">Last 8 approve / reject decisions</p>
          <div className="mt-3 max-h-[460px] space-y-1.5 overflow-y-auto">
            {decisionAudit.length === 0 && (
              <div className="py-8 text-center text-[11px] text-slate-400">No decisions yet</div>
            )}
            {decisionAudit.map((ev) => (
              <div key={ev.id} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                <div
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold",
                    ev.action === "AI_ACCEPT" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
                  )}
                >
                  {ev.action === "AI_ACCEPT" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10px] font-semibold">{ev.note}</div>
                  <div className="text-[9px] text-slate-500">
                    {ev.by} · {relTime(ev.at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={!!reviewOpen} onOpenChange={(o) => !o && setReviewOpen(null)}>
        <DialogHeader>
          <DialogTitle>{reviewOpen?.decision === "approve" ? "Approve" : "Reject"} change order</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-slate-500">{reviewOpen?.title}</p>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Decision note (audit-logged)…"
          className="min-h-20 mt-2"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setReviewOpen(null)}>
            Cancel
          </Button>
          <Button disabled={note.trim().length < 5} onClick={submit}>
            Confirm
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
