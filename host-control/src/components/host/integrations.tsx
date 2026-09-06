"use client";
import React, { useState } from "react";
import { useAdminStore } from "@/store/admin-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plug,
  Link as LinkIcon,
  Check,
  X,
  RefreshCw,
  Mail,
  BrainCircuit,
  Webhook,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { relTime } from "@/lib/host/format";

// v21: Integrations — main project URL + webhook secret config + AI / email
// provider status + force sync + sync history (last 10).

export function Integrations() {
  const { aiStatus, integration, forceSync } = useAdminStore();
  const [mainUrl, setMainUrl] = useState(integration?.mainProjectUrl || "https://project-assure.vercel.app");
  const [webhookSecret, setWebhookSecret] = useState(integration?.webhookSecret || "");
  const [reachable, setReachable] = useState<boolean | null>(integration?.mainProjectReachable ?? null);
  const [checking, setChecking] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const testConnection = async () => {
    setChecking(true);
    setReachable(null);
    try {
      const res = await fetch(`${mainUrl.replace(/\/$/, "")}/api/health`, { cache: "no-store" });
      setReachable(res.ok);
      toast.success(res.ok ? "Main project reachable" : "Health check failed", {
        description: res.ok ? `${mainUrl} responded OK` : `Status ${res.status}`,
      });
    } catch {
      setReachable(false);
      toast.error("Could not reach main project", { description: "Check the URL or CORS settings" });
    } finally {
      setChecking(false);
    }
  };

  const doForceSync = async () => {
    setSyncing(true);
    try {
      await forceSync();
      toast.success("Force sync complete");
    } finally {
      setSyncing(false);
    }
  };

  const emailConfigured = !!(process.env.NEXT_PUBLIC_EMAIL_CONFIGURED) || !!(typeof window !== "undefined" && (window as any).__EMAIL_CONFIGURED__);
  const syncHistory = integration?.syncHistory ?? [];

  return (
    <div className="mx-auto max-w-[900px] space-y-4">
      <div>
        <h2 className="text-lg font-bold">Integrations</h2>
        <p className="text-xs text-slate-500">
          Connect the host-control to the main ProjectAssure prototype + configure intelligence providers + email outbox.
        </p>
      </div>

      {/* Main project URL */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <LinkIcon className="h-4 w-4 text-[#0c93e7]" /> Main Project URL
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          The host-control polls this URL&apos;s <code className="rounded bg-slate-100 px-1">/api/health</code> for liveness. Main app
          pushes user events to this host-control&apos;s webhook on registration + login.
        </p>
        <div className="mt-3 flex gap-2">
          <Input value={mainUrl} onChange={(e) => setMainUrl(e.target.value)} placeholder="https://project-assure.vercel.app" />
          <Button onClick={testConnection} disabled={checking}>
            <RefreshCw className={cn("h-4 w-4", checking && "animate-spin")} /> Test
          </Button>
        </div>
        {reachable !== null && (
          <div
            className={cn(
              "mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold",
              reachable ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
            )}
          >
            {reachable ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            {reachable ? "Main project is reachable" : "Cannot reach the main project"}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open(mainUrl, "_blank")}>
            Open main project ↗
          </Button>
          <Button variant="outline" size="sm" onClick={doForceSync} disabled={syncing}>
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} /> Force sync now
          </Button>
        </div>
      </div>

      {/* Webhook config */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Webhook className="h-4 w-4 text-[#0c93e7]" /> Webhook ingestion
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          These are the endpoints the main app should POST to. The <code className="rounded bg-slate-100 px-1">x-host-secret</code> header
          must match <code className="rounded bg-slate-100 px-1">HOST_CONTROL_SECRET</code>.
        </p>
        <div className="mt-3 space-y-2 text-xs">
          <EndpointRow method="POST" path="/api/webhook/user-registered" desc="Triggered on main-app signUp()" />
          <EndpointRow method="POST" path="/api/webhook/user-login" desc="Triggered on main-app login()" />
        </div>
        <div className="mt-3">
          <label className="text-[11px] font-semibold">Webhook secret (display only — set via env var)</label>
          <Input
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="Set HOST_CONTROL_SECRET in .env.local"
            className="mt-1 font-mono"
          />
        </div>
      </div>

      {/* Service status */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Plug className="h-4 w-4 text-[#0c93e7]" /> Service status
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          <StatusRow
            label="Main project"
            value={mainUrl}
            ok={reachable === true}
            unknown={reachable === null}
          />
          <StatusRow
            label="Intelligence provider"
            value={aiStatus?.label ?? "probing…"}
            ok={!!aiStatus?.connected}
          />
          <StatusRow
            label="Email outbox"
            value={emailConfigured ? "SMTP configured" : "Simulated (set EMAIL_USER/EMAIL_PASS/SMTP_HOST)"}
            ok={emailConfigured}
          />
          <StatusRow
            label="Webhook ingestion"
            value="Listening on /api/webhook/*"
            ok
          />
        </div>
      </div>

      {/* Sync history */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <History className="h-4 w-4 text-[#0c93e7]" /> Sync history (last {syncHistory.length})
        </h3>
        <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
          {syncHistory.length === 0 && (
            <div className="py-8 text-center text-[11px] text-slate-400">No syncs recorded yet</div>
          )}
          {syncHistory.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                  s.ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
                )}
              >
                {s.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold">
                  {s.recordCount} records · {s.note || "synced"}
                </div>
                <div className="text-[9px] text-slate-500">{relTime(s.at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Environment variables */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold">Environment variables</h3>
        <p className="mt-1 text-xs text-slate-500">Set these in your Vercel project settings (host-control) to enable each integration.</p>
        <div className="mt-3 grid gap-1.5 md:grid-cols-2">
          {[
            { k: "MAIN_PROJECT_URL", desc: "Main prototype URL", icon: LinkIcon },
            { k: "HOST_CONTROL_SECRET", desc: "Webhook auth secret", icon: Webhook },
            { k: "GEMINI_API_KEY", desc: "Primary AI provider", icon: BrainCircuit },
            { k: "GROQ_API_KEY", desc: "Fast fallback", icon: BrainCircuit },
            { k: "OPENROUTER_API_KEY", desc: "Community models", icon: BrainCircuit },
            { k: "OPENAI_API_KEY", desc: "OpenAI provider", icon: BrainCircuit },
            { k: "SMTP_HOST", desc: "SMTP relay host", icon: Mail },
            { k: "SMTP_PORT", desc: "SMTP port (587 / 465)", icon: Mail },
            { k: "EMAIL_USER", desc: "SMTP auth user", icon: Mail },
            { k: "EMAIL_PASS", desc: "SMTP auth password", icon: Mail },
          ].map((e) => (
            <div key={e.k} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <e.icon className="h-3.5 w-3.5 text-[#0c93e7]" />
              <code className="font-mono text-[11px] font-bold text-[#015ca0]">{e.k}</code>
              <span className="ml-auto text-[10px] text-slate-600">{e.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, value, ok, unknown }: { label: string; value: string; ok: boolean; unknown?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-xs font-bold">{label}</div>
        <div className="truncate text-[10px] text-slate-500">{value}</div>
      </div>
      <Badge tone={unknown ? "amber" : ok ? "green" : "rose"}>
        {unknown ? "UNTESTED" : ok ? "OK" : "OFFLINE"}
      </Badge>
    </div>
  );
}

function EndpointRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-700">{method}</span>
      <code className="font-mono text-[11px] text-slate-700">{path}</code>
      <span className="ml-auto text-[10px] text-slate-500">{desc}</span>
    </div>
  );
}
