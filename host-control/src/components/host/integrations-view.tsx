"use client";

// Integrations — MAIN_PROJECT_URL configuration (persisted override),
// live connection test (server-side fetch of main /api/health), sync mode
// explanation, env-var checklist and a short setup guide.

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, PlugZap, RefreshCw, Save, Wifi, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, CardHead, FieldLabel, Input, PageIntro } from "./ui";
import type { EnvCheckItem } from "@/lib/host/types";
import type { ViewProps } from "./view-props";

interface SettingsResponse {
  ok: boolean;
  settings: { mainUrlOverride: string | null; loginAlerts: boolean; budgetAlerts: boolean; budgetThresholdPct: number };
  mainUrl: string;
  env?: EnvCheckItem[];
  providers?: { email?: string; database?: boolean; ai?: { live?: boolean; gemini?: boolean; groq?: boolean; sandboxSdk?: boolean; builtinFallback?: boolean } };
}

export function IntegrationsView({ state, refresh }: ViewProps) {
  const [data, setData] = useState<SettingsResponse | null>(null);
  // local override pattern: mirror value wins until the admin starts editing
  const [urlEdit, setUrlEdit] = useState<string | null>(null);
  const urlDraft = urlEdit ?? data?.settings.mainUrlOverride ?? "";
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ reachable: boolean; status: number; error: string | null; at: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      if (res.ok) {
        const d = (await res.json()) as SettingsResponse;
        setData(d);
      }
    } catch {
      /* keep last */
    }
  }, []);

  useEffect(() => {
    // kick the first settings load off the synchronous effect path (0ms timer)
    const kickoff = setTimeout(() => void load(), 0);
    return () => clearTimeout(kickoff);
  }, [load]);

  async function saveUrl() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mainUrlOverride: urlDraft.trim() }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; hint?: string; mainUrl?: string };
      if (res.ok && d.ok) {
        toast.success("Main app URL saved", { description: `effective URL → ${d.mainUrl ?? urlDraft}` });
        setUrlEdit(null); // back to mirror-driven value
        await Promise.all([load(), refresh(true)]);
      } else {
        toast.error("Could not save URL", { description: d.hint ?? d.error ?? `HTTP ${res.status}` });
      }
    } catch (e) {
      toast.error("Could not save URL", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-connection" }),
      });
      const d = (await res.json().catch(() => ({}))) as { reachable?: boolean; status?: number; error?: string | null };
      setTestResult({ reachable: Boolean(d.reachable), status: d.status ?? 0, error: d.error ?? null, at: new Date().toISOString() });
      if (d.reachable) toast.success("Main app reachable", { description: `HTTP ${d.status} from ${data?.mainUrl ?? "main URL"}` });
      else toast.error("Main app unreachable", { description: d.error ?? `HTTP ${d.status}` });
    } catch (e) {
      toast.error("Test failed", { description: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageIntro
        title="Integrations & Setup"
        description="The host talks to the main ProjectAssure app strictly server-to-server. Configure the URL, verify reachability and see aggregate system status."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* main URL */}
        <Card>
          <CardHead title="Main app URL" subtitle="where the sync engine polls /api/sync/state and posts /api/sync/webhook" icon={<PlugZap className="h-4 w-4" />} />
          <div className="space-y-3 px-5 py-4">
            <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs dark:bg-slate-800/60">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Effective URL now</p>
              <p className="mt-0.5 font-mono text-[11px] font-semibold text-[#072b49] dark:text-sky-300">{data?.mainUrl ?? state.sync.mainUrl}</p>
              <p className="mt-1 text-[10px] text-slate-400">
                resolution order: override below → MAIN_PROJECT_URL env → http://localhost:3000
              </p>
            </div>
            <div>
              <FieldLabel htmlFor="url-override">Override (leave empty to use the env var / default)</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="url-override"
                  value={urlDraft}
                  onChange={(e) => setUrlEdit(e.target.value)}
                  placeholder="https://your-main-app.vercel.app"
                  className="font-mono text-xs"
                />
                <Button size="md" variant="navy" loading={saving} onClick={() => void saveUrl()}>
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" loading={testing} onClick={() => void testConnection()}>
                <Wifi className="h-3.5 w-3.5" /> Test connection
              </Button>
              {testResult ? (
                <span className="flex items-center gap-1.5 text-[11px]">
                  {testResult.reachable ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-rose-600" aria-hidden />
                  )}
                  <span className={testResult.reachable ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}>
                    {testResult.reachable ? `reachable (HTTP ${testResult.status})` : testResult.error ?? `HTTP ${testResult.status}`}
                  </span>
                </span>
              ) : null}
            </div>
            <p className="text-[10px] leading-relaxed text-slate-400">
              Paste your main app URL above (or set it in the deployment environment). Last poll state:{" "}
              <span className="font-semibold">{state.sync.mainReachable ? "reachable" : "unreachable"}</span> · last sync {state.sync.lastSyncAt ?? "—" }.
            </p>
          </div>
        </Card>

        {/* sync mode */}
        <Card>
          <CardHead title="Sync mode" subtitle="how data and commands flow (ASCII)" icon={<RefreshCw className="h-4 w-4" />} />
          <div className="space-y-3 px-5 py-4">
            <pre className="host-scroll overflow-x-auto rounded-xl bg-[#072b49] p-4 text-[10px] leading-relaxed text-sky-100">{`main app (browser, logged in)
  │  POST /api/sync/push      every 45s + on login/actions
  ▼
main app sync hub (server)
  │  GET  /api/sync/state     ← host polls every 5s (server-side)
  │  POST /api/sync/webhook   ← host broadcasts / user alerts
  ▼
host-control (this app)
  │  mirror → approvals → automated emails → UI (5s poll)
  └  main-app browsers poll /api/sync/commands every 8s
     → broadcasts land as notifications + toasts`}</pre>
            <p className="text-[10px] leading-relaxed text-slate-400">
              Approvals decided here flow back as live commands — the requesting user sees the outcome in their notifications within seconds.
            </p>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Badge tone="sky">mode: {state.sync.mode}</Badge>
              <Badge tone={state.sync.mainReachable ? "green" : "amber"}>{state.sync.mainReachable ? "main reachable" : "main unreachable"}</Badge>
              <Badge tone="slate">revision {state.sync.revision}</Badge>
              <Badge tone="slate">{state.sync.pollCount} polls</Badge>
              <Badge tone="slate">{state.sync.commandCount} commands on hub</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* v23: compact system status — aggregate readiness, no key names */}
      <Card>
        <CardHead title="System status" subtitle="aggregate readiness — configuration details stay server-side" icon={<CheckCircle2 className="h-4 w-4" />} />
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Database</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-700 dark:text-slate-200">{data?.providers?.database ? "Connected — approvals persist across restarts" : "Browser/memory mode"}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Intelligence</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-700 dark:text-slate-200">{data?.providers?.ai?.live ? "Live model connected" : "Built-in mirror engine"}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email delivery</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-700 dark:text-slate-200">{data?.providers?.email && data.providers.email !== "outbox" ? "Provider connected — real emails" : "Outbox simulation"}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sync bridge</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-700 dark:text-slate-200">{state.sync.mainReachable ? "Live — polling every 5s" : "Waiting for the main app"}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
