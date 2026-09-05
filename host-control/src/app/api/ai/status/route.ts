import { NextResponse } from "next/server";
import { probeProviderStatus } from "@/lib/host/ai";

let cache: { at: number; json: Record<string, unknown> } | null = null;
const TTL_MS = 90_000;

// GET /api/ai/status — probe whether ANY intelligence provider key is live.
// Mirrors the prototype's status route: free metadata requests (models list),
// never a completion, so it costs nothing against daily quotas.
// Result is cached for 90s so opening the panel N times does not spam providers.
// The UI shows only the masked `label` — provider/model names stay server-side.
export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.json);
  }
  const probe = await probeProviderStatus();
  const json = {
    connected: probe.connected,
    tier: probe.tier,
    label: probe.label,
    model: probe.model,
    checkedAt: new Date().toISOString(),
  };
  cache = { at: Date.now(), json };
  return NextResponse.json(json);
}
