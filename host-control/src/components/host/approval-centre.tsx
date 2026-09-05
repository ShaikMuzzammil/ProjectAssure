"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FileCheck, Wallet, Clock, ShoppingCart, CheckCircle2, XCircle,
  AlertTriangle, Filter, Search,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAdminStore } from "@/store/admin-store";
import { fmtINR, fmtDate, deptCode, cn } from "@/lib/utils";
import type {
  ApprovalItem, ApprovalType, ApprovalStatus, ApprovalRecommendation,
} from "@/lib/host/types";

const TYPE_LABEL: Record<ApprovalType, string> = {
  CHANGE_ORDER: "Change Order",
  BUDGET_INCREASE: "Budget Increase",
  EXTENSION_OF_TIME: "Extension of Time",
  PROCUREMENT: "Procurement",
};

const TYPE_ICON: Record<ApprovalType, any> = {
  CHANGE_ORDER: FileCheck,
  BUDGET_INCREASE: Wallet,
  EXTENSION_OF_TIME: Clock,
  PROCUREMENT: ShoppingCart,
};

const REC_LABEL: Record<ApprovalRecommendation, { label: string; cls: string }> = {
  approve: { label: "Recommend approve", cls: "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300" },
  approve_with_conditions: { label: "Approve w/ conditions", cls: "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-300" },
  hold_for_evidence: { label: "Hold for evidence", cls: "border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-500/15 dark:text-blue-300" },
  reject: { label: "Recommend reject", cls: "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-500/15 dark:text-rose-300" },
};

function riskBadge(score: number) {
  if (score >= 75) return { label: "HIGH", cls: "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-500/15 dark:text-rose-300" };
  if (score >= 50) return { label: "MED", cls: "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-300" };
  return { label: "LOW", cls: "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300" };
}

function statusBadge(s: ApprovalStatus) {
  switch (s) {
    case "PENDING": return { label: "Pending", cls: "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-300" };
    case "APPROVED": return { label: "Approved", cls: "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300" };
    case "APPROVED_WITH_CONDITIONS": return { label: "Approved w/ conditions", cls: "border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-500/15 dark:text-blue-300" };
    case "REJECTED": return { label: "Rejected", cls: "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-500/15 dark:text-rose-300" };
  }
}

export function ApprovalCentre() {
  const { approvals, audit, hydrate, pushApproval, pushActivity } = useAdminStore();
  const [activeTab, setActiveTab] = useState<ApprovalType>("CHANGE_ORDER");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ApprovalStatus>("ALL");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [current, setCurrent] = useState<ApprovalItem | null>(null);
  const [decision, setDecision] = useState<ApprovalStatus>("APPROVED");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    return approvals
      .filter(a => a.type === activeTab)
      .filter(a => statusFilter === "ALL" ? true : a.status === statusFilter)
      .filter(a => deptFilter === "ALL" ? true : a.departmentId === deptFilter)
      .filter(a => search ? (a.projectName + a.requester + a.reason).toLowerCase().includes(search.toLowerCase()) : true);
  }, [approvals, activeTab, statusFilter, deptFilter, search]);

  const counts = useMemo(() => {
    const c: Record<ApprovalType, number> = { CHANGE_ORDER: 0, BUDGET_INCREASE: 0, EXTENSION_OF_TIME: 0, PROCUREMENT: 0 };
    for (const a of approvals) if (a.status === "PENDING") c[a.type] += 1;
    return c;
  }, [approvals]);

  const openDialog = (a: ApprovalItem, d: ApprovalStatus) => {
    setCurrent(a);
    setDecision(d);
    setNote("");
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!current) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: current.type,
          id: current.id,
          decision,
          note,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      pushApproval(json.approval);
      // pull fresh sync so audit + activity update too
      const sync = await fetch("/api/admin/sync", { cache: "no-store" });
      const syncJson = await sync.json();
      hydrate(syncJson);
      toast.success(`${decision.replace("_", " ")} · ${current.projectName.slice(0, 40)}`, {
        description: note || "Logged in audit trail",
      });
      setDialogOpen(false);
    } catch (e: any) {
      toast.error("Decision failed", { description: e?.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Approval Centre</h2>
          <p className="text-sm text-muted-foreground">
            Pending change orders, budget increases, extension-of-time requests and procurement sign-offs. Every decision is logged in the audit trail.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="APPROVED_WITH_CONDITIONS">Approved w/ cond.</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Department</Label>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All depts</SelectItem>
                <SelectItem value="dept-ipmd">IPMD</SelectItem>
                <SelectItem value="dept-nat">NASD</SelectItem>
                <SelectItem value="dept-soc">SOSD</SelectItem>
                <SelectItem value="dept-eco">ECSD</SelectItem>
                <SelectItem value="dept-cb">CAPB</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                className="h-8 w-44 pl-7 text-xs"
                placeholder="Project, requester…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ApprovalType)}>
        <TabsList>
          <TabsTrigger value="CHANGE_ORDER" className="gap-1.5 text-xs">
            <FileCheck className="size-3.5" /> Change Orders
            {counts.CHANGE_ORDER > 0 && <Badge variant="secondary" className="ml-1 px-1 text-[10px]">{counts.CHANGE_ORDER}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="BUDGET_INCREASE" className="gap-1.5 text-xs">
            <Wallet className="size-3.5" /> Budget Increases
            {counts.BUDGET_INCREASE > 0 && <Badge variant="secondary" className="ml-1 px-1 text-[10px]">{counts.BUDGET_INCREASE}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="EXTENSION_OF_TIME" className="gap-1.5 text-xs">
            <Clock className="size-3.5" /> Extension of Time
            {counts.EXTENSION_OF_TIME > 0 && <Badge variant="secondary" className="ml-1 px-1 text-[10px]">{counts.EXTENSION_OF_TIME}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="PROCUREMENT" className="gap-1.5 text-xs">
            <ShoppingCart className="size-3.5" /> Procurement
            {counts.PROCUREMENT > 0 && <Badge variant="secondary" className="ml-1 px-1 text-[10px]">{counts.PROCUREMENT}</Badge>}
          </TabsTrigger>
        </TabsList>

        {(["CHANGE_ORDER", "BUDGET_INCREASE", "EXTENSION_OF_TIME", "PROCUREMENT"] as const).map(t => (
          <TabsContent key={t} value={t}>
            <ApprovalList items={filtered.filter(a => a.type === t)} onAct={openDialog} />
          </TabsContent>
        ))}
      </Tabs>

      {/* ─── Decision dialog ──────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decision === "REJECTED" ? "Reject" : decision === "APPROVED_WITH_CONDITIONS" ? "Approve with conditions" : "Approve"}{" "}
              {current ? TYPE_LABEL[current.type] : ""}
            </DialogTitle>
            <DialogDescription>
              {current?.projectName}
            </DialogDescription>
          </DialogHeader>
          {current && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <span>Requested by <strong className="text-foreground">{current.requester}</strong></span>
                  <span>·</span>
                  <span>{fmtDate(current.requestedAt)}</span>
                </div>
                <div className="text-sm">{current.reason}</div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  {current.amountL && <Badge variant="outline" className="tabular">{fmtINR(current.amountL, { unit: "crore" })}</Badge>}
                  {current.durationDays && <Badge variant="outline">{current.durationDays} days EoT</Badge>}
                  {current.procurementValueL && <Badge variant="outline" className="tabular">{fmtINR(current.procurementValueL, { unit: "crore" })} procurement</Badge>}
                  <Badge variant="outline" className={cn(riskBadge(current.riskScore).cls)}>Risk {current.riskScore} · {riskBadge(current.riskScore).label}</Badge>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="note">Decision note (optional, will be visible in audit trail)</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder={
                    decision === "APPROVED_WITH_CONDITIONS" ? "e.g. Approved conditional on steel supply ETA from L&T by 12 Sep"
                    : decision === "REJECTED" ? "e.g. Hold — Ken river clearance not yet filed"
                    : "Optional context for the audit trail"
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={submit}
              disabled={submitting}
              variant={decision === "REJECTED" ? "destructive" : decision === "APPROVED_WITH_CONDITIONS" ? "secondary" : "default"}
            >
              {submitting ? "Logging…" : decision === "REJECTED" ? "Reject & log" : "Confirm & log"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApprovalList({ items, onAct }: { items: ApprovalItem[]; onAct: (a: ApprovalItem, d: ApprovalStatus) => void }) {
  if (!items.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <CheckCircle2 className="size-8 text-emerald-500" />
          <div className="text-sm font-medium">No items in this filter</div>
          <div className="text-xs text-muted-foreground">Try a different status / department / search term.</div>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((a, i) => {
        const Icon = TYPE_ICON[a.type];
        const rb = riskBadge(a.riskScore);
        const sb = statusBadge(a.status);
        const rec = REC_LABEL[a.recommendation];
        return (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.2 }}
          >
            <Card className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                    <Icon className="size-4.5" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{a.projectName}</span>
                      <Badge variant="outline" className={cn("text-[10px]", sb.cls)}>{sb.label}</Badge>
                      <Badge variant="outline" className={cn("text-[10px]", rb.cls)}>Risk {a.riskScore} · {rb.label}</Badge>
                      {a.source === "FRESH_USER" && <Badge variant="outline" className="text-[10px] border-violet-300 text-violet-700 bg-violet-50 dark:bg-violet-500/15 dark:text-violet-300">Fresh user</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
                      <span>Requested by <strong className="text-foreground">{a.requester}</strong></span>
                      <span>·</span>
                      <span>{deptCode(a.departmentId)}</span>
                      <span>·</span>
                      <span>{fmtDate(a.requestedAt)}</span>
                    </div>
                    <div className="text-sm text-foreground/90 leading-snug">{a.reason}</div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {a.amountL && <Badge variant="secondary" className="tabular text-[11px]">{fmtINR(a.amountL, { unit: "crore" })}</Badge>}
                      {a.durationDays && <Badge variant="secondary" className="text-[11px]">{a.durationDays} days EoT</Badge>}
                      {a.procurementValueL && <Badge variant="secondary" className="tabular text-[11px]">{fmtINR(a.procurementValueL, { unit: "crore" })} procurement</Badge>}
                      <Badge variant="outline" className={cn("text-[10px]", rec.cls)}>
                        <AlertTriangle className="size-3" /> {rec.label}
                      </Badge>
                    </div>
                    {a.status !== "PENDING" && a.decidedBy && (
                      <div className="text-[11px] text-muted-foreground pt-1 border-t">
                        {a.decidedBy} · {fmtDate(a.decidedAt)}{a.decisionNote ? ` · "${a.decisionNote}"` : ""}
                      </div>
                    )}
                  </div>
                  {a.status === "PENDING" && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button size="sm" variant="default" className="h-7 gap-1 text-xs" onClick={() => onAct(a, "APPROVED")}>
                        <CheckCircle2 className="size-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="secondary" className="h-7 gap-1 text-xs" onClick={() => onAct(a, "APPROVED_WITH_CONDITIONS")}>
                        <AlertTriangle className="size-3.5" /> w/ conditions
                      </Button>
                      <Button size="sm" variant="destructive" className="h-7 gap-1 text-xs" onClick={() => onAct(a, "REJECTED")}>
                        <XCircle className="size-3.5" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
