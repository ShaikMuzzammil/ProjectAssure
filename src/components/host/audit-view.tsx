"use client";

// Audit Trail — every host action (login, sync transitions, approvals,
// broadcasts, user actions, emails, AI usage) with timestamp + actor.
// Append-only in the host store. Searchable + severity-filterable.

import { useMemo, useState } from "react";
import { Search, ScrollText } from "lucide-react";
import { Badge, Card, EmptyState, Input, PageIntro, Select, severityTone } from "./ui";
import { fmtDateTime, relTime } from "@/lib/host/format";
import type { ViewProps } from "./view-props";

const ACTION_GROUPS = [
  { id: "all", label: "All actions" },
  { id: "auth", label: "Auth" },
  { id: "sync", label: "Sync" },
  { id: "approval", label: "Approvals" },
  { id: "broadcast", label: "Broadcasts" },
  { id: "user", label: "User actions" },
  { id: "email", label: "Email" },
  { id: "ai", label: "Intelligence" },
  { id: "settings", label: "Settings" },
  { id: "integration", label: "Integrations" },
] as const;

export function AuditView({ state }: ViewProps) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.audit.filter((a) => {
      if (group !== "all" && !a.action.startsWith(group)) return false;
      if (q && !`${a.action} ${a.actor} ${a.detail ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [state.audit, query, group]);

  return (
    <div className="space-y-4">
      <PageIntro
        title="Audit Trail"
        description="Append-only log of every host action — sign-ins (success, failure, lockouts), sync transitions, approval decisions, broadcasts, user access/role changes, email outcomes and Intelligence usage. Persisted with the host store (.host-store.json locally; in-memory on Vercel)."
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search action, actor, detail…" className="pl-8" aria-label="Search audit trail" />
          </div>
          <Select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Filter by action group">
            {ACTION_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </Select>
          <span className="ml-auto text-[11px] font-medium text-slate-400">{filtered.length} / {state.audit.length} entries (latest 300 shown)</span>
        </div>

        {state.audit.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<ScrollText className="h-8 w-8" />} title="No audit entries yet" hint="Every action you take in this control tower lands here immediately." />
          </div>
        ) : (
          <div className="host-scroll max-h-[36rem] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {filtered.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-5 py-2.5">
                <Badge tone={severityTone(a.severity)}>{a.severity}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[11px] font-semibold text-[#072b49] dark:text-sky-300">{a.action}</p>
                  <p className="mt-0.5 break-words text-xs leading-relaxed text-slate-600 dark:text-slate-300">{a.detail ?? "—"}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">actor: {a.actor}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-slate-400">{relTime(a.at)}</p>
                  <p className="text-[9px] text-slate-300">{fmtDateTime(a.at)}</p>
                </div>
              </div>
            ))}
            {filtered.length === 0 ? <p className="px-5 py-8 text-center text-xs text-slate-400">No entries match the filters.</p> : null}
          </div>
        )}
      </Card>
    </div>
  );
}
