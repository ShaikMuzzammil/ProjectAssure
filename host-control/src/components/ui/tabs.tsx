"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
const Ctx = React.createContext<string>("");
export function Tabs({ value, onValueChange, children, className }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode; className?: string }) {
  return <Ctx.Provider value={value}><div className={className} data-value={value} onClick={(e) => { const t = (e.target as HTMLElement).closest("[data-tab]"); if (t) onValueChange((t as HTMLElement).dataset.tab!); }}>{children}</div></Ctx.Provider>;
}
export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) { return <div className={cn("flex gap-1 rounded-lg border bg-card p-1.5", className)}>{children}</div>; }
export function TabsTrigger({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  return <button data-tab={value} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition", className)}>{children}</button>;
}
