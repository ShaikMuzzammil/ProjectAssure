"use client";
import React, { useState } from "react";
import { useAdminStore } from "@/store/admin-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Vault,
  Lock,
  Unlock,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Building2,
  Hash,
  X,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { relTime } from "@/lib/host/format";
import { motion, AnimatePresence } from "framer-motion";
import type { Project } from "@/lib/host/types";

// v21: Project Vault — secure project storage view. Shows every project synced
// from the main app with security metadata: lock state, integrity hash,
// document count, last audit + access log. Lock/unlock is audit-logged.

export function ProjectVault() {
  const { projects, setSelectedProject, selectedProjectId } = useAdminStore();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "locked" | "open">("all");

  const list = projects
    .filter((p) => filter === "all" || (filter === "locked" ? p.locked : !p.locked))
    .filter(
      (p) =>
        !search.trim() ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.psId.toLowerCase().includes(search.toLowerCase()),
    );

  const selected = projects.find((p) => p.id === selectedProjectId) || null;
  const lockedCount = projects.filter((p) => p.locked).length;

  const toggleLock = async (p: Project) => {
    await fetch("/api/admin/project-lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, locked: !p.locked, by: "CPO" }),
    });
    toast.success(`${p.psId} ${p.locked ? "unlocked" : "locked"}`);
    const r = await fetch("/api/admin/sync");
    useAdminStore.getState().hydrate(await r.json());
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Project Vault</h2>
        <p className="text-xs text-slate-500">
          Secure storage view of every project. Locked projects are read-only to viewers and their access is audit-logged.
        </p>
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects by name or PS ID…"
          className="h-9 w-full max-w-md rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0c93e7]"
        />
        <div className="flex gap-1.5">
          {(
            [
              ["all", `All (${projects.length})`],
              ["locked", `Locked (${lockedCount})`],
              ["open", `Open (${projects.length - lockedCount})`],
            ] as ["all" | "locked" | "open", string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition",
                filter === k ? "bg-[#0b426e] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Project grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 hover:border-[#0c93e7]/40"
            onClick={() => setSelectedProject(p.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#0c93e7]" />
                <span className="font-mono text-[10px] text-slate-500">{p.psId}</span>
              </div>
              {p.locked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold text-rose-700">
                  <Lock className="h-3 w-3" /> LOCKED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                  <Unlock className="h-3 w-3" /> OPEN
                </span>
              )}
            </div>
            <div className="mt-1.5 text-xs font-bold leading-tight">{p.name}</div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3 w-3" /> {p.documentsCount} docs
              </span>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> {p.healthScore} health
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[9px] text-slate-400">
              <Hash className="h-3 w-3" />
              <span className="truncate font-mono">{p.integrityHash}</span>
            </div>
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLock(p);
                }}
              >
                {p.locked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                {p.locked ? "Unlock" : "Lock"}
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Slide-over detail */}
      <ProjectDetailSlideOver
        project={selected}
        onClose={() => setSelectedProject(null)}
        onToggleLock={toggleLock}
      />
    </div>
  );
}

function ProjectDetailSlideOver({
  project,
  onClose,
  onToggleLock,
}: {
  project: Project | null;
  onClose: () => void;
  onToggleLock: (p: Project) => void;
}) {
  if (!project) return null;
  return (
    <AnimatePresence>
      {project && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <Vault className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-white/70">{project.psId}</span>
                  {project.locked ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/30 px-2 py-0.5 text-[9px] font-bold text-rose-100">
                      <Lock className="h-3 w-3" /> LOCKED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/30 px-2 py-0.5 text-[9px] font-bold text-emerald-100">
                      <Unlock className="h-3 w-3" /> OPEN
                    </span>
                  )}
                </div>
                <h3 className="mt-0.5 truncate text-base font-bold">{project.name}</h3>
                <div className="text-[10px] text-white/70">
                  {project.state} · {project.sector}
                </div>
              </div>
              <button onClick={onClose} className="rounded-md p-1 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Security metadata */}
              <div className="grid grid-cols-3 gap-2">
                <Meta label="Documents" value={String(project.documentsCount)} icon={<FileText className="h-3 w-3" />} />
                <Meta label="Health score" value={String(project.healthScore)} icon={<ShieldCheck className="h-3 w-3" />} />
                <Meta
                  label="Variance"
                  value={`${project.variancePct.toFixed(1)}%`}
                  icon={<ShieldAlert className="h-3 w-3" />}
                />
              </div>

              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-[10px] font-bold uppercase text-slate-500">Integrity hash</div>
                <div className="mt-1 break-all font-mono text-[10px] text-slate-700">{project.integrityHash}</div>
              </div>

              {project.lastAuditAt && (
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Last audit</div>
                  <div className="mt-1 text-[11px] text-slate-700">{relTime(project.lastAuditAt)}</div>
                </div>
              )}

              {/* Budget */}
              <Section title="Budget">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="Sanctioned" value={`₹${(project.totalBudgetL / 100).toFixed(0)} Cr`} />
                  <Stat label="Spent" value={`₹${(project.spentBudgetL / 100).toFixed(0)} Cr`} />
                  <Stat label="Projected" value={`₹${(project.projectedBudgetL / 100).toFixed(0)} Cr`} />
                </div>
              </Section>

              {/* Access log */}
              <Section title={`Access log (${project.accessLog.length})`}>
                {project.accessLog.length === 0 ? (
                  <Empty>No access events logged</Empty>
                ) : (
                  <div className="space-y-1">
                    {project.accessLog.map((al) => (
                      <div key={al.id} className="flex items-start gap-2 border-b border-dashed border-slate-100 py-1 text-[10px] last:border-0">
                        <History className="mt-0.5 h-3 w-3 shrink-0 text-[#0c93e7]" />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold">
                            {al.userName} — <span className="font-mono text-slate-500">{al.action}</span>
                          </div>
                          <div className="text-[9px] text-slate-400">{relTime(al.at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <div className="mt-4 flex gap-2">
                <Button size="sm" variant={project.locked ? "default" : "destructive"} onClick={() => onToggleLock(project)}>
                  {project.locked ? (
                    <>
                      <Unlock className="h-3.5 w-3.5" /> Unlock project
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" /> Lock project
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Meta({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
      <div className="flex items-center justify-center text-[#0c93e7]">{icon}</div>
      <div className="mt-1 text-sm font-bold tabular">{value}</div>
      <div className="text-[9px] text-slate-500">{label}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
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
