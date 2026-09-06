"use client";
import React, { useState, useMemo } from "react";
import { useAdminStore } from "@/store/admin-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollText, Webhook, Download, Filter, ShieldCheck } from "lucide-react";
import { relTime } from "@/lib/host/format";
import { toast } from "sonner";

// v21: Security & Audit — combined view of audit log + access log + webhook receipts.
// Replaces the v17 audit-trail.tsx with a much richer combined timeline.

type Tab = "audit" | "webhooks" | "access";
type ActionTypeFilter = "ALL" | "LOGIN" | "AI_ACCEPT" | "AI_OVERRIDE" | "ALERT_ACK" | "EMAIL_SEND" | "REGISTER" | "USER_SUSPENDED" | "USER_REACTIVATED";

const ACTION_FILTERS: ActionTypeFilter[] = [
  "ALL",
  "LOGIN",
  "REGISTER",
  "AI_ACCEPT",
  "AI_OVERRIDE",
  "ALERT_ACK",
  "EMAIL_SEND",
  "USER_SUSPENDED",
  "USER_REACTIVATED",
];

export function SecurityAudit() {
  const { audit, webhooks, projects } = useAdminStore();
  const [tab, setTab] = useState<Tab>("audit");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<ActionTypeFilter>("ALL");

  // Flatten access log across projects for the "access" tab
  const accessLog = useMemo(() => {
    return projects
      .flatMap((p) => p.accessLog.map((al) => ({ ...al, psId: p.psId, projectName: p.name })))
      .sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [projects]);

  const filteredAudit = audit
    .filter((a) => actionFilter === "ALL" || a.action === actionFilter)
    .filter(
      (a) =>
        !search.trim() ||
        a.action.toLowerCase().includes(search.toLowerCase()) ||
        a.note.toLowerCase().includes(search.toLowerCase()) ||
        a.by.toLowerCase().includes(search.toLowerCase()),
    );

  const filteredWebhooks = webhooks.filter(
    (w) =>
      !search.trim() ||
      w.event.toLowerCase().includes(search.toLowerCase()) ||
      (w.note || "").toLowerCase().includes(search.toLowerCase()),
  );

  const filteredAccess = accessLog.filter(
    (al) =>
      !search.trim() ||
      al.userName.toLowerCase().includes(search.toLowerCase()) ||
      al.action.toLowerCase().includes(search.toLowerCase()) ||
      al.psId.toLowerCase().includes(search.toLowerCase()),
  );

  const exportCsv = () => {
    let csv = "";
    if (tab === "audit") {
      csv = ["id,action,entityType,note,by,at", ...filteredAudit.map((a) => `${a.id},${a.action},${a.entityType},"${a.note.replace(/"/g, '""')}",${a.by},${a.at}`)].join("\n");
    } else if (tab === "webhooks") {
      csv = ["id,event,receivedAt,ok,note", ...filteredWebhooks.map((w) => `${w.id},${w.event},${w.receivedAt},${w.ok},"${(w.note || "").replace(/"/g, '""')}"`)].join("\n");
    } else {
      csv = ["id,userId,userName,action,psId,at", ...filteredAccess.map((al) => `${al.id},${al.userId},${al.userName},${al.action},${al.psId},${al.at}`)].join("\n");
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `projectassure-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Security &amp; Audit</h2>
          <p className="text-xs text-slate-500">
            Combined view of every admin action, webhook receipt and project access event — append-only, tamper-evident.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {(
            [
              ["audit", `Audit log (${audit.length})`, ScrollText],
              ["webhooks", `Webhook receipts (${webhooks.length})`, Webhook],
              ["access", `Access log (${accessLog.length})`, ShieldCheck],
            ] as [Tab, string, React.ElementType][]
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
        <div className="ml-auto w-full max-w-xs">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="h-8" />
        </div>
      </div>

      {tab === "audit" && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Filter className="h-3 w-3 text-slate-400" />
          {ACTION_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActionFilter(f)}
              className={cn(
                "rounded-md px-2 py-1 text-[9px] font-bold",
                actionFilter === f ? "bg-[#0c93e7] text-white" : "border border-slate-200 bg-white text-slate-600",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-[640px] space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
        {tab === "audit" && (
          <>
            {filteredAudit.length === 0 && (
              <div className="py-16 text-center text-sm text-slate-400">
                <ScrollText className="mx-auto mb-2 h-12 w-12 opacity-30" />
                No matching audit entries
              </div>
            )}
            {filteredAudit.map((ev) => (
              <div key={ev.id} className="flex items-start gap-2.5 border-b border-dashed border-slate-100 px-2 py-1.5 last:border-0">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#0c93e7]/10 text-[9px] font-bold text-[#015ca0]">
                  {ev.action.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold">
                    {ev.action} <span className="font-mono text-[9px] text-slate-500">· {ev.entityType}</span>
                  </div>
                  {ev.note && <div className="text-[10px] text-slate-600">{ev.note}</div>}
                  <div className="text-[9px] text-slate-400">
                    {ev.by} · {relTime(ev.at)}
                    {ev.webhookSource && <span className="ml-1 text-[#0c93e7]"> · via {ev.webhookSource}</span>}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === "webhooks" && (
          <>
            {filteredWebhooks.length === 0 && (
              <div className="py-16 text-center text-sm text-slate-400">
                <Webhook className="mx-auto mb-2 h-12 w-12 opacity-30" />
                No webhook receipts yet
              </div>
            )}
            {filteredWebhooks.map((w) => (
              <div key={w.id} className="flex items-start gap-2.5 border-b border-dashed border-slate-100 px-2 py-1.5 last:border-0">
                <div
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-[9px] font-bold",
                    w.ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
                  )}
                >
                  {w.event === "USER_REGISTERED" ? "R" : w.event === "USER_LOGIN" ? "L" : "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold">
                    {w.event} <span className={cn("ml-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold", w.ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>{w.ok ? "OK" : "FAIL"}</span>
                  </div>
                  {w.note && <div className="text-[10px] text-slate-600">{w.note}</div>}
                  <div className="font-mono text-[9px] text-slate-500">
                    {JSON.stringify(w.payload).slice(0, 120)}
                  </div>
                  <div className="text-[9px] text-slate-400">{relTime(w.receivedAt)}</div>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === "access" && (
          <>
            {filteredAccess.length === 0 && (
              <div className="py-16 text-center text-sm text-slate-400">
                <ShieldCheck className="mx-auto mb-2 h-12 w-12 opacity-30" />
                No access events logged
              </div>
            )}
            {filteredAccess.map((al) => (
              <div key={al.id} className="flex items-start gap-2.5 border-b border-dashed border-slate-100 px-2 py-1.5 last:border-0">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-violet-100 text-[9px] font-bold text-violet-700">
                  {al.action.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold">
                    {al.userName} <span className="font-mono text-[9px] text-slate-500">· {al.action}</span>
                  </div>
                  <div className="text-[10px] text-slate-600">
                    on <span className="font-mono">{al.psId}</span> ({al.projectName})
                  </div>
                  <div className="text-[9px] text-slate-400">{relTime(al.at)}</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
