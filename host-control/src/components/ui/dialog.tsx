"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
export function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => onOpenChange(false)}><div className="absolute inset-0 bg-black/40" /><div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>{children}</div></div>;
}
export function DialogHeader({ children }: { children: React.ReactNode }) { return <div className="mb-3">{children}</div>; }
export function DialogTitle({ children, className }: { children: React.ReactNode; className?: string }) { return <h2 className={cn("text-base font-bold", className)}>{children}</h2>; }
export function DialogFooter({ children }: { children: React.ReactNode }) { return <div className="mt-4 flex justify-end gap-2">{children}</div>; }
