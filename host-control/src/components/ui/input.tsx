import * as React from "react";
import { cn } from "@/lib/utils";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn("h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0c93e7] focus:ring-2 focus:ring-[#0c93e7]/20", className)} {...props} />
));
Input.displayName = "Input";
