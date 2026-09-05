"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp, type ProjectForm } from "@/store/app-store";
import type { Project } from "@/lib/projectassure/types";
import { HealthRing, HealthBadge, StatusBadge, ProgressBar, EmptyState, SECTOR_COLORS, PipelineStrip } from "../shared/ui-bits";
import { inr, shortDate, monthName, relTime } from "@/lib/projectassure/format";
import { can, canTouchProject } from "@/lib/projectassure/permissions";
import { downloadCsv, projectsToRows, downloadExcel, buildReport, downloadPdf, reportFileName } from "@/lib/projectassure/reports";
import { DEPARTMENTS, USERS } from "@/lib/projectassure/seed";
import { toast } from "sonner";
import {
  Search, SlidersHorizontal, X, Plus, FileDown, FileSpreadsheet, FileText, MapPin, LayoutList,
  ChevronLeft, ChevronRight, Check, Sparkles, ArrowUpDown, Trash2, Pencil, FolderPlus, UploadCloud, Loader2,
} from "lucide-react";
import { extractRawText, structureFields, makeDocument, fileKind } from "@/lib/projectassure/ocr";
import { bytes as fmtBytes } from "@/lib/projectassure/format";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

const SECTORS = ["Roads", "Health", "Education", "Urban", "Water", "Infrastructure"];
const STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Bihar", "Chhattisgarh", "Delhi", "Gujarat", "Jammu & Kashmir", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "West Bengal"];
const PAGE_SIZE = 12;

type SortKey = "healthScore" | "progress" | "totalBudget" | "targetDate" | "name";

export default function ProjectsView() {
  const user = useApp(s => s.user)!;
  const projects = useApp(s => s.scoped)();
  const departments = useApp(s => s.departments);
  const navigate = useApp(s => s.navigate);
  const openProject = useApp(s => s.openProject);
  const createProject = useApp(s => s.createProject);
  const ingestDocument = useApp(s => s.ingestDocument);
  const updateProject = useApp(s => s.updateProject);
  const cancelProject = useApp(s => s.cancelProject);
  const askAi = useApp(s => s.askAi);
  const recordExport = useApp(s => s.recordExport);
  const density = useApp(s => s.density);

  const [q, setQ] = useState("");
  const [fDept, setFDept] = useState("all");
  const [fSector, setFSector] = useState("all");
  const [fHealth, setFHealth] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "healthScore", dir: 1 });
  const [page, setPage] = useState(0);
  type TableView = "table" | "map";
  const [view, setView] = useState<TableView>("table");
  const [wizard, setWizard] = useState(false);
  const [editP, setEditP] = useState<Project | null>(null);
  const [cancelP, setCancelP] = useState<Project | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const filtered = useMemo(() => {
    let list = projects.filter(p => {
      if (q && !(p.name + p.district + p.state + p.scheme + p.psId + p.projectManager).toLowerCase().includes(q.toLowerCase())) return false;
      if (fDept !== "all" && p.departmentId !== fDept) return false;
      if (fSector !== "all" && p.sector !== fSector) return false;
      if (fHealth !== "all" && p.healthStatus !== fHealth) return false;
      if (fStatus !== "all" && p.status !== fStatus) return false;
      return true;
    });
    list.sort((a, b) => {
      const d = sort.dir;
      if (sort.key === "targetDate") return d * (new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
      if (sort.key === "name") return d * a.name.localeCompare(b.name);
      return d * ((a[sort.key] as number) - (b[sort.key] as number));
    });
    return list;
  }, [projects, q, fDept, fSector, fHealth, fStatus, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const activeFilters = [fDept, fSector, fHealth, fStatus].filter(f => f !== "all").length + (q ? 1 : 0);

  const exportCsv = () => {
    downloadCsv(projectsToRows(filtered), `projectassure-projects-${new Date().toISOString().slice(0, 10)}.csv`);
    recordExport("Projects table export", "csv", `${filtered.length} filtered projects`);
    toast.success("CSV exported", { description: `${filtered.length} rows reflect the current filters · audit-logged` });
  };
  const exportExcel = async () => {
    const doc = buildReport("portfolio-flash", projects, useApp.getState().stats(), user);
    await downloadExcel(doc, `projectassure-projects-${new Date().toISOString().slice(0, 10)}.xlsx`, [{ name: "Projects", rows: projectsToRows(filtered) }]);
    recordExport("Projects table export", "xlsx", `${filtered.length} filtered projects`);
    toast.success("Excel exported", { description: "Multi-sheet workbook: report + full project table · audit-logged" });
  };
  const exportPdf = async () => {
    const doc = buildReport("executive", projects, useApp.getState().stats(), user);
    await downloadPdf(doc, reportFileName("executive"));
    recordExport("Executive report", "pdf", `${projects.length} scoped projects`);
    toast.success("PDF exported", { description: "Branded executive report with pulse, exceptions & budget signals" });
  };

  const toggleSort = (key: SortKey) => setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "healthScore" ? 1 : -1 }));

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Projects</h1>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {filtered.length} of {projects.length} in scope · {can(user, "project:create") ? "you can create projects" : `${user.role} is read-only on projects`}
          </p>
          <div className="mt-2"><PipelineStrip steps={[
            { label: "Create / import", hint: "6-step wizard: identity, timeline + stage, budget, team, documents — geocoded onto the live map." },
            { label: "Auto-scored", hint: "New projects start Green with a baseline prediction; every upload and edit re-scores health instantly." },
            { label: "Filter & drill", hint: "Table and live map views, filters by department/sector/health/status, drill from national to district." },
            { label: "Export & open", hint: "CSV/Excel/PDF exports here; click any row to open the 9-tab project detail page." },
          ]} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border">
            <button onClick={() => setView("table")} className={cn("flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold transition", view === "table" ? "bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]" : "hover:bg-muted")}><LayoutList className="h-3.5 w-3.5" />Table</button>
            <button onClick={() => setView("map")} className={cn("flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold transition", view === "map" ? "bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]" : "hover:bg-muted")}><MapPin className="h-3.5 w-3.5" />Map</button>
          </div>
          <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-[12.5px] font-semibold transition hover:border-[#0c93e7]/40"><FileDown className="h-3.5 w-3.5" />CSV</button>
          <button onClick={exportExcel} className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-[12.5px] font-semibold transition hover:border-[#0c93e7]/40"><FileSpreadsheet className="h-3.5 w-3.5" />Excel</button>
          <button onClick={exportPdf} className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-[12.5px] font-semibold transition hover:border-[#0c93e7]/40"><FileText className="h-3.5 w-3.5" />PDF</button>
          {can(user, "project:create") && (
            <button onClick={() => setWizard(true)} className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0b426e] to-[#0c93e7] px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:shadow-md">
              <Plus className="h-3.5 w-3.5" />New project
            </button>
          )}
        </div>
      </div>

      {/* filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="Search name, district, state, scheme, PS-ID, PM…"
            className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-[12.5px] outline-none transition focus:border-[#0c93e7]" />
        </div>
        <Select value={fDept} onValueChange={v => { setFDept(v); setPage(0); }}>
          <SelectTrigger className="h-9 w-[130px] text-[12px]"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All departments</SelectItem>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.code}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={fSector} onValueChange={v => { setFSector(v); setPage(0); }}>
          <SelectTrigger className="h-9 w-[120px] text-[12px]"><SelectValue placeholder="Sector" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All sectors</SelectItem>{SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={fHealth} onValueChange={v => { setFHealth(v); setPage(0); }}>
          <SelectTrigger className="h-9 w-[120px] text-[12px]"><SelectValue placeholder="Health" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Any health</SelectItem><SelectItem value="HEALTHY">Healthy</SelectItem><SelectItem value="AT_RISK">At Risk</SelectItem><SelectItem value="CRITICAL">Critical</SelectItem></SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={v => { setFStatus(v); setPage(0); }}>
          <SelectTrigger className="h-9 w-[125px] text-[12px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Any status</SelectItem>{["ACTIVE", "PLANNING", "ON_HOLD", "COMPLETED", "CANCELLED"].map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
        </Select>
        {activeFilters > 0 && (
          <button onClick={() => { setQ(""); setFDept("all"); setFSector("all"); setFHealth("all"); setFStatus("all"); setPage(0); }}
            className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1.5 text-[11.5px] font-semibold transition hover:bg-muted/70">
            <X className="h-3 w-3" />{activeFilters} filter{activeFilters > 1 ? "s" : ""} · clear
          </button>
        )}
        <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex"><SlidersHorizontal className="h-3 w-3" />{filtered.length} results</span>
      </div>

      {view === "table" ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden rounded-xl border bg-card">
          <div className="custom-scrollbar overflow-x-auto">
            <table className="w-full min-w-[880px] text-[12.5px]">
              <thead>
                <tr className="border-b bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {[["Project", "name"], ["Health", "healthScore"], ["Progress", "progress"], ["Budget", "totalBudget"], ["Status", null], ["Target", "targetDate"], ["", null]].map(([label, key], i) => (
                    <th key={i} className="px-3 py-2.5 text-left font-semibold">
                      {key ? <button onClick={() => toggleSort(key as SortKey)} className="flex items-center gap-1 hover:text-foreground">{label}{sort.key === key && <ArrowUpDown className="h-3 w-3" />}{sort.key === key && <span className="text-[9px]">{sort.dir === 1 ? "asc" : "desc"}</span>}</button> : label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map(p => (
                  <tr key={p.id} className="group border-b transition hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      <button onClick={() => openProject(p.id)} className="block max-w-[290px] text-left">
                        <div className="truncate font-semibold group-hover:text-[#0c93e7]">{p.name.replace(/,.*$/, "")}</div>
                        <div className="text-[10.5px] text-muted-foreground">{p.psId} · {p.district}, {p.state} · {p.sector}</div>
                      </button>
                    </td>
                    <td className="px-3 py-2.5"><div className="flex items-center gap-2"><HealthRing score={p.healthScore} size={density === "compact" ? 34 : 42} showLabel={false} animate={false} /><div><HealthBadge status={p.healthStatus} /><div className="mt-0.5 text-[10px] tabular text-muted-foreground">{p.healthScore}/100</div></div></div></td>
                    <td className="px-3 py-2.5"><ProgressBar value={p.progress} className="w-20" /><div className="mt-0.5 text-[10px] tabular text-muted-foreground">{p.progress}%</div></td>
                    <td className="px-3 py-2.5"><div className="tabular font-semibold">{inr(p.spentBudget)}</div><div className="text-[10px] text-muted-foreground">of {inr(p.totalBudget)}</div></td>
                    <td className="px-3 py-2.5"><StatusBadge status={p.status} /></td>
                    <td className="px-3 py-2.5 text-[11.5px] tabular">{shortDate(p.targetDate)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                        <button onClick={() => setEditP(p)} title="Edit" className="rounded-md border p-1.5 hover:bg-muted"><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => askAi(`Why is ${p.name.replace(/,.*$/, "")} at risk?`)} title="Ask Intelligence" className="rounded-md border p-1.5 hover:bg-muted"><Sparkles className="h-3 w-3 text-[#0c93e7]" /></button>
                        <button onClick={() => openProject(p.id)} className="rounded-md bg-[#0b426e] px-2 py-1 text-[10.5px] font-semibold text-white">Open</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <EmptyState icon={FolderPlus} title="No projects match these filters" body="Clear the filters or widen your search. RBAC scoping may also limit what your role can see." action={<Button variant="outline" size="sm" onClick={() => { setQ(""); setFDept("all"); setFSector("all"); setFHealth("all"); setFStatus("all"); }}>Clear all filters</Button>} />}
          {pages > 1 && (
            <div className="flex items-center justify-between border-t px-3 py-2.5">
              <span className="text-[11px] text-muted-foreground">Page {page + 1} of {pages} · {filtered.length} projects</span>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                  const pn = Math.max(0, Math.min(pages - 5, page - 2)) + i;
                  return <Button key={pn} variant={pn === page ? "default" : "outline"} size="sm" className="h-7 w-7 p-0 text-[11px]" onClick={() => setPage(pn)} disabled={pn >= pages}>{pn + 1}</Button>;
                })}
                <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          )}
        </motion.div>
      ) : (
        <GeoMap projects={filtered} onOpen={openProject} />
      )}

      {/* wizard */}
      <ProjectWizard open={wizard} onClose={() => setWizard(false)} departments={departments} onCreate={async (form, files) => {
        // duplicate-name guard (store returns null for RBAC denial AND for duplicates — distinguish here)
        const duplicate = useApp.getState().projects.some(pp => pp.ownerId === user.id && pp.name.trim().toLowerCase() === form.name.trim().toLowerCase());
        const p = createProject(form);
        if (!p) {
          toast.error(duplicate ? "You already have a project with this name" : "Create failed", { description: duplicate ? "Project names must be unique within your workspace — rename it slightly (e.g., add “Phase-2”)." : "Your role cannot create projects (RBAC denial is audit-logged)." });
          return;
        }
        setWizard(false);
        openProject(p.id);
        toast.success(`${p.psId} created`, { description: `“${p.name}” is now monitored — milestones, tasks, Gantt and KPIs seeded${files.length ? ` · ingesting ${files.length} document${files.length > 1 ? "s" : ""}…` : ""}.` });
        // ingest uploaded documents through the real OCR/RAG pipeline (auto-updates analytics)
        // v3: per-file feedback with success/failure toasts instead of silent skips
        let ingested = 0;
        for (const f of files) {
          try {
            const { text, simulated } = await extractRawText(f);
            const { fields, findings, risks } = structureFields(text, p);
            const doc = makeDocument(p, f, text, simulated, fields, findings, risks);
            ingestDocument(p.id, doc);
            ingested++;
            toast.success(`Document processed — ${f.name}`, { description: `${fields.length} fields extracted · ${simulated ? "staged pipeline (demo)" : "parsed from real content"} · indexed for RAG search` });
          } catch {
            toast.error(`Could not read ${f.name}`, { description: "The file was skipped — unsupported or corrupted. Try TXT/CSV/MD/JSON for fully real parsing." });
          }
        }
        if (files.length && ingested === files.length) {
          toast.info("All documents ingested", { description: "Open the Documents tab to see extracted fields and the smart summary." });
        }
      }} />

      {/* edit dialog */}
      <Dialog open={!!editP} onOpenChange={o => !o && setEditP(null)}>
        <DialogContent className="max-w-lg">
          {editP && <EditProject p={editP} onUpdate={patch => { updateProject(editP.id, patch); toast.success("Project updated", { description: "Health, prediction and alerts recomputed from live data · audit-logged" }); setEditP(null); }} canEdit={canTouchProject(user, editP.projectManager)} onCancel={user.role === "ADMIN" ? () => { setCancelP(editP); setEditP(null); } : undefined} />}
        </DialogContent>
      </Dialog>

      {/* cancel dialog */}
      <Dialog open={!!cancelP} onOpenChange={o => !o && setCancelP(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[15px]">Cancel project {cancelP?.psId}?</DialogTitle></DialogHeader>
          <p className="text-[12.5px] text-muted-foreground">Soft-delete: status becomes CANCELLED, all history, documents and audit entries are preserved (append-only). This mirrors the production rule — projects are never hard-deleted.</p>
          <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Reason for cancellation (recorded in the audit trail)…" className="min-h-20 text-[12.5px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelP(null)}>Keep project</Button>
            <Button variant="destructive" disabled={!cancelReason.trim()} onClick={() => { cancelProject(cancelP!.id, cancelReason); toast.info(`${cancelP!.psId} cancelled`, { description: "Soft-cancelled with reason logged to the audit trail" }); setCancelP(null); setCancelReason(""); }}>Cancel project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Geo view: live map + national→state→district drill-down + live feed ────
function GeoMap({ projects, onOpen }: { projects: ReturnType<ReturnType<typeof useApp.getState>["scoped"]>; onOpen: (id: string, tab?: string) => void }) {
  const liveEvents = useApp(s => s.liveEvents);
  const liveEventsEnabled = useApp(s => s.liveEventsEnabled);
  const [drill, setDrill] = useState<{ state: string | null; district: string | null }>({ state: null, district: null });

  const x = (lng: number) => ((lng - 68) / 29) * 300;
  const y = (lat: number) => ((37 - lat) / 29) * 320;
  const INDIA = "M67,6 L93,16 L113,33 L108,49 L124,77 L165,104 L207,104 L248,104 L295,93 L300,121 L269,148 L248,159 L222,165 L196,176 L165,203 L127,231 L122,297 L98,319 L72,276 L57,231 L62,187 L49,170 L21,176 L10,159 L5,143 L31,132 L21,104 L52,77 L77,49 Z";
  const color = (h: string) => h === "HEALTHY" ? "#22c55e" : h === "AT_RISK" ? "#f59e0b" : "#ef4444";

  const shown = drill.state ? projects.filter(p => p.state === drill.state) : projects;
  const shownFinal = drill.district ? shown.filter(p => p.district === drill.district) : shown;

  // state aggregates for the drill-down list
  const stateAgg = useMemo(() => {
    const m = new Map<string, { total: number; risk: number; critical: number; budget: number }>();
    for (const p of projects) {
      const a = m.get(p.state) ?? { total: 0, risk: 0, critical: 0, budget: 0 };
      a.total++; a.budget += p.totalBudget;
      if (p.healthStatus !== "HEALTHY") a.risk++;
      if (p.healthStatus === "CRITICAL") a.critical++;
      m.set(p.state, a);
    }
    return [...m.entries()].sort((a, b) => b[1].critical - a[1].critical || b[1].risk - a[1].risk || b[1].total - a[1].total);
  }, [projects]);

  const districts = useMemo(() => drill.state
    ? [...new Set(projects.filter(p => p.state === drill.state).map(p => p.district))].sort()
    : [], [drill.state, projects]);

  const drillEvents = liveEvents.filter(e => !drill.state || e.projectId === undefined || projects.find(p => p.id === e.projectId && (drill.state ? p.state === drill.state : true))).slice(0, 7);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[300px_1fr_260px]">
        {/* drill-down panel */}
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-bold">Drill-down</h3>
            {(drill.state || drill.district) && (
              <button onClick={() => setDrill({ state: null, district: null })} className="text-[10.5px] font-semibold text-[#0c93e7] hover:underline dark:text-[#36adf6]">reset</button>
            )}
          </div>
          {/* breadcrumb */}
          <div className="mb-2 flex flex-wrap items-center gap-1 text-[10.5px] font-semibold">
            <button onClick={() => setDrill({ state: null, district: null })}
              className={cn("rounded px-1.5 py-0.5", !drill.state ? "bg-[#0c93e7] text-white" : "text-muted-foreground hover:bg-muted")}>🇮🇳 India</button>
            {drill.state && (<>
              <span className="text-muted-foreground/50">›</span>
              <button onClick={() => setDrill({ state: drill.state, district: null })}
                className={cn("rounded px-1.5 py-0.5", !drill.district ? "bg-[#0c93e7] text-white" : "text-muted-foreground hover:bg-muted")}>{drill.state}</button>
            </>)}
            {drill.district && (<>
              <span className="text-muted-foreground/50">›</span>
              <span className="rounded bg-[#0c93e7] px-1.5 py-0.5 text-white">{drill.district}</span>
            </>)}
          </div>
          {!drill.state ? (
            <div className="custom-scrollbar max-h-[430px] space-y-1 overflow-y-auto">
              {stateAgg.map(([st, a]) => (
                <button key={st} onClick={() => setDrill({ state: st, district: null })}
                  className="flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition hover:border-[#0c93e7]/40 hover:bg-muted/40">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: a.critical ? "#ef4444" : a.risk ? "#f59e0b" : "#22c55e" }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-semibold">{st}</div>
                    <div className="text-[10px] text-muted-foreground">{a.total} projects{a.risk ? ` · ${a.risk} flagged` : ""}{a.critical ? ` · ${a.critical} critical` : ""}</div>
                  </div>
                  <span className="shrink-0 text-[10px] tabular text-muted-foreground">{inr(a.budget)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="custom-scrollbar max-h-[220px] space-y-1 overflow-y-auto">
                {districts.map(d => (
                  <button key={d} onClick={() => setDrill({ state: drill.state, district: d })}
                    className={cn("flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-[11.5px] transition hover:bg-muted/40",
                      drill.district === d && "border-[#0c93e7] bg-[#e0effe]/50 dark:bg-[#0c93e7]/10")}>
                    <span className="truncate font-medium">{d}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{projects.filter(p => p.state === drill.state && p.district === d).length} proj</span>
                  </button>
                ))}
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5 text-[10.5px] leading-relaxed text-muted-foreground">
                {shown.length} projects in {drill.state} · {stateAgg.find(([st]) => st === drill.state)?.[1].risk ?? 0} flagged ·
                click a district to isolate it on the map.
              </div>
            </div>
          )}
        </div>

        {/* map */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-[15px] font-bold">
                Live geographic view
                {liveEventsEnabled && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>
                    LIVE
                  </span>
                )}
              </h3>
              <p className="text-[11.5px] text-muted-foreground">
                {drill.district ? `${drill.district}, ${drill.state}` : drill.state ? `${drill.state} · all districts` : "national view"} · {shownFinal.length} plotted · marker size = budget · colour = health
              </p>
            </div>
            <div className="flex gap-3 text-[11px] font-medium">
              {[["Healthy", "#22c55e"], ["At Risk", "#f59e0b"], ["Critical", "#ef4444"]].map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c as string }} />{l}</span>)}
            </div>
          </div>
          <div className="flex justify-center overflow-hidden rounded-xl bg-gradient-to-b from-[#f0f7ff] to-white p-4 dark:from-[#0b1220] dark:to-[#0f172a]">
            <svg viewBox="-10 -10 320 340" className="h-[430px] w-auto max-w-full">
              <path d={INDIA} fill="#0c93e7" fillOpacity={0.06} stroke="#0c93e7" strokeOpacity={0.35} strokeWidth={1.5} strokeLinejoin="round"
                className={drill.state ? "" : "opacity-100"} style={drill.state ? { strokeOpacity: 0.15, fillOpacity: 0.03 } : undefined} />
              {shownFinal.map(p => (
                <g key={p.id} onClick={() => onOpen(p.id)} className="cursor-pointer">
                  <circle cx={x(p.longitude)} cy={y(p.latitude)} r={Math.max(4, Math.min(11, p.totalBudget / 12000))}
                    fill={color(p.healthStatus)} fillOpacity={0.78} stroke="white" strokeWidth={1}
                    style={{ transition: "cx 0.9s cubic-bezier(0.16,1,0.3,1), cy 0.9s cubic-bezier(0.16,1,0.3,1), r 0.5s ease" }}>
                    <title>{`${p.name} · ${p.psId} · health ${p.healthScore} · ${inr(p.totalBudget)}`}</title>
                  </circle>
                  <circle cx={x(p.longitude)} cy={y(p.latitude)} r={Math.max(4, Math.min(11, p.totalBudget / 12000))} fill="transparent" className="hover-trigger" />
                </g>
              ))}
              {shownFinal.filter(p => p.healthStatus !== "HEALTHY").map(p => (
                <circle key={`ring-${p.id}`} cx={x(p.longitude)} cy={y(p.latitude)} r={16} fill="none"
                  stroke={color(p.healthStatus)} strokeWidth={1.2} strokeDasharray="3 3" opacity={0.7}
                  style={{ transition: "cx 0.9s cubic-bezier(0.16,1,0.3,1), cy 0.9s cubic-bezier(0.16,1,0.3,1)" }}>
                  <animate attributeName="r" values="12;20;12" dur="2.4s" repeatCount="indefinite" />
                </circle>
              ))}
              <text x={150} y={330} textAnchor="middle" className="fill-slate-400 text-[9px] dark:fill-slate-500">
                {drill.state ? `${drill.state}${drill.district ? " · " + drill.district : ""} isolated · click a marker to open` : "click a state on the left to drill · markers track live updates"}
              </text>
            </svg>
          </div>
        </div>

        {/* live tracking feed */}
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-[13px] font-bold">
              Live tracking feed
              {liveEventsEnabled && <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>}
            </h3>
            <span className="text-[9.5px] font-semibold text-muted-foreground">40s heartbeat</span>
          </div>
          <div className="custom-scrollbar max-h-[460px] space-y-1.5 overflow-y-auto pr-1">
            {drillEvents.length === 0 && <div className="rounded-lg border border-dashed p-4 text-center text-[10.5px] text-muted-foreground">Waiting for field updates… the portfolio heartbeat delivers progress drift, milestone completions and alerts here, exactly as a WebSocket stream would in production.</div>}
            {drillEvents.map(ev => {
              const proj = projects.find(p => p.id === ev.projectId);
              return (
                <motion.div key={ev.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                  onClick={() => ev.projectId && onOpen(ev.projectId)}
                  className="cursor-pointer rounded-lg border bg-muted/30 px-2.5 py-2 transition hover:border-[#0c93e7]/40">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="truncate text-[11px] font-semibold">{ev.title}</span>
                    <span className="shrink-0 text-[9px] tabular text-muted-foreground">{relTime(ev.at)}</span>
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">{ev.detail}</div>
                  {proj && <div className="mt-1 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: color(proj.healthStatus) }} />
                    <span className="text-[9px] font-semibold text-muted-foreground">{proj.psId} · {proj.district}</span>
                  </div>}
                </motion.div>
              );
            })}
          </div>
          <div className="mt-2 rounded-lg bg-muted/40 p-2 text-[9.5px] leading-relaxed text-muted-foreground">
            Production wiring: the same event contract streams over real-time channels (project:{`{id}`}) with a Redis adapter — the map, KPIs and health bands re-render in real time.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 6-step project wizard ───────────────────────────────────────────────────
const WIZARD_STEPS = ["Basics", "Timeline", "Budget", "Resources", "Documents", "Review"];

function ProjectWizard({ open, onClose, departments, onCreate }: { open: boolean; onClose: () => void; departments: typeof DEPARTMENTS; onCreate: (form: ProjectForm, files: File[]) => void | Promise<void> }) {
  const user = useApp(s => s.user)!;
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ProjectForm>({
    name: "", description: "", sector: "Roads", scheme: "", state: "Tamil Nadu", district: "",
    departmentId: user.departmentId, totalBudget: 5000, durationMonths: 18,
    startDate: new Date().toISOString().slice(0, 10), targetDate: "",
    projectManager: user.name, contractor: "", teamSize: 24,
    stage: "PLANNING",
  });
  const set = (patch: Partial<ProjectForm>) => setForm(f => ({ ...f, ...patch }));
  // v3: honest per-step validation with specific messages (was a single silent boolean)
  const stepErrors: string[][] = [
    [
      form.name.trim().length < 5 ? "Project name needs at least 5 characters." : "",
      !form.district.trim() ? "District is required — it places the project on the live map." : "",
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$|^$/.test("") ? "" : "",
    ],
    [
      form.durationMonths < 6 ? "Duration must be at least 6 months." : "",
      form.durationMonths > 120 ? "Duration cannot exceed 120 months." : "",
      !form.projectManager.trim() ? "Pick a project manager." : "",
    ],
    [form.totalBudget < 100 ? "Budget must be at least ₹100 lakh (₹1 Cr)." : "", ""],
    [form.teamSize < 5 ? "Team size must be at least 5." : "", ""],
    [],
    [],
  ];
  const valid = () => stepErrors[step].every(e => !e);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = Array.from(list).filter(f => f.size <= 25 * 1024 * 1024);
    if (next.length < list.length) toast.error("Some files exceeded the 25 MB cap and were skipped");
    setFiles(prev => [...prev, ...next].slice(0, 12));
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { onClose(); setStep(0); } }}>
      <DialogContent className="max-h-[88vh] w-full max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[16px]"><FolderPlus className="h-4.5 w-4.5 text-[#0c93e7]" />Create project — 6-step wizard</DialogTitle>
        </DialogHeader>
        {/* stepper */}
        <div className="flex items-center gap-1.5">
          {WIZARD_STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition", i === step ? "bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]" : i < step ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
                {i < step ? <Check className="h-3 w-3" /> : <span className="tabular">{i + 1}</span>}{s}
              </div>
              {i < WIZARD_STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
            </React.Fragment>
          ))}
        </div>

        {stepErrors[step].filter(Boolean).length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11.5px] font-medium text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
            {stepErrors[step].filter(Boolean)[0]}
          </div>
        )}
        <div className="min-h-[240px] space-y-3.5 py-2">
          {step === 0 && (<>
            <div><Label className="text-[11.5px]">Project name *</Label><Input value={form.name} onChange={e => set({ name: e.target.value })} placeholder="e.g., Coastal Ring Road, Vizag (Package-3)" className="text-[13px]" /></div>
            <div className="grid grid-cols-2 gap-3 [&>div]:min-w-0">
              <div><Label className="text-[11.5px]">Sector</Label><Select value={form.sector} onValueChange={v => set({ sector: v })}><SelectTrigger className="w-full text-[13px]"><SelectValue /></SelectTrigger><SelectContent>{SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-[11.5px]">Department</Label><Select value={form.departmentId} onValueChange={v => set({ departmentId: v })}><SelectTrigger className="w-full text-[13px]"><SelectValue /></SelectTrigger><SelectContent className="max-h-64">{departments.map(d => <SelectItem key={d.id} value={d.id} className="whitespace-nowrap"><span className="overflow-hidden text-ellipsis">{d.code} — {d.name.length > 34 ? `${d.name.slice(0, 34)}…` : d.name}</span></SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3 [&>div]:min-w-0">
              <div><Label className="text-[11.5px]">State</Label><Select value={form.state} onValueChange={v => set({ state: v })}><SelectTrigger className="w-full text-[13px]"><SelectValue /></SelectTrigger><SelectContent>{STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-[11.5px]">District *</Label><Input value={form.district} onChange={e => set({ district: e.target.value })} placeholder="e.g., Visakhapatnam" className="text-[13px]" /></div>
            </div>
            <div><Label className="text-[11.5px]">Scheme</Label><Input value={form.scheme} onChange={e => set({ scheme: e.target.value })} placeholder="e.g., Bharatmala Pariyojana" className="text-[13px]" /></div>
            <div><Label className="text-[11.5px]">Description</Label><Textarea value={form.description} onChange={e => set({ description: e.target.value })} placeholder="Scope, methodology statement, contract type…" className="min-h-16 text-[13px]" /></div>
          </>)}
          {step === 1 && (<>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-[11.5px]">Start date</Label><Input type="date" value={form.startDate} onChange={e => set({ startDate: e.target.value })} className="text-[13px]" /></div>
              <div><Label className="text-[11.5px]">Duration (months)</Label><Input type="number" min={6} max={120} value={form.durationMonths} onChange={e => set({ durationMonths: +e.target.value })} className="text-[13px]" /></div>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 text-[12px] leading-relaxed">
              Target date computed: <strong>{shortDate(new Date(new Date(form.startDate).getTime() + form.durationMonths * 30.4 * 86400000).toISOString())}</strong>. A starter milestone set (DPR → clearances → execution → commissioning) and a task graph will be seeded automatically so the Gantt and Kanban are immediately usable.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-[11.5px]">Project manager</Label><Select value={form.projectManager} onValueChange={v => set({ projectManager: v })}><SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger><SelectContent>{Array.from(new Set([user.name, ...USERS.filter(u => u.role === "ADMIN" || u.role === "PROJECT_MANAGER").map(u => u.name)])).map(name => <SelectItem key={name} value={name}>{name}{name === user.name ? " (you)" : ""}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-[11.5px]">Contractor</Label><Input value={form.contractor} onChange={e => set({ contractor: e.target.value })} placeholder="e.g., L&T Infrastructure" className="text-[13px]" /></div>
            </div>
            <div>
              <Label className="text-[11.5px]">Project stage — decides how scoring starts</Label>
              <div className="grid grid-cols-2 gap-2.5">
                {([[
                  "PLANNING", "Still in planning", "Baseline (pre-execution) prediction runs from day one; sharpens when execution data flows in.",
                ], [
                  "ACTIVE", "Execution underway", "Full 18-signal live scoring immediately — use this if physical work has already begun.",
                ]] as const).map(([val, title, desc]) => (
                  <button type="button" key={val} onClick={() => set({ stage: val as "PLANNING" | "ACTIVE" })}
                    className={cn("rounded-lg border p-2.5 text-left transition", form.stage === val ? "border-[#0c93e7] bg-[#e0effe]/60 dark:bg-[#0c93e7]/10" : "hover:border-[#0c93e7]/40 hover:bg-muted/30")}>
                    <div className="text-[12.5px] font-semibold">{title}</div>
                    <div className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </>)}
          {step === 2 && (<>
            <div><Label className="text-[11.5px]">Sanctioned budget (₹ lakh) — {inr(form.totalBudget)}</Label><Slider value={[form.totalBudget]} min={100} max={100000} step={100} onValueChange={v => set({ totalBudget: v[0] })} /></div>
            <div className="grid grid-cols-3 gap-2">
              {[["CONSTRUCTION 55%", 0.55], ["MATERIALS 25%", 0.25], ["HR 12% + EQUIP 8%", 0.2]].map(([l, s]) => (
                <div key={l as string} className="rounded-lg border bg-muted/30 p-2.5 text-center">
                  <div className="text-[10px] font-semibold text-muted-foreground">{l}</div>
                  <div className="text-[14px] font-bold tabular">₹{Math.round(form.totalBudget * (s as number)).toLocaleString("en-IN")}L</div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 text-[12px] leading-relaxed text-muted-foreground">
              Budget records are created per month per category from the next data sync. Overrun detection uses the Cost forecast: <strong>&gt;10% WARNING</strong>, <strong>&gt;20% CRITICAL</strong> escalation.
            </div>
          </>)}
          {step === 3 && (<>
            <div><Label className="text-[11.5px]">Core team size — {form.teamSize} persons</Label><Slider value={[form.teamSize]} min={5} max={500} step={5} onValueChange={v => set({ teamSize: v[0] })} /></div>
            <div className="rounded-lg border bg-muted/40 p-3 text-[12px] leading-relaxed text-muted-foreground">
              Resource allocations (workforce, supervisory staff, equipment, materials) will be provisioned at {form.teamSize} persons and re-scored by the health engine. Bottleneck rule: utilisation &gt;90% flags with a recommended redeployment.
            </div>
          </>)}
          {step === 4 && (<>
            {/* universal guidance: what documents to enter for checking */}
            <div className="rounded-xl border bg-muted/30 p-3.5">
              <div className="text-[12.5px] font-bold">What documents should you upload?</div>
              <p className="mt-1 text-[11px] text-muted-foreground">These are the documents the platform checks against. Start with whatever you have — even one file works, and you can add more anytime.</p>
              <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                {[
                  ["Monthly progress report", "Physical %, financial %, issues, next steps — the single most useful document."],
                  ["Budget / expenditure statement", "Sanctioned vs spent to date, so overrun detection starts immediately."],
                  ["Milestone certificates", "Proofs of stage completion used for schedule scoring."],
                  ["DPR or scope document", "The baseline every progress claim is measured against."],
                  ["Procurement / purchase orders", "Catches pending-material delays before they bite."],
                  ["Site photos / geotagged field notes", "Evidence for the risk view and the live map."],
                  ["Delay correspondence", "Land, permits, disputes — context that explains a slip."],
                  ["Contractor bills / measurement books", "Financial verification of reported progress."],
                ].map(([t, d]) => (
                  <div key={t} className="flex gap-2 rounded-lg border bg-card px-2.5 py-1.5">
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0c93e7] dark:text-[#36adf6]" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold leading-tight">{t}</div>
                      <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={cn("flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-7 text-center transition",
                dragOver ? "border-[#0c93e7] bg-[#e0effe]/50 dark:bg-[#0c93e7]/10" : "border-border hover:border-[#0c93e7]/50 hover:bg-muted/30")}
            >
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.xlsx,.csv,.txt,.md,.json,.png,.jpg,.jpeg" className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]"><UploadCloud className="h-5 w-5" /></div>
              <div className="mt-2.5 text-[13px] font-semibold">Upload the project documents you have</div>
              <div className="mt-1 text-[11px] text-muted-foreground">PDF · Excel · CSV · TXT · MD · JSON · images · up to 12 files × 25 MB — text and spreadsheet files are read live in your browser</div>
            </div>
            {files.length > 0 && (
              <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-xl border bg-card p-2.5">
                {files.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5 text-[11.5px]">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-[#0c93e7]" />
                    <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                    <span className="shrink-0 text-muted-foreground">{fmtBytes(f.size)} · {fileKind(f.name).toUpperCase()}</span>
                    <button type="button" onClick={e => { e.stopPropagation(); setFiles(prev => prev.filter((_, j) => j !== i)); }}
                      className="shrink-0 rounded p-0.5 text-muted-foreground transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-lg border bg-muted/40 p-3 text-[12px] leading-relaxed text-muted-foreground">
              Every upload runs the 5-stage check automatically: read → extract → validate → make searchable → re-score the project. Dashboards, predictions and alerts update instantly — no manual re-entry. You can also skip this step now and upload documents from the project page anytime.
            </div>
          </>)}
          {step === 5 && (<>
            <div className="rounded-xl border p-4">
              <div className="text-[15px] font-bold">{form.name || "Untitled project"}</div>
              <div className="mt-1 text-[12px] text-muted-foreground">{form.sector} · {form.district}, {form.state} · {form.scheme || "scheme TBD"}</div>
              <div className="mt-3 grid grid-cols-2 gap-2.5 text-[12.5px] sm:grid-cols-4">
                {[["Sanction", inr(form.totalBudget)], ["Duration", `${form.durationMonths} months`], ["Team", `${form.teamSize} persons`], ["Documents", `${files.length} file${files.length === 1 ? "" : "s"}`]].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-muted/50 p-2.5"><div className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">{k}</div><div className="mt-0.5 font-semibold">{v}</div></div>
                ))}
              </div>
              {files.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {files.map((f, i) => <span key={i} className="max-w-full truncate rounded-full bg-[#e0effe] px-2 py-0.5 text-[10px] font-medium text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]">{f.name}</span>)}
                </div>
              )}
              <div className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                On create: the project enters PLANNING with health 95, starter milestones + dependency-chained tasks, empty budget (first sync posts lines), full audit trail from the CREATE entry, and any uploaded documents are immediately ingested — every subsequent mutation recomputes the 18-signal health engine live. The project is owned by your account ({user.email}) and stays in your workspace.
              </div>
            </div>
          </>)}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => (step === 0 ? onClose() : setStep(s => s - 1))}>{step === 0 ? "Cancel" : "Back"}</Button>
          {step < 5
            ? <Button disabled={!valid()} onClick={() => setStep(s => s + 1)}>Continue</Button>
            : <Button className="bg-gradient-to-r from-[#0b426e] to-[#0c93e7]" onClick={() => { onCreate(form, files); setFiles([]); setStep(0); }}><Check className="h-4 w-4" />Create project</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit dialog ─────────────────────────────────────────────────────────────
function EditProject({ p, onUpdate, canEdit, onCancel }: { p: (ReturnType<ReturnType<typeof useApp.getState>["scoped"]>)[number]; onUpdate: (patch: Record<string, unknown>) => void; canEdit: boolean; onCancel?: () => void }) {
  const user = useApp(s => s.user)!;
  const [progress, setProgress] = useState(p.progress);
  const [status, setStatus] = useState(p.status);
  const [pm, setPm] = useState(p.projectManager);
  const [budget, setBudget] = useState(p.totalBudget);
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[14.5px] font-bold">{p.name}</div>
        <div className="text-[11px] text-muted-foreground">{p.psId} · current health {p.healthScore} ({p.healthStatus})</div>
      </div>
      {!canEdit && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">Your role can view but not edit this project (RBAC) — the audit log will record any attempted change.</div>}
      <div className="space-y-4">
        <div><Label className="text-[11.5px]">Physical progress — {progress}%</Label><Slider disabled={!canEdit} value={[progress]} min={0} max={100} step={1} onValueChange={v => setProgress(v[0])} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-[11.5px]">Status</Label><Select disabled={!canEdit} value={status} onValueChange={v => setStatus(v as typeof p.status)}><SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger><SelectContent>{["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"].map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-[11.5px]">Project manager</Label><Select disabled={!canEdit} value={pm} onValueChange={v => setPm(v)}><SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger><SelectContent>{Array.from(new Set([p.projectManager, user.name, ...USERS.filter(u => u.role === "ADMIN" || u.role === "PROJECT_MANAGER").map(u => u.name)])).map(name => <SelectItem key={name} value={name}>{name}{name === user.name ? " (you)" : ""}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div><Label className="text-[11.5px]">Sanctioned budget — ₹{budget.toLocaleString("en-IN")} L ({inr(budget)})</Label><Slider disabled={!canEdit} value={[budget]} min={100} max={150000} step={100} onValueChange={v => setBudget(v[0])} /></div>
      </div>
      <div className="flex justify-between gap-2">
        {onCancel ? <Button variant="destructive" size="sm" onClick={onCancel}><Trash2 className="h-3.5 w-3.5" />Cancel project…</Button> : <div />}
        <Button disabled={!canEdit} onClick={() => onUpdate({ progress, status, projectManager: pm, totalBudget: budget })} className="bg-gradient-to-r from-[#0b426e] to-[#0c93e7]">Save & recompute</Button>
      </div>
    </div>
  );
}
