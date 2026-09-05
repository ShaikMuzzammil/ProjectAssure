"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { USERS, ROLES_CONFIG } from "@/lib/projectassure/seed";
import { TEAM_MEMBERS } from "@/lib/projectassure/team";
import { ShieldAlert, ArrowLeft, Users, Scale, Target, FileCheck2, Landmark, GraduationCap, Eye, Copy, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import GovHeader from "../shared/gov-header";

const fadeUp = { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } };

const SECTIONS = [
  { icon: Target, t: "Mission", b: "Give the ministry a single pane of glass over the national central-sector portfolio — moving from after-the-fact reporting to 30–60-day early warning on both schedule and cost, with an audit trail a parliamentary committee can trust." },
  { icon: Landmark, t: "Problem statement", b: "SIH26103 · Theme: Smart Automation · Category: Software · Organisation: MoSPI. “Use case on web-based integrated project-monitoring platform.” 1,800+ projects of ₹150 Cr+ each, ~27,000 report pages monthly, 4–12 week data latency, average overruns of ~50 months and 20%+ cost." },
  { icon: Scale, t: "What we are NOT", b: "Not a payments system, not a site-execution or procurement tool, not an autonomous decision-maker, not a data-warehouse migration. ProjectAssure sits above execution systems as the monitoring, prediction and governance layer — recommendations always carry a human-verification requirement." },
  { icon: FileCheck2, t: "Integrity & compliance", b: "Built on open-source libraries (permissive licences) with clearly declared external AI services where used. AI-assisted development is disclosed per SIH academic-integrity rules; every external dependency is cited in the deck’s references slide." },
];

function PersonaCard({ u, onCopy, copied }: { u: typeof USERS[number]; onCopy: (u: typeof USERS[number]) => void; copied: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-[12px] font-bold text-white">{u.avatarInitials}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13.5px] font-bold">{u.name}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[9.5px] font-semibold">{u.role.replace("_", " ")}</span>
          </div>
          <div className="text-[11px] font-medium text-muted-foreground">{u.designation}</div>
          <div className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{u.personaDescription}</div>

          {/* full sign-in line — visible because the whole section is revealed */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/40 px-2.5 py-1.5">
            <span className="font-mono text-[10.5px] font-semibold text-foreground">{u.email}</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-mono text-[10.5px] text-foreground">{u.password}</span>
            <button onClick={() => onCopy(u)} className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-[#0c93e7] transition hover:underline dark:text-[#36adf6]">
              {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AboutView() {
  const goPage = useApp(s => s.goPage);
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (u: typeof USERS[number]) => {
    navigator.clipboard?.writeText(`${u.email} / ${u.password}`).catch(() => {});
    setCopied(u.id);
    setTimeout(() => setCopied(null), 1600);
    toast.success("Demo sign-in copied", { description: `${u.email} — paste on the login page` });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <GovHeader surface="public" />
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          <button onClick={() => goPage("landing")} className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> ProjectAssure
          </button>
          <span className="text-[14px] font-semibold">About the project</span>
          <button onClick={() => goPage("login")} className="ml-auto rounded-lg bg-gradient-to-r from-[#0b426e] to-[#0c93e7] px-3.5 py-1.5 text-[12.5px] font-semibold text-white">Launch demo</button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#0c93e7] to-[#0b426e] text-white shadow-md">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-[24px] font-extrabold tracking-tight">ProjectAssure</h1>
              <p className="text-[12.5px] text-muted-foreground">Intelligence-Powered Predictive Project Monitoring Platform · SIH 2026</p>
            </div>
          </div>
          <p className="mt-5 text-[14px] leading-relaxed text-muted-foreground">
            ProjectAssure is built for problem statement <strong className="text-foreground">SIH26103</strong> — engineered to demonstrate national scale (10,000+ projects), delay prediction with explainable intelligence, document intelligence over legacy paper workflows, and governance by design — all on one secure web address.
          </p>
        </motion.div>

        <div className="mt-9 grid gap-3.5 sm:grid-cols-2">
          {SECTIONS.map(s => (
            <motion.div key={s.t} {...fadeUp} className="rounded-xl border bg-card p-5">
              <s.icon className="h-5 w-5 text-[#0c93e7] dark:text-[#36adf6]" />
              <h3 className="mt-2.5 text-[14.5px] font-bold">{s.t}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{s.b}</p>
            </motion.div>
          ))}
        </div>

        {/* ─── Team NEXGEN — 6 members ─── */}
        <motion.div {...fadeUp} className="mt-10">
          <h2 className="flex items-center gap-2 text-[17px] font-bold"><GraduationCap className="h-4.5 w-4.5 text-[#0c93e7]" />Team NEXGEN — the six of us</h2>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            Amrita Vishwa Vidyapeetham, Chennai Campus. The prototype, documentation set, six-slide SIH deck and this deployment are all student-built, with AI-assisted development declared openly per SIH integrity rules.
          </p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {TEAM_MEMBERS.map(m => (
              <div key={m.name + m.initials} className="flex items-start gap-3 rounded-xl border bg-card p-4 transition hover:border-[#0c93e7]/40">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-[12px] font-bold text-white">{m.initials}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13.5px] font-bold">{m.name}</span>
                    <span className="rounded-full bg-[#e0effe] px-2 py-0.5 text-[9.5px] font-bold text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]">NEXGEN</span>
                  </div>
                  <div className="text-[11px] font-semibold text-[#0c93e7] dark:text-[#36adf6]">{m.role}</div>
                  <div className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{m.focus}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ─── Demo personas — one toggle beside the heading reveals the ENTIRE section (v8) ─── */}
        <motion.div {...fadeUp} className="mt-10">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
            <h2 className="flex items-center gap-2 text-[16px] font-bold"><Users className="h-4.5 w-4.5 text-[#0c93e7]" />Demo users — try each role</h2>
            <label className="ml-auto flex cursor-pointer items-center gap-2">
              <Eye className="h-4 w-4 text-[#0c93e7] dark:text-[#36adf6]" />
              <span className="text-[12px] font-semibold">{reveal ? "Hide demo users" : "Reveal demo users"}</span>
              <Switch checked={reveal} onCheckedChange={setReveal} aria-label="Reveal the detailed demo users section" />
            </label>
          </div>
          {reveal ? (
            <>
              <p className="mt-3 text-[12px] text-muted-foreground">One demo account per role · permissions are enforced in the app · passwords are demo-only.</p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {USERS.map(u => <PersonaCard key={u.id} u={u} onCopy={copy} copied={copied === u.id} />)}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {ROLES_CONFIG.map(r => (
                  <div key={r.role} className="rounded-xl border bg-muted/30 p-3.5">
                    <div className="text-[11.5px] font-bold">{r.title}</div>
                    <ul className="mt-1.5 space-y-1">
                      {r.capabilities.map(c => <li key={c} className="text-[10.5px] leading-snug text-muted-foreground">• {c}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <button onClick={() => setReveal(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-4 py-5 text-[12px] font-medium text-muted-foreground transition hover:border-[#0c93e7]/40 hover:text-foreground">
              <Eye className="h-4 w-4" /> Demo accounts hidden — switch on “Reveal demo users” to see all four demo persons with their sign-in details
            </button>
          )}
        </motion.div>

        <motion.div {...fadeUp} className="mt-8 rounded-xl border bg-muted/30 p-5">
          <h2 className="flex items-center gap-2 text-[14.5px] font-bold"><Check2Icon />Learn more</h2>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            The submission package includes plain-language engineering documents (architecture, data design, deployment, workflows), a user guide with a step-by-step jury script, and a deployment guide that takes the whole platform live at a single web address.
          </p>
        </motion.div>
      </main>

      <footer className="border-t py-5 text-center text-[11px] text-muted-foreground">
        ProjectAssure · SIH 2026 · SIH26103 · Team NEXGEN · Amrita Vishwa Vidyapeetham Chennai
      </footer>
    </div>
  );
}

function Check2Icon() {
  return <FileCheck2 className="h-4 w-4 text-[#0c93e7] dark:text-[#36adf6]" />;
}
