"use client";

// The 5-second poll loop that keeps the control tower live.
// GET /api/admin/sync (server-side fetch of the main app → merge → state).

import { useCallback, useEffect, useRef, useState } from "react";
import type { HostStateResponse } from "@/lib/host/types";

export interface HostData {
  state: HostStateResponse | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  refresh: (force?: boolean) => Promise<void>;
}

export function useHostData(onAuthLost: () => void): HostData {
  const [state, setState] = useState<HostStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(
    async (force = false) => {
      if (inFlight.current) return;
      inFlight.current = true;
      if (force) setRefreshing(true);
      try {
        const res = await fetch(`/api/host/admin/sync${force ? "?force=1" : ""}`, { cache: "no-store" });
        if (res.status === 401) {
          onAuthLost();
          return;
        }
        if (!res.ok) throw new Error(`host API returned HTTP ${res.status}`);
        const data = (await res.json()) as HostStateResponse;
        setState(data);
        setError(null);
      } catch (e) {
        setError((e as Error).message || "sync request failed");
      } finally {
        inFlight.current = false;
        setRefreshing(false);
        setLoading(false);
      }
    },
    [onAuthLost],
  );

  useEffect(() => {
    // kick the first poll off the synchronous effect path (0ms timer)
    const kickoff = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return; // don't poll hidden tabs
      void refresh();
    }, 5000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(timer);
    };
  }, [refresh]);

  return { state, loading, error, refreshing, refresh };
}
