"use client";

// Host Control entry — session gate → login screen → control tower shell.

import { useCallback, useEffect, useState } from "react";
import { LoginView } from "@/components/host/login-view";
import { Shell } from "@/components/host/shell";
import { useHostData } from "@/components/host/use-host-data";
import { ShieldCheck } from "lucide-react";

type Phase = "checking" | "login" | "ready";

export default function Page() {
  const [phase, setPhase] = useState<Phase>("checking");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/host/auth/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("401"))))
      .then(() => {
        if (!cancelled) setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) setPhase("login");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onAuthLost = useCallback(() => setPhase("login"), []);
  const { state, loading, error, refreshing, refresh } = useHostData(onAuthLost);

  if (phase === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#04192c]">
        <div className="flex flex-col items-center gap-3 text-sky-200">
          <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-[#0c93e7]">
            <ShieldCheck className="h-7 w-7 text-white" aria-hidden />
          </div>
          <p className="text-xs tracking-wide">Establishing secure host session…</p>
        </div>
      </main>
    );
  }

  if (phase === "login") {
    return <LoginView onSuccess={() => setPhase("ready")} />;
  }

  return <Shell state={state} loading={loading} error={error} refreshing={refreshing} refresh={refresh} onLogout={() => setPhase("login")} />;
}
