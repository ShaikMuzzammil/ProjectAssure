"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Onboarding tour — shows once for first-time visitors (tourSeen=false).
// A 4-step guided walkthrough that literally points at where to click.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Compass, MousePointerClick, Sparkles, ShieldCheck, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: Compass,
    title: "Start with “Requires attention today”",
    body: "The Command Centre answers the only question that matters first: what needs you today — with the plain-language reason for each project. Click any row's “What to do” to see its recommended actions.",
    cta: { label: "See the attention list", view: "dashboard" as const },
  },
  {
    icon: MousePointerClick,
    title: "Open any project — 10 tabs deep",
    body: "Every project has: plain-English executive summary, KPIs (target vs actual), milestones, Kanban, budget with overrun forecast, resources, document vault, explainable risk, plan of action and full audit trail.",
    cta: { label: "Open a project", view: "projects" as const },
  },
  {
    icon: Sparkles,
    title: "Ask Assure Intelligence anything",
    body: "Press / (or the blue button, bottom-right) and ask “Why is Bharatmala P-4 at risk?”. Answers cite real numbers, show the tools that ran, and never invent figures. When a live intelligence service is connected, live mode is one toggle.",
    cta: { label: "Try the assistant", view: "ai-assistant" as const },
  },
  {
    icon: ShieldCheck,
    title: "Track problems to closure",
    body: "Recommended actions become tracked interventions: Detected → Reviewed → Action Assigned → Under Investigation → Resolved → Verified → Closed, with owners, deadlines and evidence. Export everything as PDF/Excel, email reports, and check Help & Glossary any time a term is unclear.",
    cta: { label: "Read the glossary", view: "help" as const },
  },
];

export default function OnboardingTour() {
  const tourSeen = useApp(s => s.tourSeen);
  const markTourSeen = useApp(s => s.markTourSeen);
  const navigate = useApp(s => s.navigate);
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(!tourSeen);

  if (tourSeen || !open) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-4 backdrop-blur-sm sm:items-center">
        <motion.div initial={{ y: 24, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-lg overflow-hidden rounded-2xl border bg-card shadow-2xl">
          {/* progress */}
          <div className="flex h-1 bg-muted">
            {STEPS.map((_, i) => <div key={i} className={cn("h-full flex-1 transition-all", i <= step ? "bg-[#0c93e7]" : "")} />)}
          </div>
          <div className="p-6">
            <button onClick={() => { markTourSeen(); setOpen(false); }} className="float-right rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-white shadow-lg"><s.icon className="h-5.5 w-5.5" /></div>
              <div className="min-w-0">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#0c93e7] dark:text-[#36adf6]">Welcome · step {step + 1} of {STEPS.length}</div>
                <h3 className="mt-0.5 text-[16px] font-bold leading-snug">{s.title}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { markTourSeen(); setOpen(false); }}>Skip the tour</Button>
              <div className="ml-auto flex gap-2">
                {step > 0 && <Button variant="outline" size="sm" onClick={() => setStep(v => v - 1)}>Back</Button>}
                <Button size="sm" className="bg-gradient-to-r from-[#0b426e] to-[#0c93e7]"
                  onClick={() => {
                    if (last) { markTourSeen(); setOpen(false); navigate("dashboard"); }
                    else setStep(v => v + 1);
                  }}>
                  {last ? "Start monitoring" : "Next"} <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {/* quick links */}
            <div className="mt-4 flex flex-wrap gap-1.5 border-t pt-3.5">
              {STEPS.map((st, i) => (
                <button key={st.title} onClick={() => { markTourSeen(); setOpen(false); navigate(st.cta.view); }}
                  className={cn("rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition hover:border-[#0c93e7]/50 hover:text-[#015ca0] dark:hover:text-[#7cc8fb]", i === step && "border-[#0c93e7]/50 text-[#015ca0] dark:text-[#7cc8fb]")}>
                  {st.cta.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
