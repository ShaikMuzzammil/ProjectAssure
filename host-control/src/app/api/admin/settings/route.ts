import { NextResponse } from "next/server";
import { requireHost } from "@/lib/host/auth";
import { audit, getStore, saveNow } from "@/lib/host/store";
import { effectiveMainUrl, envChecklist, testMainConnection } from "@/lib/host/sync";
import { emailProviderLabel } from "@/lib/host/mailer";

export const dynamic = "force-dynamic";

// GET /api/admin/settings — current settings + effective main URL + env checklist.
export async function GET(req: Request) {
  const gate = requireHost(req);
  if (!gate.ok) return gate.res;

  return NextResponse.json({
    ok: true,
    settings: getStore().data.settings,
    mainUrl: effectiveMainUrl(),
    env: envChecklist(),
    providers: {
      email: emailProviderLabel(),
      database: Boolean(process.env.DATABASE_URL),
      ai: {
        live: Boolean(
          process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GROQ_API_KEY ||
          process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
        ),
        gemini: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
        groq: Boolean(process.env.GROQ_API_KEY),
        sandboxSdk: true, // z-ai-web-dev-sdk ships with the app; works in this sandbox
        builtinFallback: true,
      },
    },
  });
}

// POST /api/admin/settings — update toggles / threshold / MAIN_PROJECT_URL
// override (persisted in the host store), or action:"test-connection".
export async function POST(req: Request) {
  const gate = requireHost(req);
  if (!gate.ok) return gate.res;
  const actor = gate.email;

  let payload: {
    action?: string;
    loginAlerts?: boolean;
    budgetAlerts?: boolean;
    budgetThresholdPct?: number;
    mainUrlOverride?: string | null;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const store = getStore();

  if (payload.action === "test-connection") {
    const result = await testMainConnection();
    audit(
      result.reachable ? "integration.test-ok" : "integration.test-failed",
      actor,
      `connection test → ${effectiveMainUrl()} ${result.reachable ? "reachable" : `unreachable (${result.error ?? `HTTP ${result.status}`})`}`,
      result.reachable ? "success" : "warning",
    );
    saveNow();
    return NextResponse.json({ ok: true, reachable: result.reachable, status: result.status, body: result.body ?? null, error: result.error ?? null });
  }

  const d = store.data;
  const changes: string[] = [];

  if (typeof payload.loginAlerts === "boolean" && payload.loginAlerts !== d.settings.loginAlerts) {
    d.settings.loginAlerts = payload.loginAlerts;
    changes.push(`login emails ${payload.loginAlerts ? "ON" : "OFF"}`);
  }
  if (typeof payload.budgetAlerts === "boolean" && payload.budgetAlerts !== d.settings.budgetAlerts) {
    d.settings.budgetAlerts = payload.budgetAlerts;
    changes.push(`budget emails ${payload.budgetAlerts ? "ON" : "OFF"}`);
  }
  if (typeof payload.budgetThresholdPct === "number" && Number.isFinite(payload.budgetThresholdPct)) {
    const clamped = Math.min(200, Math.max(0, Math.round(payload.budgetThresholdPct)));
    if (clamped !== d.settings.budgetThresholdPct) {
      d.settings.budgetThresholdPct = clamped;
      changes.push(`budget threshold ${clamped}%`);
    }
  }
  if (payload.mainUrlOverride !== undefined) {
    const raw = String(payload.mainUrlOverride ?? "").trim();
    if (raw === "") {
      if (d.settings.mainUrlOverride !== null) {
        d.settings.mainUrlOverride = null;
        changes.push("MAIN URL override cleared → env/default");
      }
    } else if (/^https?:\/\//i.test(raw)) {
      const cleaned = raw.replace(/\/+$/, "");
      if (cleaned !== d.settings.mainUrlOverride) {
        d.settings.mainUrlOverride = cleaned;
        changes.push(`MAIN URL override → ${cleaned}`);
      }
    } else {
      return NextResponse.json({ ok: false, error: "invalid_url", hint: "must start with http:// or https://" }, { status: 422 });
    }
  }

  if (changes.length === 0) {
    return NextResponse.json({ ok: true, changed: false, settings: d.settings });
  }

  audit("settings.updated", actor, changes.join(" · "), "info");
  saveNow();
  return NextResponse.json({ ok: true, changed: true, settings: d.settings, mainUrl: effectiveMainUrl() });
}
