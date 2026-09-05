"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ScrollText, Search, Download, Filter, Clock,
  CheckCircle2, XCircle, AlertTriangle, Megaphone, RefreshCw, UserPlus, FileDown, LogIn,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAdminStore } from "@/store/admin-store";
import { fmtDateTime, fmtDate, cn, downloadCSV } from "@/lib/utils";
import type { AuditActionType } from "@/lib/host/types";

const ACTION_META: Record<AuditActionType, { label: string; cls: string; icon: any }> = {
  APPROVE: { label: "Approve", cls: "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300", icon: CheckCircle2 },
  APPROVE_WITH_CONDITIONS: { label: "Approve w/ cond.", cls: "border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-500/15 dark:text-blue-300", icon: CheckCircle2 },
  REJECT: { label: "Reject", cls: "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-500/15 dark:text-rose-300", icon: XCircle },
  BROADCAST_ALERT: { label: "Broadcast", cls: "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-300", icon: Megaphone },
  CONFIG_CHANGE: { label: "Config change", cls: "border-slate-300 text-slate-700 bg-slate-50 dark:bg-slate-500/15 dark:text-slate-300", icon: AlertTriangle },
  SYNC_FORCE: { label: "Force sync", cls: "border-brand-300 text-brand-700 bg-brand-50 dark:bg-brand-500/15 dark:text-brand-300", icon: RefreshCw },
  USER_CREATE: { label: "User create", cls: "border-violet-300 text-violet-700 bg-violet-50 dark:bg-violet-500/15 dark:text-violet-300", icon: UserPlus },
  EXPORT: { label: "Export", cls: "border-slate-300 text-slate-700 bg-slate-50 dark:bg-slate-500/15 dark:text-slate-300", icon: FileDown },
  LOGIN: { label: "Login", cls: "border-brand-300 text-brand-700 bg-brand-50 dark:bg-brand-500/15 dark:text-brand-300", icon: LogIn },
};

export function AuditTrail() {
  const { audit } = useAdminStore();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<"ALL" | AuditActionType>("ALL");

  const filtered = useMemo(() => {
    return audit
      .filter(a => actionFilter === "ALL" ? true : a.action === actionFilter)
      .filter(a => search ? (a.admin + a.target + a.note + a.category).toLowerCase().includes(search.toLowerCase()) : true);
  }, [audit, search, actionFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of audit) c[a.action] = (c[a.action] || 0) + 1;
    return c;
  }, [audit]);

  const handleExport = () => {
    const rows = filtered.map(a => ({
      timestamp: a.timestamp,
      admin: a.admin,
      action: a.action,
      target: a.target,
      category: a.category,
      note: a.note ?? "",
    }));
    downloadCSV(`projectassure-audit-${Date.now()}.csv`, rows);
    toast.success(`Exported ${rows.length} audit entries`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Audit Trail</h2>
          <p className="text-sm text-muted-foreground">
            Append-only log of every admin action — approvals, broadcasts, config changes, syncs, exports.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
          <Download className="size-3.5" /> Export CSV
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg p-2 bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <ScrollText className="size-4" />
            </div>
            <div>
              <div className="tabular text-xl font-semibold">{audit.length}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total entries</div>
            </div>
          </CardContent>
        </Card>
        {(["APPROVE", "REJECT", "BROADCAST_ALERT"] as AuditActionType[]).map(act => (
          <Card key={act}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("rounded-lg p-2", ACTION_META[act].cls)}>
                {(() => { const I = ACTION_META[act].icon; return <I className="size-4" />; })()}
              </div>
              <div>
                <div className="tabular text-xl font-semibold">{counts[act] ?? 0}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{ACTION_META[act].label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Action type</Label>
            <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as any)}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All actions</SelectItem>
                <SelectItem value="APPROVE">Approve</SelectItem>
                <SelectItem value="APPROVE_WITH_CONDITIONS">Approve w/ cond.</SelectItem>
                <SelectItem value="REJECT">Reject</SelectItem>
                <SelectItem value="BROADCAST_ALERT">Broadcast</SelectItem>
                <SelectItem value="CONFIG_CHANGE">Config change</SelectItem>
                <SelectItem value="SYNC_FORCE">Force sync</SelectItem>
                <SelectItem value="USER_CREATE">User create</SelectItem>
                <SelectItem value="EXPORT">Export</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[180px] space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                className="h-8 pl-7 text-xs"
                placeholder="Search admin, target, note…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <Badge variant="outline" className="ml-auto text-xs gap-1">
            <Filter className="size-3" /> Showing {filtered.length} of {audit.length}
          </Badge>
        </CardContent>
      </Card>

      {/* Audit log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Log</CardTitle>
          <CardDescription>Most recent first · append-only · immutable</CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <ScrollText className="size-8 text-muted-foreground" />
              <div className="text-sm font-medium">No audit entries yet</div>
              <div className="text-xs text-muted-foreground">Approve an item, broadcast an alert, or change config to populate this log.</div>
            </div>
          ) : (
            <div className="space-y-1 max-h-[640px] overflow-y-auto custom-scrollbar">
              {filtered.map((a, i) => {
                const meta = ACTION_META[a.action] ?? ACTION_META.CONFIG_CHANGE;
                const Icon = meta.icon;
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.01, 0.3) }}
                    className="flex items-start gap-3 rounded-md border p-3 hover:bg-accent/40"
                  >
                    <div className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md", meta.cls)}>
                      <Icon className="size-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn("text-[10px]", meta.cls)}>{meta.label}</Badge>
                        <span className="text-sm font-medium">{a.admin}</span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <span className="text-xs text-muted-foreground truncate">{a.target}</span>
                      </div>
                      {a.note && <div className="text-xs text-muted-foreground mt-1 italic">"{a.note}"</div>}
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
                        <Clock className="size-3" />
                        <span>{fmtDateTime(a.timestamp)}</span>
                        <span>·</span>
                        <span className="uppercase tracking-wide">{a.category}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] tabular">#{(audit.length - audit.findIndex(x => x.id === a.id)).toString().padStart(4, "0")}</Badge>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
