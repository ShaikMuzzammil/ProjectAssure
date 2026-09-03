"use client";

import dynamic from "next/dynamic";

/* client-only: the app is a deterministic client-side simulation */
const AppShell = dynamic(() => import("@/components/projectassure/app-shell").then((m) => m.AppShell), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-[#072b49]">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
          <svg className="h-8 w-8 animate-spin text-[#7cc8fb]" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
            <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-white">ProjectAssure</p>
          <p className="text-xs text-white/60">Loading the command centre…</p>
        </div>
      </div>
    </div>
  ),
});

export default function Home() {
  return <AppShell />;
}
