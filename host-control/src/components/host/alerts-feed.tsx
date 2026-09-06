"use client";
import React, { useState } from "react";
import { useAdminStore } from "@/store/admin-store";
import { cn } from "@/lib/utils";
import { ShieldAlert, Megaphone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { relTime } from "@/lib/host/format";
import type { AlertSeverity, UserRole } from "@/lib/host/types";

const RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

export function AlertsFeed() {
  const { alerts, users } = useAdminStore();
  const [filter, setFilter] = useState<"ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const [pathway, setPathway] = useState<"all" | "demo" | "fresh" | "broadcast">("all");
  const [bcOpen, setBcOpen] = useState(false);
  const [bcTitle, setBcTitle] = useState("");
  const [bcMsg, setBcMsg] = useState("");
  const [bcSev, setBcSev] = useState<AlertSeverity>("HIGH");
  const [bcAudience, setBcAudience] = useState<"all" | "role" | "user">("all");
  const [bcRole, setBcRole] = useState<UserRole>("PROJECT_MANAGER");
  const [bcUserId, setBcUserId] = useState<string>("");
  const [bcAutoEmail, setBcAutoEmail] = useState(true);

  const list = alerts
    .filter((a) => filter === "ALL" || a.severity === filter)
    .filter((a) => pathway === "all" || a.pathway === pathway)
    .sort((a, b) => RANK[a.severity] - RANK[b.severity] || +new Date(b.createdAt) - +new Date(a.createdAt));

  const counts = {
    ALL: alerts.length,
    CRITICAL: alerts.filter((a) => a.severity === "CRITICAL").length,
    HIGH: alerts.filter((a) => a.severity === "HIGH").length,
    MEDIUM: alerts.filter((a) => a.severity === "MEDIUM").length,
    LOW: alerts.filter((a) => a.severity === "LOW").length,
  };

  const pathwayCounts = {
    all: alerts.length,
    demo: alerts.filter((a) => a.pathway === "demo").length,
    fresh: alerts.filter((a) => a.pathway === "fresh").length,
    broadcast: alerts.filter((a) => a.pathway === "broadcast").length,
  };

  const sendBroadcast = async () => {
    const opts: any = { autoEmail: bcAutoEmail };
    if (bcAudience === "role") opts.targetRole = bcRole;
    if (bcAudience === "user") opts.targetUserId = bcUserId;
    await fetch("/api/admin/alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: bcTitle, message: bcMsg, severity: bcSev, by: "CPO", ...opts }),
    });
    toast.success("Broadcast sent", {
      description: bcAutoEmail ? "Email delivered (or simulated)" : "Notification routed",
    });
    setBcOpen(false);
    setBcTitle("");
    setBcMsg("");
    const r = await fetch("/api/admin/sync");
    useAdminStore.getState().hydrate(await r.json());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Alerts Aggregation</h2>
          <p className="text-xs text-slate-500">
            Every alert across every project in one feed. Severity-ranked with pathway badges. Optionally auto-email recipients.
          </p>
        </div>
        <Button size="sm" onClick={() => setBcOpen(true)}>
          <Megaphone className="h-3.5 w-3.5" /> Broadcast…
        </Button>
      </div>

      {/* Severity filter */}
      <div className="flex flex-wrap gap-1.5">
        {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition",
              filter === f ? "bg-[#0b426e] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
            )}
          >
            {f} <span className="opacity-60">{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Pathway filter */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["all", "All pathways"],
            ["demo", "Demo"],
            ["fresh", "Fresh-user"],
            ["broadcast", "Broadcast"],
          ] as ["all" | "demo" | "fresh" | "broadcast", string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPathway(key)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[10px] font-semibold transition",
              pathway === key ? "bg-[#0c93e7] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
            )}
          >
            {label} <span className="opacity-60">{pathwayCounts[key]}</span>
          </button>
        ))}
      </div>

      <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
        {list.length === 0 && (
          <div className="py-20 text-center text-sm text-slate-400">
            <ShieldAlert className="mx-auto mb-2 h-12 w-12 opacity-30" />
            No alerts in this filter
          </div>
        )}
        {list.map((a) => (
          <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold",
                  a.severity === "CRITICAL"
                    ? "bg-rose-100 text-rose-700"
                    : a.severity === "HIGH"
                      ? "bg-orange-100 text-orange-700"
                      : a.severity === "MEDIUM"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700",
                )}
              >
                {a.severity}
              </span>
              <span className="text-xs font-bold">{a.title}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] font-bold",
                  a.pathway === "broadcast"
                    ? "bg-violet-100 text-violet-700"
                    : a.pathway === "fresh"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-blue-100 text-blue-700",
                )}
              >
                {a.pathway.toUpperCase()}
              </span>
              <span className="ml-auto text-[9px] text-slate-500">{relTime(a.createdAt)}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-600">{a.description}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
              <span className="font-mono">{a.projectPsId}</span>
              <span>·</span>
              <span>{a.projectName}</span>
              <div className="ml-auto">
                Owner: <strong className="text-slate-900">{a.recommendedOwner}</strong> · by{" "}
                <strong className="text-slate-900">{a.recommendedDeadline}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={bcOpen} onOpenChange={setBcOpen}>
        <DialogHeader>
          <DialogTitle>Broadcast alert</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-slate-500">
          Sends a notification to every user (or a subset). Optionally auto-emails each recipient.
        </p>
        <div className="mt-2 space-y-2">
          <div>
            <label className="text-[11px] font-semibold">Severity</label>
            <div className="mt-1 flex gap-1.5">
              {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setBcSev(s)}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-[10px] font-bold",
                    bcSev === s ? "border-[#0c93e7] bg-blue-50" : "",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold">Audience</label>
            <div className="mt-1 flex gap-1.5">
              {(
                [
                  ["all", "Everyone"],
                  ["role", "By role"],
                  ["user", "Specific user"],
                ] as ["all" | "role" | "user", string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setBcAudience(k)}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-[10px] font-bold",
                    bcAudience === k ? "border-[#0c93e7] bg-blue-50" : "",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {bcAudience === "role" && (
            <div>
              <label className="text-[11px] font-semibold">Role</label>
              <select
                value={bcRole}
                onChange={(e) => setBcRole(e.target.value as UserRole)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0c93e7]"
              >
                <option value="ADMIN">ADMIN</option>
                <option value="PROJECT_MANAGER">PROJECT_MANAGER</option>
                <option value="STAKEHOLDER">STAKEHOLDER</option>
                <option value="VIEWER">VIEWER</option>
              </select>
            </div>
          )}
          {bcAudience === "user" && (
            <div>
              <label className="text-[11px] font-semibold">User</label>
              <select
                value={bcUserId}
                onChange={(e) => setBcUserId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0c93e7]"
              >
                <option value="">Select a user…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-[11px] font-semibold">Title</label>
            <Input value={bcTitle} onChange={(e) => setBcTitle(e.target.value)} placeholder="e.g., Quarterly portfolio review" className="mt-1" />
          </div>
          <div>
            <label className="text-[11px] font-semibold">Message</label>
            <Textarea value={bcMsg} onChange={(e) => setBcMsg(e.target.value)} placeholder="Write the broadcast message…" className="mt-1 min-h-16" />
          </div>
          <label className="flex items-center gap-2 text-[11px] font-semibold">
            <input type="checkbox" checked={bcAutoEmail} onChange={(e) => setBcAutoEmail(e.target.checked)} />
            <Mail className="h-3.5 w-3.5" /> Auto-email each recipient
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setBcOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={bcTitle.trim().length < 4 || bcMsg.trim().length < 10 || (bcAudience === "user" && !bcUserId)}
            onClick={sendBroadcast}
          >
            <Megaphone className="h-4 w-4" /> Send broadcast
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
