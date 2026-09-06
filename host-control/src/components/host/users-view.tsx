"use client";

// User Management — THE core feature. Full data grid built from the mirrored
// snapshot users: searchable, filterable, sortable. Row → detail drawer with
// separate sections (Profile / Security / Projects / Alerts / Activity) and
// REAL actions (access, role, direct alert, email).

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Filter, Search, Users } from "lucide-react";
import { Badge, Card, EmptyState, Input, PageIntro, Select } from "./ui";
import { UserDrawer } from "./user-drawer";
import { fmtDateTime, initials, relTime } from "@/lib/host/format";
import type { HostUserView } from "@/lib/host/types";
import type { ViewProps } from "./view-props";

type SortKey = "name" | "role" | "projectCount" | "loginCount" | "unreadAlerts" | "lastLoginAt";

export function UsersView({ state, refresh }: ViewProps) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<HostUserView | null>(null);

  const roles = useMemo(() => Array.from(new Set(state.users.map((u) => u.effectiveRole))).sort(), [state.users]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = state.users.filter((u) => {
      if (q && !`${u.name} ${u.email} ${u.department ?? ""} ${u.designation ?? ""}`.toLowerCase().includes(q)) return false;
      if (role !== "all" && u.effectiveRole !== role) return false;
      if (source !== "all" && u.source !== source) return false;
      if (status === "active" && !u.effectiveActive) return false;
      if (status === "inactive" && u.effectiveActive) return false;
      if (status === "host-managed" && !u.hostManaged) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "role": cmp = a.effectiveRole.localeCompare(b.effectiveRole); break;
        case "projectCount": cmp = a.projectCount - b.projectCount; break;
        case "loginCount": cmp = a.loginCount - b.loginCount; break;
        case "unreadAlerts": cmp = a.unreadAlerts - b.unreadAlerts; break;
        case "lastLoginAt": cmp = Date.parse(a.lastLoginAt ?? "0") - Date.parse(b.lastLoginAt ?? "0"); break;
      }
      return cmp * dir;
    });
  }, [state.users, query, role, source, status, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="space-y-4">
      <PageIntro
        title="User Management"
        description="Every account in the main app, mirrored every 5 seconds. Open a row for the full dossier — profile, security, projects, alerts and login history — with real host actions."
      />

      <Card className="overflow-hidden">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, department…"
              className="pl-8"
              aria-label="Search users"
            />
          </div>
          <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role">
            <option value="all">All roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
          <Select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filter by source">
            <option value="all">All sources</option>
            <option value="registered">Registered</option>
            <option value="demo">Demo</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="all">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="host-managed">Host-managed</option>
          </Select>
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <Filter className="h-3 w-3" aria-hidden />
            {filtered.length} / {state.users.length} users
          </span>
        </div>

        {state.users.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title="No users mirrored yet"
              hint="Users appear here the moment they exist in the main app's snapshot. Log into the main app with any persona (or sign up) — the mirror updates within seconds."
            />
          </div>
        ) : (
          <div className="host-scroll overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:text-slate-500">
                  <th className="px-4 py-2.5">
                    <ThButton onClick={() => toggleSort("name")}>User <SortArrow active={sortKey === "name"} dir={sortDir} /></ThButton>
                  </th>
                  <th className="px-3 py-2.5">
                    <ThButton onClick={() => toggleSort("role")}>Role <SortArrow active={sortKey === "role"} dir={sortDir} /></ThButton>
                  </th>
                  <th className="hidden px-3 py-2.5 md:table-cell">Department</th>
                  <th className="px-3 py-2.5">Source</th>
                  <th className="px-3 py-2.5 text-right">
                    <ThButton onClick={() => toggleSort("projectCount")}>Projects <SortArrow active={sortKey === "projectCount"} dir={sortDir} /></ThButton>
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    <ThButton onClick={() => toggleSort("loginCount")}>Logins <SortArrow active={sortKey === "loginCount"} dir={sortDir} /></ThButton>
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    <ThButton onClick={() => toggleSort("unreadAlerts")}>Unread <SortArrow active={sortKey === "unreadAlerts"} dir={sortDir} /></ThButton>
                  </th>
                  <th className="hidden px-3 py-2.5 lg:table-cell">
                    <ThButton onClick={() => toggleSort("lastLoginAt")}>Last login <SortArrow active={sortKey === "lastLoginAt"} dir={sortDir} /></ThButton>
                  </th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5" aria-label="Open details" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelected(u)}
                    className="cursor-pointer transition-colors hover:bg-sky-50/60 dark:hover:bg-sky-500/5"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(u);
                      }
                    }}
                    aria-label={`Open details for ${u.name}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#072b49] text-[11px] font-bold text-white"
                          aria-hidden
                        >
                          {initials(u.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{u.name}</p>
                          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={u.effectiveRole === "ADMIN" ? "navy" : u.effectiveRole === "PM" ? "sky" : "slate"}>{u.effectiveRole}</Badge>
                      {u.hostManaged ? <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-600">host-set</p> : null}
                    </td>
                    <td className="hidden max-w-40 px-3 py-3 text-slate-600 dark:text-slate-300 md:table-cell">
                      <p className="truncate">{u.department ?? "—"}</p>
                      <p className="truncate text-[10px] text-slate-400">{u.designation ?? ""}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={u.source === "registered" ? "green" : "slate"}>{u.source}</Badge>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-700 dark:text-slate-200">{u.projectCount}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-700 dark:text-slate-200">{u.loginCount}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {u.unreadAlerts > 0 ? (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">{u.unreadAlerts}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-3 text-slate-500 dark:text-slate-400 lg:table-cell">
                      <p>{u.lastLoginAt ? relTime(u.lastLoginAt) : "never"}</p>
                      <p className="text-[10px] text-slate-400">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : ""}</p>
                    </td>
                    <td className="px-3 py-3">
                      {u.effectiveActive ? (
                        <Badge tone="green">active</Badge>
                      ) : (
                        <Badge tone={u.hostManaged ? "red" : "slate"}>{u.hostManaged ? "host-restricted" : "app-inactive"}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-300 dark:text-slate-600">
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-400">No users match the current filters.</div>
            ) : null}
          </div>
        )}
      </Card>

      <UserDrawer user={selected} onClose={() => setSelected(null)} state={state} refresh={refresh} />
    </div>
  );
}

function ThButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider hover:text-[#0c93e7]">
      {children}
    </button>
  );
}

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return null;
  return dir === "asc" ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />;
}
