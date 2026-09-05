"use client";
import React, { useState } from "react";
import { useAdminStore } from "@/store/admin-store";
import { cn } from "@/lib/utils";
import { ShieldAlert, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { relTime } from "@/lib/host/format";

const RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export function AlertsFeed() {
  const { alerts } = useAdminStore();
  const [filter, setFilter] = useState<"ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const [bcOpen, setBcOpen] = useState(false);
  const [bcTitle, setBcTitle] = useState(""); const [bcMsg, setBcMsg] = useState(""); const [bcSev, setBcSev] = useState<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW">("HIGH");
  const list = alerts.filter(a => filter === "ALL" || a.severity === filter).sort((a, b) => RANK[a.severity] - RANK[b.severity] || +new Date(b.createdAt) - +new Date(a.createdAt));
  const counts = { ALL: alerts.length, CRITICAL: alerts.filter(a => a.severity === "CRITICAL").length, HIGH: alerts.filter(a => a.severity === "HIGH").length, MEDIUM: alerts.filter(a => a.severity === "MEDIUM").length, LOW: alerts.filter(a => a.severity === "LOW").length };

  const sendBroadcast = async () => {
    await fetch("/api/admin/alert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: bcTitle, message: bcMsg, severity: bcSev, by: "CPO" }) });
    toast.success("Broadcast sent", { description: "Notification routed to all users" });
    setBcOpen(false); setBcTitle(""); setBcMsg("");
    const r = await fetch("/api/admin/sync"); useAdminStore.getState().hydrate(await r.json());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-lg font-bold">Alerts Aggregation</h2><p className="text-xs text-slate-500">Every alert across every project in one feed. Severity-ranked with pathway badges.</p></div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setBcOpen(true)}><Megaphone className="h-3.5 w-3.5" />Broadcast…</Button>
        </div>
      </div>
      <div className="flex gap-1.5">
        {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={cn("rounded-lg px-3 py-1.5 text-[11px] font-semibold", filter === f ? "bg-[#0b426e] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>{f} {counts[f]}</button>
        ))}
      </div>
      <div className="max-h-[520px] space-y-2 overflow-y-auto">
        {list.length === 0 && <div className="py-20 text-center text-sm text-slate-400"><ShieldAlert className="mx-auto h-12 w-12 mb-2 opacity-30" />No alerts in this filter</div>}
        {list.map(a => (
          <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", a.severity === "CRITICAL" ? "bg-rose-100 text-rose-700" : a.severity === "HIGH" ? "bg-orange-100 text-orange-700" : a.severity === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700")}>{a.severity}</span>
              <span className="text-xs font-bold">{a.title}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold", a.pathway === "broadcast" ? "bg-violet-100 text-violet-700" : a.pathway === "fresh" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700")}>{a.pathway.toUpperCase()}</span>
              <span className="ml-auto text-[9px] text-slate-500">{relTime(a.createdAt)}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-600">{a.description}</p>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">{a.projectName} · {a.projectPsId}<div className="ml-auto">Owner: <strong className="text-slate-900">{a.recommendedOwner}</strong> · by <strong className="text-slate-900">{a.recommendedDeadline}</strong></div></div>
          </div>
        ))}
      </div>
      <Dialog open={bcOpen} onOpenChange={setBcOpen}>
        <DialogHeader><DialogTitle>Broadcast alert to all users</DialogTitle></DialogHeader>
        <p className="text-xs text-slate-500">Sends a notification to every user — demo personas AND registered accounts.</p>
        <div className="mt-2 space-y-2">
          <div><label className="text-[11px] font-semibold">Severity</label><div className="mt-1 flex gap-1.5">{(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map(s => <button key={s} onClick={() => setBcSev(s)} className={cn("rounded-lg border px-2 py-1.5 text-[10px] font-bold", bcSev === s ? "border-[#0c93e7] bg-blue-50" : "")}>{s}</button>)}</div></div>
          <div><label className="text-[11px] font-semibold">Title</label><Input value={bcTitle} onChange={e => setBcTitle(e.target.value)} placeholder="e.g., Quarterly portfolio review" className="mt-1" /></div>
          <div><label className="text-[11px] font-semibold">Message</label><Textarea value={bcMsg} onChange={e => setBcMsg(e.target.value)} placeholder="Write the broadcast message…" className="mt-1 min-h-16" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setBcOpen(false)}>Cancel</Button><Button disabled={bcTitle.trim().length < 4 || bcMsg.trim().length < 10} onClick={sendBroadcast}><Megaphone className="h-4 w-4" />Send broadcast</Button></DialogFooter>
      </Dialog>
    </div>
  );
}
