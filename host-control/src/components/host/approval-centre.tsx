"use client";
import React, { useState } from "react";
import { useAdminStore } from "@/store/admin-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Gavel, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { relTime } from "@/lib/host/format";

export function ApprovalCentre() {
  const { approvals } = useAdminStore();
  const [filter, setFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("PENDING");
  const [reviewOpen, setReviewOpen] = useState<{ id: string; title: string; type: string; decision: "approve" | "reject" } | null>(null);
  const [note, setNote] = useState("");
  const list = approvals.filter(a => filter === "ALL" || a.status === filter);

  const submit = async () => {
    if (!reviewOpen) return;
    await fetch("/api/admin/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: reviewOpen.id, decision: reviewOpen.decision, note, by: "CPO" }) });
    toast.success(`Change order ${reviewOpen.decision === "approve" ? "approved" : "rejected"}`, { description: "Decision audit-logged" });
    setReviewOpen(null); setNote("");
    const r = await fetch("/api/admin/sync"); useAdminStore.getState().hydrate(await r.json());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-lg font-bold">Approval Centre</h2><p className="text-xs text-slate-500">Every pending change order, budget increase, EoT and procurement request — one queue.</p></div>
        <div className="flex gap-1.5">
          {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={cn("rounded-lg px-3 py-1.5 text-[11px] font-semibold", filter === f ? "bg-[#0b426e] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>{f} {approvals.filter(a => a.status === f).length}</button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {list.length === 0 && <div className="py-20 text-center text-sm text-slate-400"><Gavel className="mx-auto h-12 w-12 mb-2 opacity-30" />No approvals in this filter</div>}
        {list.map(a => (
          <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", a.status === "PENDING" ? "bg-amber-100 text-amber-700" : a.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>{a.status}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600">{a.type.replace(/_/g, " ")}</span>
              <span className="text-sm font-bold">{a.title}</span>
              <span className="ml-auto text-[10px] text-slate-500">{relTime(a.raisedAt)}</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600">{a.description}</p>
            <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-500">{a.projectName} · {a.projectPsId} · raised by {a.raisedBy}
              {a.status === "PENDING" && <div className="ml-auto flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => { setReviewOpen({ id: a.id, title: a.title, type: a.type, decision: "reject" }); setNote(""); }}><X className="h-3.5 w-3.5" />Reject</Button>
                <Button size="sm" onClick={() => { setReviewOpen({ id: a.id, title: a.title, type: a.type, decision: "approve" }); setNote(""); }}><Check className="h-3.5 w-3.5" />Approve</Button>
              </div>}
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!reviewOpen} onOpenChange={o => !o && setReviewOpen(null)}>
        <DialogHeader><DialogTitle>{reviewOpen?.decision === "approve" ? "Approve" : "Reject"} change order</DialogTitle></DialogHeader>
        <p className="text-xs text-slate-500">{reviewOpen?.title}</p>
        <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Decision note (audit-logged)…" className="min-h-20 mt-2" />
        <DialogFooter><Button variant="outline" onClick={() => setReviewOpen(null)}>Cancel</Button><Button disabled={note.trim().length < 5} onClick={submit}>Confirm</Button></DialogFooter>
      </Dialog>
    </div>
  );
}
