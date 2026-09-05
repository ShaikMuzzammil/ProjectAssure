import * as React from "react";
import { cn } from "@/lib/utils";
const tones: Record<string, string> = { default: "bg-[#e0effe] text-[#015ca0]", green: "bg-emerald-100 text-emerald-700", amber: "bg-amber-100 text-amber-700", rose: "bg-rose-100 text-rose-700", teal: "bg-cyan-100 text-cyan-700", violet: "bg-violet-100 text-violet-700" };
export function Badge({ tone = "default", className, ...props }: { tone?: keyof typeof tones } & React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold", tones[tone], className)} {...props} />;
}
