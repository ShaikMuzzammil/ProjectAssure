"use client";
import React, { useState, useMemo } from "react";
import { useAdminStore } from "@/store/admin-store";
import { cn } from "@/lib/utils";
import {
  Landmark,
  ClipboardList,
  LineChart,
  Eye,
  Search,
  Download,
  UserPlus,
  X,
  Mail,
  Ban,
  CheckCircle2,
  IndianRupee,
  StickyNote,
  ChevronUp,
  ChevronDown,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { relTime } from "@/lib/host/format";
import { motion, AnimatePresence } from "framer-motion";
import type { User, UserRole, UserSource } from "@/lib/host/types";

const ROLE_ICON: Record<string, React.ElementType> = {
  ADMIN: Landmark,
  PROJECT_MANAGER: ClipboardList,
  STAKEHOLDER: LineChart,
  VIEWER: Eye,
};

type FilterChip = "ALL" | "DEMO" | "FRESH_USER" | "MANUAL" | "SUSPENDED" | "PENDING";
type SortKey = "name" | "createdAt" | "lastLoginAt" | "loginCount" | "totalBudgetL" | "alertsCount" | "riskLevel";

const RISK_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 } as const;

export function UserManagement() {
  const { users, projects, alerts, audit, emails, setSelectedUser, selectedUserId } = useAdminStore();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterChip>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [addOpen, setAddOpen] = useState(false);

  const counts = {
    ALL: users.length,
    DEMO: users.filter((u) => u.source === "DEMO").length,
    FRESH_USER: users.filter((u) => u.source === "FRESH_USER").length,
    MANUAL: users.filter((u) => u.source === "MANUAL").length,
    SUSPENDED: users.filter((u) => u.status === "SUSPENDED").length,
    PENDING: users.filter((u) => u.status === "PENDING_APPROVAL").length,
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = users.filter((u) => {
      if (filter === "SUSPENDED" && u.status !== "SUSPENDED") return false;
      if (filter === "PENDING" && u.status !== "PENDING_APPROVAL") return false;
      if (filter !== "ALL" && filter !== "SUSPENDED" && filter !== "PENDING" && u.source !== filter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        u.designation.toLowerCase().includes(q)
      );
    });
    list.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "riskLevel") {
        av = RISK_ORDER[a.riskLevel];
        bv = RISK_ORDER[b.riskLevel];
      } else if (sortKey === "name") {
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
      } else if (sortKey === "lastLoginAt") {
        av = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
        bv = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
      } else if (sortKey === "createdAt") {
        av = new Date(a.createdAt).getTime();
        bv = new Date(b.createdAt).getTime();
      } else {
        av = (a as any)[sortKey] ?? 0;
        bv = (b as any)[sortKey] ?? 0;
      }
      const r = typeof av === "string" ? (av as string).localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? r : -r;
    });
    return list;
  }, [users, search, filter, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const selected = users.find((u) => u.id === selectedUserId) || null;

  const doExport = async () => {
    try {
      const r = await fetch("/api/admin/export");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `projectassure-users-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch {
      toast.error("Export failed");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + actions */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">User Management</h2>
          <p className="text-xs text-slate-500">
            Every registered account, demo persona and manually added user — with KPIs, status, projects and per-row actions.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={doExport}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Add user
          </Button>
        </div>
      </div>

      {/* Search + filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, role, department…"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["ALL", "All"],
              ["DEMO", "Demo"],
              ["FRESH_USER", "Fresh"],
              ["MANUAL", "Manual"],
              ["SUSPENDED", "Suspended"],
              ["PENDING", "Pending"],
            ] as [FilterChip, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition",
                filter === key
                  ? "bg-[#0b426e] text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {label} <span className="ml-1 opacity-60">{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <Th label="User" onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir} />
                <Th label="Email / Department" />
                <Th label="Role" />
                <Th label="Source" />
                <Th label="Projects" />
                <Th label="Budget" onClick={() => toggleSort("totalBudgetL")} active={sortKey === "totalBudgetL"} dir={sortDir} />
                <Th label="Last login" onClick={() => toggleSort("lastLoginAt")} active={sortKey === "lastLoginAt"} dir={sortDir} />
                <Th label="Risk" onClick={() => toggleSort("riskLevel")} active={sortKey === "riskLevel"} dir={sortDir} />
                <Th label="Status" />
                <Th label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const Icon = ROLE_ICON[u.role] ?? Eye;
                return (
                  <tr
                    key={u.id}
                    className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                    onClick={() => setSelectedUser(u.id)}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-[10px] font-bold text-white">
                          {u.avatarInitials}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-bold">{u.name}</div>
                          <div className="truncate text-[10px] text-slate-500">{u.designation}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-[10px] text-slate-700">{u.email}</div>
                      <div className="text-[10px] text-slate-500">{u.department}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        <Icon className="h-3 w-3" />
                        {u.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <SourceBadge source={u.source} />
                    </td>
                    <td className="px-3 py-2.5 text-[11px] font-semibold tabular">{u.projectCount}</td>
                    <td className="px-3 py-2.5">
                      <div className="text-[11px] font-semibold tabular">₹{(u.totalBudgetL / 100).toFixed(0)} Cr</div>
                      <div className="text-[9px] text-slate-500">{u.budgetUtilisedPct}% used</div>
                    </td>
                    <td className="px-3 py-2.5 text-[10px] text-slate-600">
                      {u.lastLoginAt ? relTime(u.lastLoginAt) : "never"}
                    </td>
                    <td className="px-3 py-2.5">
                      <RiskBadge level={u.riskLevel} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <RowAction
                          title="View"
                          onClick={() => setSelectedUser(u.id)}
                          icon={<Eye className="h-3.5 w-3.5" />}
                        />
                        <RowAction
                          title="Email"
                          onClick={() => {
                            setSelectedUser(u.id);
                            // Open email-centre view? Instead show inline detail panel for send-email action
                          }}
                          icon={<Mail className="h-3.5 w-3.5" />}
                        />
                        {u.status === "SUSPENDED" ? (
                          <RowAction
                            title="Reactivate"
                            onClick={async () => {
                              await fetch("/api/admin/reactivate", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: u.id, by: "CPO" }),
                              });
                              toast.success(`${u.name} reactivated`);
                              const r = await fetch("/api/admin/sync");
                              useAdminStore.getState().hydrate(await r.json());
                            }}
                            icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                          />
                        ) : (
                          <RowAction
                            title="Suspend"
                            onClick={async () => {
                              const reason = window.prompt("Reason for suspension?", "Policy violation");
                              if (!reason) return;
                              await fetch("/api/admin/suspend", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: u.id, by: "CPO", reason }),
                              });
                              toast.success(`${u.name} suspended`);
                              const r = await fetch("/api/admin/sync");
                              useAdminStore.getState().hydrate(await r.json());
                            }}
                            icon={<Ban className="h-3.5 w-3.5 text-rose-600" />}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-16 text-center text-slate-400">
                    <ShieldAlert className="mx-auto mb-2 h-10 w-10 opacity-30" />
                    No users match this filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over detail panel — keyed by user.id so internal state resets when the user changes */}
      <UserDetailSlideOver
        key={selected?.id ?? "none"}
        user={selected}
        projects={selected ? projects.filter((p) => p.ownerId === selected.id) : []}
        alerts={selected ? alerts.filter((a) => a.targetUserId === selected.id).slice(0, 5) : []}
        audit={selected ? audit.filter((a) => a.note.includes(selected.name) || a.note.includes(selected.id)).slice(0, 10) : []}
        emails={selected ? emails.filter((e) => e.toUserId === selected.id).slice(0, 10) : []}
        onClose={() => setSelectedUser(null)}
      />

      {/* Add user dialog */}
      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function Th({
  label,
  onClick,
  active,
  dir,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  dir?: "asc" | "desc";
}) {
  if (!onClick) return <th className="px-3 py-2 font-semibold">{label}</th>;
  return (
    <th className="px-3 py-2 font-semibold">
      <button onClick={onClick} className="inline-flex items-center gap-1 hover:text-slate-900">
        {label}
        {active && (dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}

function SourceBadge({ source }: { source: UserSource }) {
  const map = {
    DEMO: "bg-blue-100 text-blue-700",
    FRESH_USER: "bg-emerald-100 text-emerald-700",
    MANUAL: "bg-violet-100 text-violet-700",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold", map[source])}>
      {source.replace("_", " ")}
    </span>
  );
}

function RiskBadge({ level }: { level: User["riskLevel"] }) {
  const map = {
    LOW: "bg-emerald-100 text-emerald-700",
    MEDIUM: "bg-amber-100 text-amber-700",
    HIGH: "bg-orange-100 text-orange-700",
    CRITICAL: "bg-rose-100 text-rose-700",
  };
  return <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold", map[level])}>{level}</span>;
}

function StatusBadge({ status }: { status: User["status"] }) {
  const map = {
    ACTIVE: "bg-emerald-100 text-emerald-700",
    SUSPENDED: "bg-rose-100 text-rose-700",
    PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  };
  return <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold", map[status])}>{status.replace("_", " ")}</span>;
}

function RowAction({ title, onClick, icon }: { title: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
    >
      {icon}
    </button>
  );
}

function UserDetailSlideOver({
  user,
  projects,
  alerts,
  audit,
  emails,
  onClose,
}: {
  user: User | null;
  projects: any[];
  alerts: any[];
  audit: any[];
  emails: any[];
  onClose: () => void;
}) {
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetValue, setBudgetValue] = useState(String(user?.budgetLimitL ?? ""));
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteValue, setNoteValue] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // v21: parent component passes a key={user.id}, so this component remounts
  // whenever the selected user changes — no manual effect-based reset needed.

  const Icon = user ? ROLE_ICON[user.role] ?? Eye : Eye;

  const refresh = async () => {
    const r = await fetch("/api/admin/sync");
    useAdminStore.getState().hydrate(await r.json());
  };

  const submitSuspend = async () => {
    if (!user) return;
    await fetch("/api/admin/suspend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, by: "CPO", reason: "Suspended from detail panel" }),
    });
    toast.success(`${user.name} suspended`);
    await refresh();
  };

  const submitReactivate = async () => {
    if (!user) return;
    await fetch("/api/admin/reactivate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, by: "CPO" }),
    });
    toast.success(`${user.name} reactivated`);
    await refresh();
  };

  const submitBudget = async () => {
    if (!user) return;
    const n = Number(budgetValue);
    if (!Number.isFinite(n) || n < 0) return toast.error("Enter a non-negative number");
    await fetch("/api/admin/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, limitL: n, by: "CPO" }),
    });
    toast.success(`Budget cap set to ₹${n} L`);
    setBudgetOpen(false);
    await refresh();
  };

  const submitNote = async () => {
    if (!user || !noteValue.trim()) return;
    await fetch("/api/admin/note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, body: noteValue, by: "CPO" }),
    });
    toast.success("Note added");
    setNoteOpen(false);
    await refresh();
  };

  const submitEmail = async () => {
    if (!user || !emailSubject.trim() || !emailBody.trim()) return;
    await fetch("/api/admin/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, subject: emailSubject, body: emailBody, by: "CPO" }),
    });
    toast.success(`Email ${user.email.includes("@") ? "queued" : "sent"} (simulated)`);
    setEmailOpen(false);
    await refresh();
  };

  return (
    <AnimatePresence>
      {user && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/40"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 36 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start gap-3 border-b border-slate-200 bg-gradient-to-r from-[#072b49] to-[#0b426e] p-4 text-white">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-bold">
                {user.avatarInitials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-base font-bold">{user.name}</h3>
                  <SourceBadge source={user.source} />
                  <StatusBadge status={user.status} />
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-white/70">
                  <Icon className="h-3 w-3" />
                  {user.role.replace("_", " ")} · {user.designation}
                </div>
                <div className="font-mono text-[10px] text-white/80">{user.email}</div>
              </div>
              <button onClick={onClose} className="rounded-md p-1 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* KPI strip */}
              <div className="grid grid-cols-4 gap-2">
                <Kpi label="Projects" value={String(user.projectCount)} />
                <Kpi label="Budget" value={`₹${(user.totalBudgetL / 100).toFixed(0)} Cr`} />
                <Kpi label="Logins" value={String(user.loginCount)} />
                <Kpi label="Alerts" value={String(user.alertsCount)} />
              </div>

              {/* Budget utilisation */}
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold">Budget utilisation</span>
                  <span className="text-[11px] font-bold tabular">{user.budgetUtilisedPct}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      user.budgetUtilisedPct > 80 ? "bg-rose-500" : user.budgetUtilisedPct > 60 ? "bg-amber-500" : "bg-emerald-500",
                    )}
                    style={{ width: `${Math.min(user.budgetUtilisedPct, 100)}%` }}
                  />
                </div>
                {user.budgetLimitL !== undefined && (
                  <div className="mt-1 text-[9px] text-slate-500">Cap: ₹{user.budgetLimitL} L</div>
                )}
              </div>

              {/* Quick actions */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {user.status === "SUSPENDED" ? (
                  <Button size="sm" onClick={submitReactivate}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Reactivate
                  </Button>
                ) : (
                  <Button size="sm" variant="destructive" onClick={submitSuspend}>
                    <Ban className="h-3.5 w-3.5" /> Suspend
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setEmailOpen((o) => !o)}>
                  <Mail className="h-3.5 w-3.5" /> Email
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBudgetOpen((o) => !o)}>
                  <IndianRupee className="h-3.5 w-3.5" /> Set budget
                </Button>
                <Button size="sm" variant="outline" onClick={() => setNoteOpen((o) => !o)}>
                  <StickyNote className="h-3.5 w-3.5" /> Add note
                </Button>
              </div>

              {/* Inline forms */}
              {emailOpen && (
                <InlineCard title="Send email">
                  <Input
                    placeholder="Subject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="mb-2"
                  />
                  <Textarea
                    placeholder="Body…"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="min-h-20"
                  />
                  <Button size="sm" className="mt-2" onClick={submitEmail} disabled={!emailSubject.trim() || !emailBody.trim()}>
                    Send
                  </Button>
                </InlineCard>
              )}
              {budgetOpen && (
                <InlineCard title="Set per-user budget cap (in ₹ lakh)">
                  <Input
                    type="number"
                    placeholder="e.g. 1500"
                    value={budgetValue}
                    onChange={(e) => setBudgetValue(e.target.value)}
                  />
                  <Button size="sm" className="mt-2" onClick={submitBudget}>
                    Save
                  </Button>
                </InlineCard>
              )}
              {noteOpen && (
                <InlineCard title="Add a private note">
                  <Textarea
                    placeholder="Note body…"
                    value={noteValue}
                    onChange={(e) => setNoteValue(e.target.value)}
                    className="min-h-16"
                  />
                  <Button size="sm" className="mt-2" onClick={submitNote} disabled={!noteValue.trim()}>
                    Add note
                  </Button>
                </InlineCard>
              )}

              {/* Existing notes */}
              {user.notes.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-[11px] font-bold uppercase text-slate-500">Notes ({user.notes.length})</h4>
                  <div className="mt-1.5 space-y-1.5">
                    {user.notes.map((n) => (
                      <div key={n.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px]">
                        <div className="font-semibold text-amber-900">{n.body}</div>
                        <div className="mt-0.5 text-[9px] text-amber-700">
                          {n.by} · {relTime(n.at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects */}
              <Section title={`Projects (${projects.length})`}>
                {projects.length === 0 ? (
                  <Empty>No projects owned by this user</Empty>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full text-left text-[10px]">
                      <thead className="bg-slate-50 text-[9px] uppercase text-slate-500">
                        <tr>
                          <th className="px-2 py-1">PS ID</th>
                          <th className="px-2 py-1">Name</th>
                          <th className="px-2 py-1">Health</th>
                          <th className="px-2 py-1">Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.map((p) => (
                          <tr key={p.id} className="border-t border-slate-100">
                            <td className="px-2 py-1 font-mono">{p.psId}</td>
                            <td className="px-2 py-1 font-semibold">{p.name}</td>
                            <td className="px-2 py-1">
                              <RiskBadge level={p.healthStatus === "CRITICAL" ? "CRITICAL" : p.healthStatus === "AT_RISK" ? "HIGH" : "LOW"} />
                            </td>
                            <td className="px-2 py-1 tabular">{p.variancePct.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* Alerts */}
              <Section title={`Alerts (${alerts.length})`}>
                {alerts.length === 0 ? (
                  <Empty>No alerts targeted at this user</Empty>
                ) : (
                  <div className="space-y-1.5">
                    {alerts.map((a) => (
                      <div key={a.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">
                            {a.severity}
                          </span>
                          <span className="text-[11px] font-semibold">{a.title}</span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">{relTime(a.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Emails */}
              <Section title={`Emails (${emails.length})`}>
                {emails.length === 0 ? (
                  <Empty>No emails sent to this user yet</Empty>
                ) : (
                  <div className="space-y-1.5">
                    {emails.map((e) => (
                      <div key={e.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-[#e0effe] px-1.5 py-0.5 text-[9px] font-bold text-[#015ca0]">
                            {e.status}
                          </span>
                          <span className="text-[11px] font-semibold">{e.subject}</span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">{relTime(e.sentAt)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Audit history */}
              <Section title={`Audit history (${audit.length})`}>
                {audit.length === 0 ? (
                  <Empty>No audit entries</Empty>
                ) : (
                  <div className="space-y-1">
                    {audit.map((a) => (
                      <div key={a.id} className="flex items-start gap-2 border-b border-dashed border-slate-100 py-1 text-[10px] last:border-0">
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#0c93e7]/10 text-[9px] font-bold text-[#015ca0]">
                          {a.action.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold">{a.action}</div>
                          <div className="truncate text-slate-500">{a.note}</div>
                          <div className="text-[9px] text-slate-400">
                            {a.by} · {relTime(a.at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
      <div className="text-sm font-bold tabular">{value}</div>
      <div className="text-[9px] text-slate-500">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h4 className="text-[11px] font-bold uppercase text-slate-500">{title}</h4>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-center text-[10px] text-slate-400">{children}</div>;
}

function InlineCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-[#0c93e7]/30 bg-[#0c93e7]/5 p-3">
      <div className="text-[11px] font-bold text-[#015ca0]">{title}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function AddUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("VIEWER");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");

  const submit = async () => {
    if (!name.trim() || !email.trim()) return toast.error("Name + email are required");
    await fetch("/api/admin/manual-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, role, designation, department, by: "CPO" }),
    });
    toast.success(`${name} added`);
    setName(""); setEmail(""); setDesignation(""); setDepartment(""); setRole("VIEWER");
    onOpenChange(false);
    const r = await fetch("/api/admin/sync");
    useAdminStore.getState().hydrate(await r.json());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Add user manually</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-slate-500">
        Creates a user directly in the host-control plane (source = MANUAL). Useful for accounts that bypass the main-app sign-up flow.
      </p>
      <div className="mt-3 space-y-2">
        <Field label="Name *">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh Kumar" />
        </Field>
        <Field label="Email *">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. ramesh@mospi.gov.in" />
        </Field>
        <Field label="Role">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0c93e7]"
          >
            <option value="VIEWER">VIEWER</option>
            <option value="STAKEHOLDER">STAKEHOLDER</option>
            <option value="PROJECT_MANAGER">PROJECT_MANAGER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </Field>
        <Field label="Designation">
          <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Deputy Director" />
        </Field>
        <Field label="Department">
          <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. IPMD" />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!name.trim() || !email.trim()}>
          <UserPlus className="h-4 w-4" /> Create user
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
