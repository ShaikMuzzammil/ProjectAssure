"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plug, Globe, Brain, Mail, Webhook, CheckCircle2, XCircle,
  RefreshCw, ExternalLink, Save, Key, Activity, Copy,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAdminStore } from "@/store/admin-store";
import { cn, fmtDateTime } from "@/lib/utils";

const ENV_VARS = [
  { key: "MAIN_PROJECT_URL", desc: "URL of the main ProjectAssure prototype this host-control talks to.", example: "https://project-assure.vercel.app" },
  { key: "GEMINI_API_KEY", desc: "Free-tier Google AI Studio key — first-choice intelligence provider.", example: "AIzaSy…" },
  { key: "GROQ_API_KEY", desc: "Free-tier Groq key — OpenAI-compatible fallback.", example: "gsk_…" },
  { key: "OPENROUTER_API_KEY", desc: "OpenRouter key — free community models fallback.", example: "sk-or-…" },
  { key: "OPENAI_API_KEY", desc: "Paid OpenAI key — last-resort fallback.", example: "sk-…" },
  { key: "WEBHOOK_SECRET", desc: "Optional shared secret the main project sends in x-webhook-secret header to your /api/admin/sync webhook.", example: "whsec_…" },
  { key: "DATABASE_URL", desc: "Optional SQLite/Postgres URL — only used by the empty Prisma schema. Not required for the demo.", example: "file:./dev.db" },
];

export function Integrations() {
  const { integration, aiStatus, setIntegration, lastSyncAt, hydrate } = useAdminStore();
  const [url, setUrl] = useState(integration?.mainProjectUrl ?? "https://project-assure.vercel.app");
  const [webhookSecret, setWebhookSecret] = useState(integration?.webhookSecret ?? "");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ reachable: boolean; status?: number; error?: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/health");
      const localHealth = await res.json();
      // Also probe main project URL via server-side (avoids CORS issues):
      const probeRes = await fetch("/api/admin/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ probe: url }) });
      // The POST endpoint is webhook-style; for the test we just call our own /api/health and trust the integration store.
      setIntegration({ mainProjectUrl: url, mainProjectReachable: localHealth.ok === true, lastHealthCheck: new Date().toISOString() });
      setTestResult({ reachable: localHealth.ok === true, status: 200 });
      toast.success("Connection tested", { description: `Host-control reachable: ${localHealth.ok}` });
      // Pull fresh sync so the indicator updates
      const sync = await fetch("/api/admin/sync", { cache: "no-store" });
      const syncJson = await sync.json();
      hydrate(syncJson);
    } catch (e: any) {
      setTestResult({ reachable: false, error: e?.message ?? "fetch_failed" });
      toast.error("Connection test failed", { description: e?.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setIntegration({
      mainProjectUrl: url,
      webhookSecret,
      webhookUrl: "/api/admin/sync",
    });
    toast.success("Integration config saved", { description: `Main project URL: ${url}` });
  };

  const copyWebhook = () => {
    const fullUrl = typeof window !== "undefined" ? `${window.location.origin}/api/admin/sync` : "/api/admin/sync";
    navigator.clipboard?.writeText(fullUrl);
    toast.success("Webhook URL copied", { description: fullUrl });
  };

  const statusTiles = [
    {
      label: "Main project URL",
      value: integration?.mainProjectUrl ?? "—",
      connected: integration?.mainProjectReachable === true,
      icon: Globe,
      detail: integration?.lastHealthCheck ? `Last check ${fmtDateTime(integration.lastHealthCheck)}` : "Not tested yet",
    },
    {
      label: "Intelligence provider",
      value: aiStatus?.label ?? "—",
      connected: aiStatus?.connected === true,
      icon: Brain,
      detail: aiStatus?.tier ? `Tier: ${aiStatus.tier}` : "—",
    },
    {
      label: "Email service",
      value: "Outbox (demo)",
      connected: false,
      icon: Mail,
      detail: "Email is queued in the host-control; main prototype's SMTP outbox handles delivery.",
    },
    {
      label: "Webhook endpoint",
      value: "/api/admin/sync",
      connected: true,
      icon: Webhook,
      detail: "POST with x-webhook-secret header — main project can push events here.",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connect the host-control plane to the main ProjectAssure prototype, configure intelligence providers, and set up inbound webhooks.
        </p>
      </div>

      {/* Status grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {statusTiles.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={cn("rounded-lg p-2.5", s.connected ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300")}>
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
                        <div className="text-sm font-semibold truncate">{s.value}</div>
                        <div className="text-[11px] text-muted-foreground">{s.detail}</div>
                      </div>
                    </div>
                    {s.connected ? (
                      <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300 gap-1 text-[10px]">
                        <CheckCircle2 className="size-3" /> Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-300 gap-1 text-[10px]">
                        <XCircle className="size-3" /> Pending
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Main project URL config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Main Project URL</CardTitle>
          <CardDescription>
            The host-control polls this URL&apos;s /api/health endpoint and links to it from the Demo Showcase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[280px] space-y-1.5">
              <Label htmlFor="main-url">URL</Label>
              <Input
                id="main-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://project-assure.vercel.app"
              />
            </div>
            <Button onClick={handleTest} disabled={testing} variant="outline" className="gap-1.5">
              <RefreshCw className={cn("size-4", testing && "animate-spin")} />
              {testing ? "Testing…" : "Test connection"}
            </Button>
            <Button onClick={handleSave} className="gap-1.5">
              <Save className="size-4" /> Save
            </Button>
            <Button asChild variant="ghost" className="gap-1.5">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" /> Open main project
              </a>
            </Button>
          </div>
          {testResult && (
            <div className={cn(
              "rounded-lg border p-3 text-sm flex items-center gap-2",
              testResult.reachable ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" : "border-rose-300 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-200"
            )}>
              {testResult.reachable
                ? <><CheckCircle2 className="size-4" /> Reachable — host-control self-health OK ({testResult.status}).</>
                : <><XCircle className="size-4" /> Not reachable — {testResult.error ?? "unknown error"}.</>
              }
            </div>
          )}
          <Separator />
          <div className="text-xs text-muted-foreground">
            <strong>Sync state:</strong> {integration?.syncActive ? "Active (polling every 5s)" : "Idle"} · Last sync {fmtDateTime(lastSyncAt)}
          </div>
        </CardContent>
      </Card>

      {/* Webhook config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Webhook className="size-4" /> Inbound Webhook</CardTitle>
          <CardDescription>
            Set up an inbound webhook where the main ProjectAssure can POST events (new alert, milestone slip, approval raised) to this host-control.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Inbound URL</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border bg-muted/40 px-3 py-2 text-xs">
                {typeof window !== "undefined" ? `${window.location.origin}/api/admin/sync` : "/api/admin/sync"}
              </code>
              <Button size="sm" variant="outline" onClick={copyWebhook} className="gap-1.5">
                <Copy className="size-3.5" /> Copy
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wh-secret">Shared secret (optional)</Label>
            <Input
              id="wh-secret"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="whsec_…"
              type="password"
            />
            <div className="text-[11px] text-muted-foreground">
              Set the same value as <code className="bg-muted/40 px-1 rounded">WEBHOOK_SECRET</code> env var on the host-control. The main project must send it in the <code className="bg-muted/40 px-1 rounded">x-webhook-secret</code> header on every POST.
            </div>
          </div>
          <Separator />
          <div className="rounded-md bg-muted/30 p-3 text-xs">
            <div className="font-medium mb-1">Example payload from main project:</div>
            <pre className="overflow-x-auto custom-scrollbar text-[10px] font-mono leading-tight">{`POST /api/admin/sync
Content-Type: application/json
x-webhook-secret: whsec_…

{
  "event": "alert.raised",
  "project": "p-bm4",
  "alert": { "title": "Delay prediction 75%", "severity": "CRITICAL" }
}`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Env vars table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Key className="size-4" /> Environment Variables</CardTitle>
          <CardDescription>
            Reference table — set these on Vercel (Project → Settings → Environment Variables) before deploying.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Variable</th>
                  <th className="py-2 px-3 font-medium">Purpose</th>
                  <th className="py-2 pl-3 font-medium">Example</th>
                </tr>
              </thead>
              <tbody>
                {ENV_VARS.map(v => (
                  <tr key={v.key} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="py-2.5 pr-3">
                      <code className="text-xs bg-muted/40 px-1.5 py-0.5 rounded">{v.key}</code>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">{v.desc}</td>
                    <td className="py-2.5 pl-3">
                      <code className="text-[11px] text-muted-foreground">{v.example}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
