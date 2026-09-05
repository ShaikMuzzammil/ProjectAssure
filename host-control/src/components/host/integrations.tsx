"use client";
import React, { useState } from "react";
import { useAdminStore } from "@/store/admin-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plug, Link, Check, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function Integrations() {
  const { aiStatus } = useAdminStore();
  const [mainUrl, setMainUrl] = useState("https://project-assure.vercel.app");
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const testConnection = async () => {
    setChecking(true); setReachable(null);
    try { const res = await fetch(`${mainUrl}/api/health`, { cache: "no-store" }); setReachable(res.ok); toast.success(res.ok ? "Main project reachable" : "Health check failed", { description: res.ok ? `${mainUrl} responded OK` : `Status ${res.status}` }); }
    catch { setReachable(false); toast.error("Could not reach main project", { description: "Check the URL or CORS settings" }); }
    finally { setChecking(false); }
  };

  return (
    <div className="mx-auto max-w-[800px] space-y-4">
      <div><h2 className="text-lg font-bold">Integrations</h2><p className="text-xs text-slate-500">Connect the host-control to the main ProjectAssure prototype + configure intelligence providers.</p></div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Link className="h-4 w-4 text-[#0c93e7]" />Main Project URL</h3>
        <p className="mt-1 text-xs text-slate-500">The host-control polls this URL&apos;s <code className="rounded bg-slate-100 px-1">/api/health</code> every 5 seconds to keep the portfolio snapshot fresh.</p>
        <div className="mt-3 flex gap-2">
          <Input value={mainUrl} onChange={e => setMainUrl(e.target.value)} placeholder="https://project-assure.vercel.app" />
          <Button onClick={testConnection} disabled={checking}><RefreshCw className={cn("h-4 w-4", checking && "animate-spin")} />Test connection</Button>
        </div>
        {reachable !== null && <div className={cn("mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold", reachable ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>{reachable ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}{reachable ? "Main project is reachable" : "Cannot reach the main project"}</div>}
        <Button variant="outline" size="sm" className="mt-3" onClick={() => window.open(mainUrl, "_blank")}>Open main project ↗</Button>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Plug className="h-4 w-4 text-[#0c93e7]" />Service Status</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"><div><div className="text-xs font-bold">Main project</div><div className="text-[10px] text-slate-500">{mainUrl}</div></div><span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", reachable ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600")}>{reachable === true ? "REACHABLE" : reachable === false ? "UNREACHABLE" : "NOT TESTED"}</span></div>
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"><div><div className="text-xs font-bold">Intelligence provider</div><div className="text-[10px] text-slate-500">{aiStatus?.label ?? "probing…"}</div></div><span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", aiStatus?.connected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{aiStatus?.connected ? "CONNECTED" : "OFFLINE"}</span></div>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold">Environment Variables</h3>
        <p className="mt-1 text-xs text-slate-500">Set these in your Vercel project settings (host-control) to enable each integration.</p>
        <div className="mt-3 space-y-1.5">
          {[["GEMINI_API_KEY", "Free — default intelligence provider", "aistudio.google.com/apikey"], ["GROQ_API_KEY", "Free — fast fallback", "console.groq.com/keys"], ["OPENROUTER_API_KEY", "Free — community models", "openrouter.ai/settings/keys"], ["MAIN_PROJECT_URL", "The main prototype's URL", "project-assure.vercel.app"]].map(([k, desc, link]) => (
            <div key={k} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"><code className="font-mono text-xs font-bold text-[#015ca0]">{k}</code><span className="text-[11px] text-slate-600">{desc}</span><a href={`https://${link}`} target="_blank" rel="noreferrer" className="ml-auto text-[10px] text-[#0c93e7] hover:underline">{link} ↗</a></div>
          ))}
        </div>
      </div>
    </div>
  );
}
