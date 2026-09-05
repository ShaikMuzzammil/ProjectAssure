"use client";

import dynamic from "next/dynamic";

const AppRoot = dynamic(() => import("@/components/projectassure/app-root"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-[#072b49]">
      <div className="relative">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#0c93e7] to-[#0b426e] flex items-center justify-center shadow-2xl shadow-[#0c93e7]/30">
          <svg viewBox="0 0 24 24" className="h-9 w-9 text-white" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path d="M12 2l8 3.5v5.5c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5.5L12 2z" strokeLinejoin="round" />
            <path d="M9 12l2 2 4-4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="absolute -inset-2 rounded-2xl border border-[#0c93e7]/40 animate-ping" />
      </div>
      <div className="text-center">
        <div className="text-lg font-semibold text-white tracking-tight">ProjectAssure</div>
        <div className="mt-1 text-xs text-[#7cc8fb]">Initialising the national portfolio engine…</div>
      </div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-[#064f85]">
        <div className="h-full w-1/2 rounded-full bg-[#0c93e7] pa-shimmer" />
      </div>
    </div>
  ),
});

export default function Home() {
  return <AppRoot />;
}
