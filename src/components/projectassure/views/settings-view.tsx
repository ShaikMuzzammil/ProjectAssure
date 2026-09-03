"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Info, ShieldCheck, Users2, X } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { ROLES_CONFIG, USERS } from "@/lib/projectassure/engine";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { SectionTitle } from "../shared/ui-bits";
import { toast } from "sonner";

const TABS = ["Users", "Roles", "Thresholds", "Deployment"] as const;

export function SettingsView() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Users");
  const [amber, setAmber] = useState(60);
  const [red, setRed] = useState(40);

  const dist = [
    { name: "Healthy", value: Math.max(0, 100 - amber), color: "#22c55e" },
    { name: "At Risk", value: amber - red, color: "#f59e0b" },
    { name: "Critical", value: red, color: "#ef4444" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
        <p className="text-sm text-muted-foreground">RBAC, thresholds and deployment posture · every mutation here writes an audit-log entry</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium transition-colors ${tab === t ? "border-b-2 border-[#0c93e7] text-[#0c93e7]" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "Users" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">User</th><th className="px-4 py-3 font-medium">Persona</th><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 font-medium">Department</th><th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {USERS.map((u) => (
                <tr key={u.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0c93e7]/10 text-xs font-bold text-[#0c93e7]">{u.avatarInitials}</span>
                      <div><p className="font-medium">{u.name}</p><p className="text-[11px] text-muted-foreground">{u.email}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs"><p className="font-medium">{u.persona}</p><p className="max-w-[280px] text-muted-foreground">{u.personaDescription}</p></td>
                  <td className="px-4 py-3"><select defaultValue={u.role} className="rounded-md border border-input bg-background px-2 py-1 text-xs" onChange={() => toast.success("Role updated · audit log entry written")}>{["ADMIN", "PROJECT_MANAGER", "STAKEHOLDER", "VIEWER"].map((r) => <option key={r}>{r}</option>)}</select></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.departmentId.replace("dept-", "").toUpperCase()}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-bold text-[#15803d] dark:bg-green-500/15 dark:text-green-300">ACTIVE</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {tab === "Roles" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ROLES_CONFIG.map((r, i) => (
            <motion.div key={r.role} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0c93e7]/10 text-[#0c93e7]"><ShieldCheck className="h-4.5 w-4.5" /></span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{r.users} user{r.users !== "1" ? "s" : ""}</span>
              </div>
              <p className="text-sm font-bold">{r.label}</p>
              <p className="mb-3 font-mono text-[10px] text-muted-foreground">{r.role}</p>
              <ul className="space-y-1.5">
                {r.capabilities.map((c) => (
                  <li key={c} className="flex items-start gap-1.5 text-xs"><Check className="mt-0.5 h-3 w-3 shrink-0 text-[#16a34a]" />{c}</li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      )}

      {tab === "Thresholds" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <SectionTitle title="Health classification thresholds" sub="Live preview of band changes" />
            <div className="mt-4 space-y-6">
              <div>
                <div className="flex justify-between text-sm"><span className="font-medium">Amber threshold (HEALTHY below)</span><span className="font-bold tabular-nums text-[#d97706]">{amber}</span></div>
                <input type="range" min={50} max={80} value={amber} onChange={(e) => setAmber(Number(e.target.value))} className="mt-2 w-full accent-[#f59e0b]" />
              </div>
              <div>
                <div className="flex justify-between text-sm"><span className="font-medium">Red threshold (AT_RISK below)</span><span className="font-bold tabular-nums text-[#dc2626]">{red}</span></div>
                <input type="range" min={20} max={60} value={red} onChange={(e) => setRed(Number(e.target.value))} className="mt-2 w-full accent-[#ef4444]" />
              </div>
              <button onClick={() => toast.success("Thresholds saved · audit log entry written")} className="w-full rounded-md bg-[#0c93e7] py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0b426e]">Save thresholds</button>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <SectionTitle title="Live band preview" sub="Score distribution under new thresholds" />
            <div className="mt-2 flex items-center justify-center gap-8">
              <div className="relative h-44 w-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dist} dataKey="value" innerRadius={55} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {dist.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold tabular-nums">0-100</span>
                  <span className="text-[10px] uppercase text-muted-foreground">health score</span>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#22c55e]" />HEALTHY · {red}-{amber} pts above {amber}</p>
                <p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />AT_RISK · {red}–{amber}</p>
                <p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#ef4444]" />CRITICAL · below {red}</p>
                <p className="flex max-w-[220px] items-start gap-1 pt-2 text-muted-foreground"><Info className="mt-0.5 h-3 w-3 shrink-0" />Default SIH spec: Green ≥75 · Amber 50–74 · Red &lt;50. Changes apply portfolio-wide on the next scoring run.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "Deployment" && (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { t: "projectassure.vercel.app", d: "Main app — dashboards, projects, alerts, reports", tone: "#0c93e7" },
            { t: "analytics.projectassure.vercel.app", d: "Analytics domain — portfolio intelligence & exports", tone: "#8b5cf6" },
            { t: "ai.projectassure.vercel.app", d: "AI engine domain — chat, RAG, prediction service", tone: "#14b8a6" },
          ].map((c, i) => (
            <motion.div key={c.t} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.tone }} />
              <p className="mt-2 break-all font-mono text-xs font-semibold">{c.t}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.d}</p>
              <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-bold text-[#15803d] dark:bg-green-500/15 dark:text-green-300"><Users2 className="h-3 w-3" />SHARED JWT SSO</p>
            </motion.div>
          ))}
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm md:col-span-3">
            <SectionTitle title="Environment variables (12)" sub="Full list documented in DEPLOYMENT_GUIDE.md · free-tier total ₹0" />
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              {["DATABASE_URL", "DIRECT_URL", "NEXTAUTH_URL", "NEXTAUTH_SECRET", "EMAIL_USER / PASS", "UPSTASH_REDIS_*", "BLOB_READ_WRITE_TOKEN", "MAIN/ANALYTICS/AI URLS", "OPENAI_API_KEY", "GEMINI_API_KEY", "PINECONE_API_KEY", "PINECONE_INDEX_HOST"].map((v) => (
                <span key={v} className="rounded-md border border-border bg-muted/50 px-2 py-1.5 font-mono text-[10px]">{v}</span>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">This prototype runs 100% client-side — no keys required. The production stack above activates when you deploy with real keys (see docs/DEPLOYMENT_GUIDE.md).</p>
          </div>
        </div>
      )}
    </div>
  );
}
