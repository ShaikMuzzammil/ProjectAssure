"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Project Search — one box, everything findable. Type a name, PS-ID, state,
// sector, scheme or vendor and get the project with its headline numbers.
// The "I just want to find my project" page.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { HealthBadge, PipelineStrip, EmptyState, ProgressBar, InfoTip } from "../shared/ui-bits";
import { inr } from "@/lib/projectassure/format";
import { deriveContracts } from "@/lib/projectassure/monitor";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Search, X, MapPin, Building2, IndianRupee, ArrowRight } from "lucide-react";

const QUICK = ["Roads", "Water", "Tamil Nadu", "Smart Cities", "Bharatmala", "Jal Jeevan", "at risk", "Rail"];

export default function ProjectSearchView() {
  const projects = useApp(s => s.scoped)();
  const openProject = useApp(s => s.openProject);
  const navigate = useApp(s => s.navigate);
  const [q, setQ] = useState("");

  const contracts = useMemo(() => deriveContracts(projects), [projects]);
  const vendorIndex = useMemo(() => {
    const m = new Map<string, string>(); // projectName → vendors
    for (const c of contracts) {
      const cur = m.get(c.projectName) ?? "";
      m.set(c.projectName, cur ? `${cur}, ${c.vendor}` : c.vendor);
    }
    return m;
  }, [contracts]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return projects.slice(0, 6);
    const terms = query.split(/\s+/);
    return projects.filter(p => {
      const vendorStr = (vendorIndex.get(p.name) ?? "").toLowerCase();
      const hay = `${p.name} ${p.psId} ${p.state} ${p.district} ${p.sector} ${p.scheme} ${p.status} ${p.projectManager} ${p.contractor} ${vendorStr} ${p.healthStatus === "HEALTHY" ? "healthy low risk" : p.healthStatus === "AT_RISK" ? "at risk medium" : "critical high risk"}`.toLowerCase();
      return terms.every(t => hay.includes(t));
    });
  }, [projects, q, vendorIndex]);

  const clear = () => setQ("");

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight">Project Search</h1>
        <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
          One box that finds everything. Search by <strong className="text-foreground">name, PS-ID, state, district, sector, scheme, manager,
          vendor or risk level</strong> — then jump straight into the project.
        </p>
        <div className="mt-2"><PipelineStrip steps={[
          { label: "Type anything", hint: "Multiple words work: 'water tamil nadu' finds water projects in Tamil Nadu; 'at risk' lists everything flagged." },
          { label: "Scoped results", hint: "Only projects your role can see are searched — the same scoping every other screen respects." },
          { label: "Headline numbers", hint: "Each result shows budget, progress and health so you can decide before you click." },
          { label: "Jump in", hint: "One click opens the full project detail — milestones, budget, documents, Intelligence plan." },
        ]} /></div>
      </div>

      {/* search box */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search projects — try 'Bharatmala', 'water', 'Tamil Nadu', 'at risk'…"
            autoFocus
            className="h-12 w-full rounded-lg border bg-background pl-11 pr-10 text-[14px] outline-none transition placeholder:text-muted-foreground focus:border-[#0c93e7] focus:ring-2 focus:ring-[#0c93e7]/20"
          />
          {q && (
            <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Try</span>
          {QUICK.map(s => (
            <button key={s} onClick={() => setQ(s)}
              className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold transition hover:bg-muted/60",
                q === s ? "border-[#0c93e7] bg-[#e0effe] text-[#015ca0] dark:border-[#0c93e7]/40 dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]" : "bg-card text-muted-foreground")}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[12px] text-muted-foreground">
        {q.trim() ? <><strong className="text-foreground">{results.length}</strong> result{results.length === 1 ? "" : "s"} for &ldquo;{q.trim()}&rdquo;</> : <>Showing the first {Math.min(6, projects.length)} projects — type to filter all {projects.length}</>}
      </p>

      {/* results */}
      {results.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <EmptyState icon={Search} title="No projects match" body={`Nothing in your scope matches "${q.trim()}". Try a shorter word, a state name, a sector like "Roads", or "at risk".`} action={<Button variant="outline" size="sm" onClick={clear}>Clear search</Button>} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {results.map((p, i) => {
            const vendors = vendorIndex.get(p.name);
            return (
              <motion.button key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.25) }}
                onClick={() => openProject(p.id)}
                className="group rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-[#0c93e7]/50 hover:shadow-md hover:shadow-black/5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-bold leading-tight group-hover:underline">{p.name}</p>
                    <p className="mt-0.5 text-[10.5px] text-muted-foreground">{p.psId} · {p.scheme}</p>
                  </div>
                  <HealthBadge status={p.healthStatus} score={p.healthScore} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                    <div className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground"><IndianRupee className="h-2.5 w-2.5" />Budget</div>
                    <div className="mt-0.5 font-bold tabular">{inr(p.totalBudget)}</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                    <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">Progress</div>
                    <div className="mt-0.5 font-bold tabular">{p.progress}%</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                    <div className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground"><MapPin className="h-2.5 w-2.5" />Where</div>
                    <div className="mt-0.5 truncate font-bold">{p.state}</div>
                  </div>
                </div>
                <div className="mt-2.5"><ProgressBar value={p.progress} /></div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="truncate text-[10.5px] text-muted-foreground">
                    {p.sector} · PM {p.projectManager}{vendors ? <span title={vendors} className="ml-1">· <Building2 className="inline h-2.5 w-2.5" /> vendors</span> : null}
                  </span>
                  <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-[#015ca0] dark:text-[#7cc8fb]">
                    Open <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <span className="max-w-xl text-[11.5px] leading-relaxed text-muted-foreground">
          <InfoTip label="Not finding your project?" body="Only projects assigned to your role are searchable. New projects you create appear here immediately, and search also understands vendors from the procurement register." />
          {" "}Search respects your access — the same scoping as every other screen.
        </span>
        <Button variant="outline" size="sm" onClick={() => navigate("projects")}>Advanced project list</Button>
      </div>
    </div>
  );
}
