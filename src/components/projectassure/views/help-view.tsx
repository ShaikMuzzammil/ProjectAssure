"use client";
// ═══════════════════════════════════════════════════════════════════════════
// Help & Guide (v23 — compact and impactful).
// A quick-start, the core loop and short answers. No walls of text.
// ═══════════════════════════════════════════════════════════════════════════
import React from "react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Compass, MousePointerClick, ShieldCheck, Sparkles, ChevronRight, FolderKanban, Camera } from "lucide-react";

const STEPS = [
  { icon: FolderKanban, title: "Create a project", body: "Projects → Create project. Fill the wizard — the live risk preview reacts to every field. Monitoring, prediction and the risk register activate on create, and an activation approval goes to Host Control." },
  { icon: MousePointerClick, title: "Open the project", body: "Click any project for its detail page: overview, milestones, tasks, budget, documents, risks, site evidence and alerts — all live." },
  { icon: Camera, title: "Add proof from the field", body: "Geo-Audit → pick the project → upload a site photo. GPS verification runs instantly and the evidence raises a host review request." },
  { icon: Sparkles, title: "Ask Assure Intelligence", body: "Press / anywhere and ask in plain English — answers cite your own numbers. Ask it to approve or escalate something and the request lands in Host Control in real time." },
  { icon: ShieldCheck, title: "Export and report", body: "Reports → pick a format (PDF / Excel / CSV) or email it — the real PDF is attached to the mail." },
];

const FAQ = [
  ["Is my data saved?", "Yes. With a database connected, everything you create is stored per-user in the cloud and follows your account on any device. Otherwise it persists privately in this browser."],
  ["Are predictions trustworthy?", "Every prediction shows its probability, estimated slip and the ranked factors behind it. A human officer always verifies critical alerts before escalation."],
  ["What is Host Control?", "The administrator's control tower. It sees every user and project, reviews approvals (new projects, documents, site evidence, intelligence requests) and broadcasts alerts — decisions flow back here in seconds."],
  ["Do emails actually send?", "Yes, once an email service is connected by the administrator. Without one, emails are honestly marked SIMULATED in the outbox — and attachments are always built for real."],
  ["What is the live portfolio feed?", "A toggle in the sidebar (off by default) that streams simulated field events — exactly what a live connection would push in production."],
];

export default function HelpView() {
  const navigate = useApp(s => s.navigate);

  return (
    <div className="mx-auto max-w-[900px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Help & Guide</h1>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">Five steps to full value — and quick answers.</p>
        </div>
        <Button size="sm" onClick={() => navigate("projects")}>Create your first project <ChevronRight className="h-3.5 w-3.5" /></Button>
      </div>

      {/* quick start */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight"><Compass className="h-4 w-4 text-[#0c93e7]" />Quick start</h2>
        <div className="mt-3 space-y-2.5">
          {STEPS.map((t, i) => (
            <motion.div key={t.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="flex gap-3 rounded-lg border bg-muted/30 p-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0c93e7]/10 text-[#015ca0] dark:text-[#7cc8fb]"><t.icon className="h-4.5 w-4.5" /></div>
              <div>
                <div className="text-[12.5px] font-bold">{i + 1} · {t.title}</div>
                <div className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{t.body}</div>
              </div>
            </motion.div>
          ))}
        </div>
        {/* the core loop */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0b426e]/5 to-[#0c93e7]/10 p-3 dark:from-[#0b426e]/30 dark:to-[#0c93e7]/10">
          {["DATA", "PREDICT", "EXPLAIN", "ACT", "VERIFY"].map((s, i, arr) => (
            <React.Fragment key={s}>
              <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#015ca0] shadow-sm dark:text-[#7cc8fb]">{s}</span>
              {i < arr.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-[15px] font-bold tracking-tight">Quick answers</h2>
        <div className="mt-2.5 space-y-2">
          {FAQ.map(([qq, aa]) => (
            <details key={qq} className="group rounded-lg border bg-muted/20 p-3">
              <summary className="cursor-pointer list-none text-[12.5px] font-bold">{qq}<ChevronRight className="ml-1 inline h-3.5 w-3.5 transition group-open:rotate-90" /></summary>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">{aa}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
