"use client";
import React, { useState } from "react";
import { useAdminStore } from "@/store/admin-store";
import { Input } from "@/components/ui/input";
import { ScrollText } from "lucide-react";
import { relTime } from "@/lib/host/format";

export function AuditTrail() {
  const { audit } = useAdminStore();
  const [search, setSearch] = useState("");
  const filtered = audit.filter(a => !search || a.action.toLowerCase().includes(search.toLowerCase()) || a.note.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-lg font-bold">Audit Trail</h2><p className="text-xs text-slate-500">Append-only log of every admin action — decisions, mutations, exports, logins. Tamper-proof.</p></div>
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search audit log…" className="h-9 w-64" />
      </div>
      <div className="max-h-[520px] space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
        {filtered.length === 0 && <div className="py-16 text-center text-sm text-slate-400"><ScrollText className="mx-auto h-12 w-12 mb-2 opacity-30" />No matching audit entries</div>}
        {filtered.map(ev => (
          <div key={ev.id} className="flex items-start gap-2.5 border-b border-dashed border-slate-100 px-2 py-1.5 last:border-0">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#0c93e7]/10 text-[9px] font-bold text-[#015ca0]">{ev.action[0]}</div>
            <div className="min-w-0 flex-1"><div className="text-[11px] font-semibold">{ev.action} <span className="font-mono text-[9px] text-slate-500">· {ev.entityType}</span></div>{ev.note && <div className="truncate text-[10px] text-slate-500">{ev.note}</div>}<div className="text-[9px] text-slate-400">{ev.by} · {relTime(ev.at)}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}
