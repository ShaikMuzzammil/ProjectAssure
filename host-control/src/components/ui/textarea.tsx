import * as React from "react";
import { cn } from "@/lib/utils";
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn("w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0c93e7] focus:ring-2 focus:ring-[#0c93e7]/20", className)} {...props} />
));
Textarea.displayName = "Textarea";
