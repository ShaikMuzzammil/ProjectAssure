"use client";

// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure — Universal portal header (v8).
// The same official-looking band on every surface (landing, login, about, app):
// tricolour strip · state emblem mark · Government-of-India style titling ·
// secure-portal badge · live IST clock · live-monitoring pulse. Universal,
// understandable, and honest — no internal technology is named here.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from "react";
import { Lock, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

/** Stylised state-emblem mark: 24-spoke chakra inside a navy roundel. */
function EmblemMark({ size = 34 }: { size?: number }) {
  const spokes = Array.from({ length: 24 }, (_, i) => (i * 360) / 24);
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden className="shrink-0">
      <circle cx="22" cy="22" r="21" fill="#0b426e" stroke="#0c93e7" strokeWidth="1" />
      <circle cx="22" cy="22" r="14.5" fill="none" stroke="#ffffff" strokeWidth="1.4" />
      <circle cx="22" cy="22" r="2.4" fill="#ffffff" />
      {spokes.map(a => (
        <line key={a} x1="22" y1="22" x2={22 + 14 * Math.cos((a * Math.PI) / 180)} y2={22 + 14 * Math.sin((a * Math.PI) / 180)}
          stroke="#ffffff" strokeWidth="0.9" strokeOpacity="0.92" />
      ))}
      <circle cx="22" cy="22" r="17.5" fill="none" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.5" />
    </svg>
  );
}

function useIstClock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const raf = requestAnimationFrame(() => setNow(fmt()));
    const t = setInterval(() => setNow(fmt()), 1000);
    return () => { cancelAnimationFrame(raf); clearInterval(t); };
  }, []);
  return now;
}

export default function GovHeader({ surface = "app", className }: { surface?: "app" | "public"; className?: string }) {
  const clock = useIstClock();
  return (
    <div className={cn("w-full select-none border-b bg-card", className)}>
      {/* tricolour identity strip */}
      <div className="h-[3px] w-full" style={{ background: "linear-gradient(90deg, #FF9933 0%, #FF9933 33.33%, #f8fafc 33.33%, #f8fafc 66.66%, #138808 66.66%, #138808 100%)" }} aria-hidden />
      <div className={cn("mx-auto flex max-w-[1400px] items-center gap-3 px-4", surface === "app" ? "h-12" : "h-14 py-2")}>
        <EmblemMark size={surface === "app" ? 30 : 34} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Smart India Hackathon 2026 · SIH26103</span>
            <span className={cn("font-bold tracking-tight text-[#015ca0] dark:text-[#7cc8fb]", surface === "app" ? "text-[14.5px]" : "text-[16px]")}>ProjectAssure</span>
          </div>
          <div className="truncate text-[10.5px] font-medium text-muted-foreground">
            Team NEXGEN · Amrita Vishwa Vidyapeetham, Chennai · Integrated Project Monitoring Platform
          </div>
        </div>
        <div className="hidden items-center gap-2.5 sm:flex">
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300" title="This portal is served over a secure connection and every action is audit-logged">
            <Lock className="h-3 w-3" /> Secure portal
          </span>
          <span className="rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-semibold tabular text-muted-foreground" title="Indian Standard Time">
            IST {clock || "—"}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold text-muted-foreground" title="Live monitoring heartbeat — the portfolio is re-checked every 15 seconds">
            <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>
            <Activity className="h-3 w-3" /> Live
          </span>
        </div>
      </div>
    </div>
  );
}
