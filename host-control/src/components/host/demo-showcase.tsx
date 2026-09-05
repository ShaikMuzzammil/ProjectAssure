"use client";

import { motion } from "framer-motion";
import {
  CircleDot, ExternalLink, ArrowRight, Building2, CheckCircle2,
  Activity, ShieldCheck, Gauge, BrainCircuit, Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAdminStore } from "@/store/admin-store";
import { SHOWCASE_STATS, DEMO_CARDS } from "@/lib/host/seed";
import { cn } from "@/lib/utils";

const ACCENT: Record<string, { ring: string; text: string; bg: string; bar: string }> = {
  blue:   { ring: "ring-brand-200 dark:ring-brand-500/30", text: "text-brand-700 dark:text-brand-300", bg: "bg-brand-50 dark:bg-brand-500/10", bar: "bg-brand-500" },
  emerald:{ ring: "ring-emerald-200 dark:ring-emerald-500/30", text: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-500/10", bar: "bg-emerald-500" },
  amber:   { ring: "ring-amber-200 dark:ring-amber-500/30", text: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-500/10", bar: "bg-amber-500" },
  rose:    { ring: "ring-rose-200 dark:ring-rose-500/30", text: "text-rose-700 dark:text-rose-300", bg: "bg-rose-50 dark:bg-rose-500/10", bar: "bg-rose-500" },
};

export function DemoShowcase() {
  const { integration } = useAdminStore();
  const baseUrl = integration?.mainProjectUrl ?? "https://project-assure.vercel.app";

  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl border bg-card host-hero-mesh host-grid-bg"
      >
        <div className="relative px-6 py-10 md:px-10 md:py-14 max-w-4xl">
          <Badge variant="outline" className="mb-3 gap-1 border-brand-300 text-brand-700 bg-brand-50 dark:bg-brand-500/15 dark:text-brand-300">
            <CircleDot className="size-3" /> SIH 2026 · SIH26103 · Team NEXGEN
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            ProjectAssure Control Plane
          </h2>
          <p className="mt-2 text-lg md:text-xl text-muted-foreground">
            One pane of glass for India&apos;s infrastructure portfolio.
          </p>
          <p className="mt-4 max-w-2xl text-sm md:text-base text-muted-foreground leading-relaxed">
            The host domain aggregates <strong className="text-foreground">1,800+ central-sector projects</strong> across 5 MoSPI divisions —
            mission control, approvals, budget risk, alerts aggregation, audit, and an intelligence console powered by the same Gemini/Groq chain as the prototype.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild size="lg" className="gap-2">
              <a href={baseUrl} target="_blank" rel="noopener noreferrer">
                Open main prototype <ExternalLink className="size-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2">
              <a href={`${baseUrl}/?login=demo`} target="_blank" rel="noopener noreferrer">
                Try demo personas <ArrowRight className="size-4" />
              </a>
            </Button>
          </div>

          {/* Stats strip */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
            {SHOWCASE_STATS.map(s => (
              <div key={s.label} className="rounded-lg border bg-card/60 backdrop-blur p-3">
                <div className="tabular text-2xl font-bold text-brand-700 dark:text-brand-300">{s.value}</div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Demo project cards */}
      <div>
        <div className="flex items-end justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Featured demo projects</h3>
            <p className="text-sm text-muted-foreground">Try each project live in the main prototype.</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <a href={baseUrl} target="_blank" rel="noopener noreferrer">
              See all projects <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DEMO_CARDS.map((card, i) => {
            const accent = ACCENT[card.accent];
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className={cn("h-full overflow-hidden ring-1", accent.ring)}>
                  <div className={cn("h-1.5", accent.bar)} />
                  <CardContent className="p-5 flex flex-col gap-3 h-full">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold leading-tight">{card.title}</div>
                        <div className="text-xs text-muted-foreground">{card.subtitle}</div>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px]", accent.text, accent.bg, "border-transparent")}>
                        {card.ministry}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className={cn("tabular text-2xl font-bold", accent.text)}>{card.value}</div>
                      <div className="text-[11px] text-muted-foreground">{card.metric}</div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug flex-1">{card.description}</p>
                    <Button asChild size="sm" variant="outline" className={cn("gap-1.5 w-full", accent.text)}>
                      <a href={`${baseUrl}${card.mainProjectPath}`} target="_blank" rel="noopener noreferrer">
                        Try in main app <ExternalLink className="size-3.5" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Capability grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[
          { icon: Gauge, title: "Mission Control", desc: "Aggregated KPIs, health bands, top-5 at-risk projects, live activity ticker. Every number grounded in the seed." },
          { icon: CheckCircle2, title: "Approval Centre", desc: "Change orders, budget increases, extension-of-time, procurement — approve/reject with audit log." },
          { icon: Activity, title: "Alerts Aggregation", desc: "Every alert across every project, filterable by severity, department, source. One-click broadcast." },
          { icon: BrainCircuit, title: "Intelligence Console", desc: "Universal + grounded modes, file upload, export to PDF/MD/TXT. Same Gemini → Groq → OpenRouter → OpenAI chain." },
          { icon: ShieldCheck, title: "Audit Trail", desc: "Every admin action logged with timestamp, admin, action, target, note. Exportable to CSV." },
          { icon: Sparkles, title: "Real-time Sync", desc: "Polls /api/admin/sync every 5 seconds; live indicator + force-resync button. Mirrors main prototype." },
        ].map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                      <Icon className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="font-semibold text-sm">{c.title}</div>
                      <div className="text-xs text-muted-foreground leading-snug">{c.desc}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* CTA */}
      <Card className="bg-gradient-to-r from-brand-50 to-emerald-50 dark:from-brand-500/10 dark:to-emerald-500/10 border-brand-200 dark:border-brand-500/30">
        <CardContent className="p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <Building2 className="size-5 text-brand-700 dark:text-brand-300" />
              <h3 className="text-xl md:text-2xl font-bold tracking-tight">Connect your ministry&apos;s portfolio</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ProjectAssure Host Control is deployment-ready for any central-sector ministry. Fork the repo, set your env vars, and import to Vercel —
              the host-control polls your main ProjectAssure prototype and surfaces a unified mission control for your officers.
            </p>
          </div>
          <Button asChild size="lg" className="gap-2 shrink-0">
            <a href={baseUrl} target="_blank" rel="noopener noreferrer">
              Get started <ArrowRight className="size-4" />
            </a>
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <div className="text-center text-xs text-muted-foreground pb-6">
        ProjectAssure Host Control · SIH 2026 · SIH26103 · Team NEXGEN · Amrita Vishwa Vidyapeetham Chennai ·{" "}
        <a href={baseUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{baseUrl}</a>
      </div>
    </div>
  );
}
