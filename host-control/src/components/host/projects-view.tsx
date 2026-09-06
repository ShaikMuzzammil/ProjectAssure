"use client";

// Projects Control — every project from the live snapshot: health bands,
// budgets (₹Cr), progress, delay risk, milestones. Row → detail drawer
// (basic info + alerts + event trend). CSV export of the REAL mirror.

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, FolderKanban, MapPin, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Badge, Card, EmptyState, Input, PageIntro, Progress, Select, severityTone } from "./ui";
import { fmtDateTime, healthBand, relTime } from "@/lib/host/format";
import type { SyncProject } from "@/lib/host/types";
import type { ViewProps } from "./view-props";

type SortKey = "name" | "health" | "progress" | "delayRisk" | "budgetTotalCr" | "budgetSpentCr" | "lastActivityAt";

export function ProjectsView({ state }: ViewProps) {
  const [query, setQuery] = useState("");
  const [band, setBand] = useState("all");
  const [dept, setDept] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("health");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<SyncProject | null>(null);
  const [exporting, setExporting] = useState(false);

  const depts = useMemo(() => Array.from(new Set(state.mirror.projects.map((p) => p.department))).sort(), [state.mirror.projects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = state.mirror.projects.filter((p) => {
      if (q && !`${p.name} ${p.psId} ${p.sector} ${p.state} ${p.ownerName}`.toLowerCase().includes(q)) return false;
      const b = healthBand(p.health).label;
      if (band !== "all" && b !== band) return false;
      if (dept !== "all" && p.department !== dept) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "health": cmp = a.health - b.health; break;
        case "progress": cmp = a.progress - b.progress; break;
        case "delayRisk": cmp = a.delayRisk - b.delayRisk; break;
        case "budgetTotalCr": cmp = a.budgetTotalCr - b.budgetTotalCr; break;
        case "budgetSpentCr": cmp = a.budgetSpentCr - b.budgetSpentCr; break;
        case "lastActivityAt": cmp = Date.parse(a.lastActivityAt ?? "0") - Date.parse(b.lastActivityAt ?? "0"); break;
      }
      return cmp * dir;
    });
  }, [state.mirror.projects, query, band, dept, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/export", { cache: "no-store" });
      if (!res.ok) throw new Error(`export failed (HTTP ${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `projectassure-projects-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV exported", { description: `${state.mirror.projects.length} projects from the live mirror.` });
    } catch (e) {
      toast.error("Export failed", { description: (e as Error).message });
    } finally {
      setExporting(false);
    }
  }

  const liveProject = useMemo(
    () => (selected ? state.mirror.projects.find((p) => p.id === selected.id) ?? selected : null),
    [selected, state.mirror.projects],
  );

  return (
    <div className="space-y-4">
      <PageIntro
        title="Projects Control"
        description="The complete portfolio as mirrored from the main app — health bands, ₹Cr budgets, progress, delay risk and milestones. Click a row for the full control view; export the real data as CSV."
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, PS id, sector, state, owner…" className="pl-8" aria-label="Search projects" />
          </div>
          <Select value={band} onChange={(e) => setBand(e.target.value)} aria-label="Filter by health band">
            <option value="all">All health bands</option>
            <option value="Critical">Critical</option>
            <option value="At Risk">At Risk</option>
            <option value="Fair">Fair</option>
            <option value="Healthy">Healthy</option>
          </Select>
          <Select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Filter by department">
            <option value="all">All departments</option>
            {depts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
          <span className="text-[11px] font-medium text-slate-400">{filtered.length} / {state.mirror.projects.length}</span>
          <button
            onClick={() => void exportCsv()}
            disabled={exporting || state.mirror.projects.length === 0}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#072b49] px-3 text-xs font-medium text-white transition-colors hover:bg-[#0a3a5f] disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
          </button>
        </div>

        {state.mirror.projects.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<FolderKanban className="h-8 w-8" />}
              title="No projects mirrored yet"
              hint="Projects appear here the moment the main app pushes a snapshot. Create a project in the main app (Projects → New) and it lands here within seconds — the sync engine polls every 5s."
            />
          </div>
        ) : (
          <div className="host-scroll overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:text-slate-500">
                  <Th onClick={() => toggleSort("name")}>Project</Th>
                  <Th className="hidden md:table-cell">Dept · State</Th>
                  <Th>Status</Th>
                  <Th onClick={() => toggleSort("health")}>Health</Th>
                  <Th onClick={() => toggleSort("progress")}>Progress</Th>
                  <Th onClick={() => toggleSort("delayRisk")} className="text-right">Delay risk</Th>
                  <Th onClick={() => toggleSort("budgetTotalCr")}>Budget ₹Cr</Th>
                  <Th onClick={() => toggleSort("budgetSpentCr")}>Spent ₹Cr</Th>
                  <Th className="hidden lg:table-cell">Milestones</Th>
                  <Th className="hidden lg:table-cell" onClick={() => toggleSort("lastActivityAt")}>Last activity</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                {filtered.map((p) => {
                  const hb = healthBand(p.health);
                  const overrun = p.budgetTotalCr > 0 ? ((p.budgetSpentCr - p.budgetTotalCr) / p.budgetTotalCr) * 100 : 0;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelected(p)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(p);
                        }
                      }}
                      className="cursor-pointer transition-colors hover:bg-sky-50/60 dark:hover:bg-sky-500/5"
                      aria-label={`Open ${p.name} details`}
                    >
                      <td className="px-4 py-3">
                        <p className="max-w-56 truncate font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
                        <p className="text-[10px] text-slate-400">{p.psId} · {p.sector}</p>
                      </td>
                      <td className="hidden max-w-40 px-3 py-3 text-slate-600 dark:text-slate-300 md:table-cell">
                        <p className="truncate">{p.department}</p>
                        <p className="truncate text-[10px] text-slate-400">{p.state}{p.district ? ` · ${p.district}` : ""}</p>
                      </td>
                      <td className="px-3 py-3"><Badge tone="slate">{p.status}</Badge></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Progress value={p.health} tone={hb.tone === "green" ? "green" : hb.tone === "amber" ? "amber" : "red"} />
                          <Badge tone={hb.tone}>{p.health}</Badge>
                        </div>
                      </td>
                      <td className="px-3 py-3 tabular-nums text-slate-700 dark:text-slate-200">{p.progress}%</td>
                      <td className={`px-3 py-3 text-right tabular-nums font-semibold ${p.delayRisk > 60 ? "text-rose-600" : p.delayRisk > 35 ? "text-amber-600" : "text-slate-500"}`}>
                        {p.delayRisk}%
                      </td>
                      <td className="px-3 py-3 tabular-nums text-slate-700 dark:text-slate-200">₹{p.budgetTotalCr}</td>
                      <td className="px-3 py-3 tabular-nums">
                        <span className={overrun > 0 ? "font-bold text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-200"}>
                          ₹{p.budgetSpentCr}
                        </span>
                        {overrun > 0 ? <p className="text-[9px] font-bold text-rose-500">+{overrun.toFixed(0)}% over</p> : null}
                      </td>
                      <td className="hidden px-3 py-3 text-slate-600 dark:text-slate-300 lg:table-cell">
                        {p.milestonesCompleted}/{p.milestonesTotal}
                        {p.milestonesDelayed > 0 ? <span className="ml-1 text-[10px] font-bold text-amber-600">({p.milestonesDelayed} late)</span> : null}
                      </td>
                      <td className="hidden px-3 py-3 text-slate-500 dark:text-slate-400 lg:table-cell">
                        {p.lastActivityAt ? relTime(p.lastActivityAt) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 ? <div className="px-4 py-8 text-center text-xs text-slate-400">No projects match the current filters.</div> : null}
          </div>
        )}
      </Card>

      {/* project detail drawer */}
      <AnimatePresence>
        {liveProject ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          >
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
              className="ml-auto flex h-full w-full max-w-2xl flex-col bg-slate-50 shadow-2xl dark:bg-slate-950"
              onClick={(e) => e.stopPropagation()}
              role="complementary"
              aria-label="Project details"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-slate-900 dark:text-slate-100">{liveProject.name}</h2>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {liveProject.psId} · <MapPin className="h-3 w-3" aria-hidden /> {liveProject.state}{liveProject.district ? ` · ${liveProject.district}` : ""}
                  </p>
                </div>
                <button onClick={() => setSelected(null)} aria-label="Close panel" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="host-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                {/* basic info */}
                <Card>
                  <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Basic information</h3>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-3">
                    <Stat term="Department" def={liveProject.department} />
                    <Stat term="Sector" def={liveProject.sector} />
                    <Stat term="Status" def={liveProject.status} />
                    <Stat term="Health" def={`${liveProject.health} · ${healthBand(liveProject.health).label}`} />
                    <Stat term="Progress" def={`${liveProject.progress}%`} />
                    <Stat term="Delay risk" def={`${liveProject.delayRisk}%`} />
                    <Stat term="Sanctioned" def={`₹${liveProject.budgetTotalCr} Cr`} />
                    <Stat term="Spent" def={`₹${liveProject.budgetSpentCr} Cr`} />
                    <Stat
                      term="Overrun"
                      def={
                        liveProject.budgetTotalCr > 0
                          ? `${(((liveProject.budgetSpentCr - liveProject.budgetTotalCr) / liveProject.budgetTotalCr) * 100).toFixed(1)}%`
                          : "—"
                      }
                    />
                    <Stat term="Milestones" def={`${liveProject.milestonesCompleted}/${liveProject.milestonesTotal} done · ${liveProject.milestonesDelayed} delayed`} />
                    <Stat term="Owner" def={liveProject.ownerName} />
                    <Stat term="Last activity" def={liveProject.lastActivityAt ? fmtDateTime(liveProject.lastActivityAt) : "—"} />
                  </dl>
                  <div className="px-5 pb-4">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Progress</p>
                    <Progress value={liveProject.progress} tone="sky" />
                  </div>
                </Card>

                {/* alerts on this project */}
                <Card>
                  <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Alerts on this project</h3>
                  </div>
                  <div className="host-scroll max-h-60 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                    {(() => {
                      const list = state.mirror.alerts.filter((a) => a.projectPsId === liveProject.psId).slice(0, 30);
                      if (list.length === 0) return <p className="px-5 py-4 text-xs text-slate-400">No alerts for this project in the snapshot.</p>;
                      return list.map((a) => (
                        <div key={a.id} className="flex items-start gap-2 px-5 py-2.5 text-xs">
                          <Badge tone={severityTone(a.severity)}>{a.severity}</Badge>
                          <p className="min-w-0 flex-1 text-slate-600 dark:text-slate-300">{a.title}</p>
                          <span className="shrink-0 text-[10px] text-slate-400">{relTime(a.createdAt)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </Card>

                {/* trend from events */}
                <Card>
                  <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Event trend (from snapshot events)</h3>
                  </div>
                  <div className="host-scroll max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                    {(() => {
                      const list = state.mirror.events.filter((e) => e.projectId === liveProject.id).slice(0, 40);
                      if (list.length === 0) return <p className="px-5 py-4 text-xs text-slate-400">No events recorded for this project yet.</p>;
                      return list.map((e) => (
                        <div key={e.id} className="flex items-start gap-2 px-5 py-2.5 text-xs">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0c93e7]" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <p className="text-slate-600 dark:text-slate-300">{e.title}</p>
                            <p className="text-[10px] text-slate-400">{e.kind}</p>
                          </div>
                          <span className="shrink-0 text-[10px] text-slate-400">{fmtDateTime(e.at)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </Card>
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Th({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  if (!onClick) return <th className={`px-3 py-2.5 font-semibold uppercase tracking-wider ${className ?? ""}`}>{children}</th>;
  return (
    <th className={`px-3 py-2.5 ${className ?? ""}`}>
      <button onClick={onClick} className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider hover:text-[#0c93e7]">
        {children}
      </button>
    </th>
  );
}

function Stat({ term, def }: { term: string; def: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{term}</dt>
      <dd className="mt-0.5 break-words text-xs text-slate-800 dark:text-slate-200">{def}</dd>
    </div>
  );
}
