"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpDown, Download, Filter, LayoutGrid, List, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { DEPARTMENTS } from "@/lib/projectassure/engine";
import { formatLakhs } from "@/lib/projectassure/format";
import type { Project } from "@/lib/projectassure/types";
import { HealthBadge, HealthRing, ProgressBar, StatusBadge } from "../shared/ui-bits";
import { toast } from "sonner";

type Density = "comfortable" | "compact";

export function ProjectsView() {
  const projects = useAppStore((s) => s.projects);
  const openProject = useAppStore((s) => s.openProject);
  const navigate = useAppStore((s) => s.navigate);
  const askAi = useAppStore((s) => s.askAi);

  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [sector, setSector] = useState("all");
  const [health, setHealth] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState<"name" | "healthScore" | "progress" | "totalBudget" | "targetDate">("healthScore");
  const [asc, setAsc] = useState(false);
  const [density, setDensity] = useState<Density>("comfortable");

  const sectors = useMemo(() => [...new Set(projects.map((p) => p.sector))].sort(), [projects]);
  const statuses = useMemo(() => [...new Set(projects.map((p) => p.status))], [projects]);

  const filtered = useMemo(() => {
    const arr = projects.filter((p) => {
      if (q && !(p.name.toLowerCase().includes(q.toLowerCase()) || p.district.toLowerCase().includes(q.toLowerCase()) || p.state.toLowerCase().includes(q.toLowerCase()) || p.scheme.toLowerCase().includes(q.toLowerCase()))) return false;
      if (dept !== "all" && p.departmentId !== dept) return false;
      if (sector !== "all" && p.sector !== sector) return false;
      if (health !== "all" && p.healthStatus !== health) return false;
      if (status !== "all" && p.status !== status) return false;
      return true;
    });
    arr.sort((a, b) => {
      const dir = asc ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "targetDate") return (new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()) * dir;
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
    return arr;
  }, [projects, q, dept, sector, health, status, sortKey, asc]);

  const activeFilters = [dept !== "all", sector !== "all", health !== "all", status !== "all"].filter(Boolean).length;

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setAsc(!asc);
    else { setSortKey(k); setAsc(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {projects.length} projects · multi-department portfolio views & filtering</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { exportCsv(filtered); toast.success(`${filtered.length} projects exported`); }} className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium transition-colors hover:bg-muted">
            <Download className="h-4 w-4" /> Export
          </button>
          <button onClick={() => navigate("settings")} className="inline-flex items-center gap-1.5 rounded-md bg-[#0c93e7] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0b426e] active:scale-[0.98]">
            <Plus className="h-4 w-4" /> New Project
          </button>
        </div>
      </div>

      {/* filter bar */}
      <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, district, scheme…" className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#0c93e7]/50" />
          </div>
          <select value={dept} onChange={(e) => setDept(e.target.value)} className="rounded-md border border-input bg-background px-2.5 py-2 text-sm">
            <option value="all">All departments</option>
            {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
          </select>
          <select value={sector} onChange={(e) => setSector(e.target.value)} className="rounded-md border border-input bg-background px-2.5 py-2 text-sm">
            <option value="all">All sectors</option>
            {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={health} onChange={(e) => setHealth(e.target.value)} className="rounded-md border border-input bg-background px-2.5 py-2 text-sm">
            <option value="all">All health</option>
            <option value="HEALTHY">Healthy</option>
            <option value="AT_RISK">At Risk</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-input bg-background px-2.5 py-2 text-sm">
            <option value="all">All statuses</option>
            {statuses.map((s) => <option key={s} value={s}>{s.replace("_", "-")}</option>)}
          </select>
          <div className="flex overflow-hidden rounded-md border border-input">
            <button onClick={() => setDensity("comfortable")} className={`p-2 ${density === "comfortable" ? "bg-[#e0effe] text-[#015ca0]" : "hover:bg-muted"}`} title="Comfortable density"><LayoutGrid className="h-4 w-4" /></button>
            <button onClick={() => setDensity("compact")} className={`p-2 ${density === "compact" ? "bg-[#e0effe] text-[#015ca0]" : "hover:bg-muted"}`} title="Compact density"><List className="h-4 w-4" /></button>
          </div>
        </div>
        {activeFilters > 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3 w-3" />{activeFilters} filter(s) active
            <button onClick={() => { setDept("all"); setSector("all"); setHealth("all"); setStatus("all"); }} className="font-semibold text-[#0c93e7] hover:underline">Clear all</button>
          </div>
        )}
      </div>

      {/* table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="w-[30%] px-4 py-3 font-medium">Project <SortBtn k="name" cur={sortKey} asc={asc} on={toggleSort} /></th>
              <th className="px-3 py-3 font-medium">Health <SortBtn k="healthScore" cur={sortKey} asc={asc} on={toggleSort} /></th>
              <th className="px-3 py-3 font-medium">Progress <SortBtn k="progress" cur={sortKey} asc={asc} on={toggleSort} /></th>
              <th className="px-3 py-3 font-medium">Budget <SortBtn k="totalBudget" cur={sortKey} asc={asc} on={toggleSort} /></th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium hidden xl:table-cell">Target <SortBtn k="targetDate" cur={sortKey} asc={asc} on={toggleSort} /></th>
              <th className="px-3 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className={`border-b border-border/50 transition-colors last:border-0 hover:bg-muted/40 ${density === "compact" ? "" : ""}`}>
                <td className="px-4 py-3">
                  <button onClick={() => openProject(p.id)} className="group text-left">
                    <p className="font-medium group-hover:text-[#0c93e7] group-hover:underline">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.district}, {p.state} · {p.sector} · {p.scheme}</p>
                  </button>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <HealthRing score={p.healthScore} size={density === "compact" ? 34 : 42} stroke={5} animate={false} />
                    <HealthBadge status={p.healthStatus} className="hidden lg:inline-flex" />
                  </div>
                </td>
                <td className="w-28 px-3 py-3">
                  <span className="text-xs font-semibold tabular-nums">{p.progress}%</span>
                  <ProgressBar value={p.progress} className="mt-1" />
                </td>
                <td className="px-3 py-3">
                  <p className="text-xs font-semibold tabular-nums">{formatLakhs(p.totalBudget, { compact: true })}</p>
                  <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-[#0c93e7]" style={{ width: `${Math.min(100, (p.spentBudget / p.totalBudget) * 100)}%` }} />
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{Math.round((p.spentBudget / p.totalBudget) * 100)}% spent</p>
                </td>
                <td className="px-3 py-3"><StatusBadge status={p.status} /></td>
                <td className="hidden px-3 py-3 text-xs tabular-nums text-muted-foreground xl:table-cell">
                  {new Date(p.targetDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-1.5">
                    <button onClick={() => openProject(p.id)} className="rounded-md border border-input px-2 py-1 text-xs font-medium transition-colors hover:bg-[#e0effe] hover:text-[#015ca0]">Open</button>
                    <button onClick={() => askAi(`Why is ${p.name} at risk?`)} className="rounded-md border border-input px-2 py-1 text-xs font-medium transition-colors hover:bg-[#e0effe] hover:text-[#015ca0]" title="Ask AI about this project">AI</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <SlidersHorizontal className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium">No projects match the filters</p>
            <p className="text-sm text-muted-foreground">Try clearing a filter or broadening the search.</p>
          </div>
        )}
      </motion.div>
      <p className="text-xs text-muted-foreground">Showing {filtered.length} results · Ctrl/Cmd+K opens the command palette</p>
    </div>
  );
}

function SortBtn({ k, cur, asc, on }: { k: string; cur: string; asc: boolean; on: (k: never) => void }) {
  const active = cur === k;
  return (
    <button onClick={() => on(k as never)} className={`ml-1 inline-flex ${active ? "text-[#0c93e7]" : "text-muted-foreground/50"}`}>
      <ArrowUpDown className="h-3 w-3" />
      {active && !asc && <span className="ml-0.5">↓</span>}
      {active && asc && <span className="ml-0.5">↑</span>}
    </button>
  );
}

function exportCsv(projects: Project[]) {
  const header = "PS ID,Project,Sector,State,District,Scheme,Status,Health,Progress %,Budget (L),Spent (L),Projected (L)\n";
  const rows = projects.map((p) => [p.psId, `"${p.name}"`, p.sector, p.state, p.district, `"${p.scheme}"`, p.status, p.healthScore, p.progress, p.totalBudget, p.spentBudget, p.projectedBudget].join(",")).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `projectassure-projects-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}
