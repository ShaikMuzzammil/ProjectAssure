"use client";

// Integrations — MAIN_PROJECT_URL configuration (persisted override),
// live connection test (server-side fetch of main /api/health), sync mode
// explanation, env-var checklist and a short setup guide.

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, PlugZap, RefreshCw, Save, Wifi, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, CardHead, FieldLabel, Input, PageIntro } from "./ui";
import type { EnvCheckItem } from "@/lib/host/types";
import type { ViewProps } from "./view-props";

interface SettingsResponse {
  ok: boolean;
  settings: { mainUrlOverride: string | null; loginAlerts: boolean; budgetAlerts: boolean; budgetThresholdPct: number };
  mainUrl: string;
  env: EnvCheckItem[];
  providers: { email: string; ai: { gemini: boolean; groq: boolean; sandboxSdk: boolean; builtinFallback: boolean } };
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
      const res = await fetch("/api/host/admin/settings", { cache: "no-store" });
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
      const res = await fetch("/api/host/admin/settings", {
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
      const res = await fetch("/api/host/admin/settings", {
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
        description="The host talks to the main ProjectAssure app strictly server-to-server (CORS never applies). Configure the URL, verify reachability, and check which integrations have keys."
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
              In dev the main app runs on http://localhost:3000. In production set MAIN_PROJECT_URL to its Vercel URL. The last poll state:{" "}
              <span className="font-semibold">{state.sync.mainReachable ? "reachable" : "unreachable"}</span> · last sync {state.sync.lastSyncAt ?? "—"}.
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
  └  main-app browsers poll /api/sync/commands every 20s
     → broadcasts land as notifications + toasts`}</pre>
            <p className="text-[10px] leading-relaxed text-slate-400">
              Optional push mode: POST /api/admin/sync with header <code className="font-mono">x-sync-token</code> (SYNC_TOKEN) lets the main app push snapshots directly — polling stays the default.
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

      {/* env checklist */}
      <Card className="overflow-hidden">
        <CardHead title="Environment checklist" subtitle="read server-side right now — values are never shown" icon={<CheckCircle2 className="h-4 w-4" />} />
        <div className="host-scroll max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400 dark:border-slate-800">
                <th className="px-5 py-2.5">Variable</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
              {(data?.env ?? []).map((item) => (
                <tr key={item.key}>
                  <td className="px-5 py-2.5">
                    <span className="font-mono text-[11px] font-semibold text-[#072b49] dark:text-sky-300">{item.key}</span>
                    <p className="text-[10px] text-slate-400">{item.label}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    {item.set ? (
                      <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> set</Badge>
                    ) : (
                      <Badge tone="slate"><CircleDashed className="h-3 w-3" /> unset</Badge>
                    )}
                  </td>
                  <td className="max-w-md px-3 py-2.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{item.purpose}</td>
                </tr>
              ))}
              {data ? null : (
                <tr>
                  <td colSpan={3} className="px-5 py-6 text-center text-xs text-slate-400">loading checklist…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* setup guide */}
      <Card>
        <CardHead title="Setup guide" subtitle="two apps, one bridge — 6 steps" icon={<PlugZap className="h-4 w-4" />} />
        <ol className="host-scroll max-h-72 space-y-2.5 overflow-y-auto px-5 py-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          <li><strong>1.</strong> Run the main app → <code className="font-mono text-[10px]">cd prototype && bun install && bun run dev</code> (port 3000).</li>
          <li><strong>2.</strong> Run host-control → <code className="font-mono text-[10px]">cd host-control && bun install && bun run dev</code> (port 3001).</li>
          <li><strong>3.</strong> Open the main app in a browser and log in (any persona or a sign-up) — its client pushes the portfolio snapshot on login and every 45s.</li>
          <li><strong>4.</strong> Log into host-control (HOST_ADMIN_EMAIL / HOST_ADMIN_PASSWORD) — the mirror fills within seconds; users, projects and approvals are REAL.</li>
          <li><strong>5.</strong> Optional real email: set EMAIL_USER + EMAIL_PASS (Gmail App Password) or BREVO_API_KEY in host-control .env → login/budget/welcome emails go out for real, logged in the Outbox.</li>
          <li><strong>6.</strong> Optional AI: set GEMINI_API_KEY or GROQ_API_KEY for the Intelligence Console; without keys the built-in engine answers from the mirror, honestly labeled.</li>
        </ol>
      </Card>
    </div>
  );
}
