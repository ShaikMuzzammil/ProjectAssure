"use client";
// ═══════════════════════════════════════════════════════════════════════════
// #/public — Citizen Transparency Portal (no login required).
// "Your money. Your projects." Plain-language status, spending totals and
// delays for every public project — the RTI-style openness view.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { useApp } from "@/store/app-store";
import {
  ArrowLeft, Landmark, MapPin, Search, TrendingDown, TrendingUp, Wallet, CalendarClock, ShieldCheck,
} from "lucide-react";

function fmtCr(lakh: number) {
  const cr = lakh / 100;
  if (cr >= 1000) return `₹${(cr / 1000).toFixed(2)}k Cr`;
  return `₹${cr.toFixed(1)} Cr`;
}

const plainStatus = (p: { status: string; healthStatus: string }) => {
  if (p.status === "COMPLETED") return { label: "Finished", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" };
  if (p.status === "CANCELLED") return { label: "Cancelled", cls: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400" };
  if (p.status === "ON_HOLD") return { label: "Paused", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" };
  if (p.status === "PLANNING") return { label: "Not started yet", cls: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" };
  if (p.healthStatus === "CRITICAL") return { label: "Badly delayed", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" };
  if (p.healthStatus === "AT_RISK") return { label: "Running behind", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" };
  return { label: "On track", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" };
};

const citizenExplain = (p: {
  progress: number; spentBudget: number; totalBudget: number; prediction?: { probability: number; estimatedDays: number } | null; milestones?: { status: string }[];
}) => {
  const spentPct = p.totalBudget > 0 ? Math.round((p.spentBudget / p.totalBudget) * 100) : 0;
  const lateMs = (p.milestones ?? []).filter((m) => m.status === "DELAYED" || m.status === "BLOCKED").length;
  const parts: string[] = [];
  parts.push(`${p.progress}% of the physical work is done and ${spentPct}% of the money is spent.`);
  if (p.prediction && p.prediction.probability > 0.45) {
    parts.push(`Our early-warning system says there is a ${Math.round(p.prediction.probability * 100)}% chance it misses the deadline by about ${p.prediction.estimatedDays} days.`);
  } else {
    parts.push("The early-warning system currently sees no big delay risk.");
  }
  if (lateMs > 0) parts.push(`${lateMs} milestone${lateMs > 1 ? "s are" : " is"} officially marked delayed.`);
  return parts.join(" ");
};

export default function PublicView() {
  const projects = useApp(s => s.projects);
  const goPage = useApp(s => s.goPage);
  const [q, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState("All");

  const publicProjects = useMemo(
    () => projects.filter((p) => p.status !== "CANCELLED"),
    [projects]
  );
  const states = useMemo(
    () => ["All", ...Array.from(new Set(publicProjects.map((p) => p.state))).sort()],
    [publicProjects]
  );

  const filtered = publicProjects.filter((p) => {
    const matchQ = !q || `${p.name} ${p.psId} ${p.district} ${p.state} ${p.sector}`.toLowerCase().includes(q.toLowerCase());
    const matchS = stateFilter === "All" || p.state === stateFilter;
    return matchQ && matchS;
  });

  const totals = useMemo(() => {
    const sanction = publicProjects.reduce((s, p) => s + p.totalBudget, 0);
    const spent = publicProjects.reduce((s, p) => s + p.spentBudget, 0);
    const delayed = publicProjects.filter((p) => p.healthStatus === "AT_RISK" || p.healthStatus === "CRITICAL").length;
    const done = publicProjects.filter((p) => p.status === "COMPLETED").length;
    return { sanction, spent, delayed, done };
  }, [publicProjects]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <button onClick={() => goPage("landing")} className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Home
            </button>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-white/50">
              <Landmark className="h-4 w-4" /> OPEN DATA · NO LOGIN NEEDED
            </span>
          </div>
          <h1 className="mt-6 text-3xl font-extrabold sm:text-4xl">Your money. Your projects.</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/70">
            Every project monitored by ProjectAssure, in plain language. See how much has been
            sanctioned, how much is spent and whether the work is on time — the same numbers the
            officers see, without the jargon.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {[
              { icon: Wallet, label: "Total sanctioned", value: fmtCr(totals.sanction) },
              { icon: TrendingUp, label: "Spent so far", value: fmtCr(totals.spent) },
              { icon: TrendingDown, label: "Running behind", value: `${totals.delayed} projects` },
              { icon: ShieldCheck, label: "Finished", value: `${totals.done} projects` },
            ].map(({ icon: I, label, value }) => (
              <div key={label} className="rounded-xl bg-white/10 p-4 backdrop-blur">
                <I className="h-5 w-5 text-sky-300" />
                <div className="mt-2 text-xl font-bold">{value}</div>
                <div className="text-xs text-white/60">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* filters */}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a project, district or scheme…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-sky-400 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-900"
          >
            {states.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* project cards */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {filtered.map((p) => {
            const st = plainStatus(p);
            return (
              <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-400">{p.psId}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${st.cls}`}>{st.label}</span>
                    </div>
                    <h3 className="mt-1.5 text-[15px] font-bold leading-snug text-slate-900 dark:text-white">{p.name}</h3>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <MapPin className="h-3.5 w-3.5" /> {p.district}, {p.state} · {p.sector}
                    </div>
                  </div>
                </div>

                {/* progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>Work completed</span>
                    <span>{p.progress}%</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full ${p.healthStatus === "CRITICAL" ? "bg-rose-500" : p.healthStatus === "AT_RISK" ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.max(2, p.progress)}%` }}
                    />
                  </div>
                </div>

                <p className="mt-3 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{citizenExplain(p)}</p>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center dark:border-slate-800">
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{fmtCr(p.totalBudget)}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">sanctioned</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{fmtCr(p.spentBudget)}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">spent</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{new Date(p.targetDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">due by</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">
            <CalendarClock className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm">No public projects match your search yet.</p>
          </div>
        )}

        {/* footer */}
        <div className="mt-10 border-t border-slate-200 py-6 text-center text-xs text-slate-400 dark:border-slate-800">
          <p>
            Numbers update automatically as officers upload progress reports. Delays shown here are
            machine-flagged early warnings, not penalties. For official records contact the
            administering department.
          </p>
          <button onClick={() => goPage("landing")} className="mt-3 font-semibold text-sky-700 hover:underline dark:text-sky-300">
            ProjectAssure — Intelligence-Powered Predictive Project Monitoring
          </button>
        </div>
      </div>
    </div>
  );
}
