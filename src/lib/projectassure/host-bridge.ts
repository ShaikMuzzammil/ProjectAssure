// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure v21 — Host-Control webhook bridge
// Fire-and-forget POSTs of user events (registration, login) to the host-control
// app so the host sees live users, budgets, alerts and audit events.
// ═══════════════════════════════════════════════════════════════════════════

interface HostUserEvent {
  id: string;
  name: string;
  email: string;
  role: string;
  source: "demo" | "registered";
  designation: string;
  departmentId: string;
  phone?: string;
  createdAt: string;
}

interface HostLoginEvent {
  userId: string;
  email: string;
  at: string;
  role: string;
  name: string;
}

function getHostUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_HOST_CONTROL_URL;
  if (!url) return null;
  return url.replace(/\/+$/, "");
}

function getSecret(): string {
  return process.env.HOST_CONTROL_SECRET || "projectassure-host-dev";
}

/** Fire-and-forget — never throws, never blocks the caller. */
async function postWebhook(path: string, body: unknown): Promise<void> {
  const base = getHostUrl();
  if (!base) return; // host-control not configured — silent skip
  try {
    await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-host-secret": getSecret(),
      },
      body: JSON.stringify(body),
      // 10-second cap — never let host-control slowness block the main app
      signal: AbortSignal.timeout?.(10_000),
    });
  } catch {
    // host-control offline / wrong URL — silent skip (fire-and-forget)
  }
}

export function notifyUserRegistered(u: HostUserEvent): void {
  void postWebhook("/api/webhook/user-registered", u);
}

export function notifyUserLogin(evt: HostLoginEvent): void {
  void postWebhook("/api/webhook/user-login", evt);
}

export function isHostControlConfigured(): boolean {
  return getHostUrl() !== null;
}
