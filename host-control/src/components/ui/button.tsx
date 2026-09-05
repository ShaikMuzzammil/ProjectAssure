"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
const variants: Record<string, string> = { default: "bg-[#0b426e] text-white hover:bg-[#0c93e7]", outline: "border border-border bg-background hover:bg-muted", ghost: "hover:bg-muted", destructive: "bg-rose-600 text-white hover:bg-rose-700" };
const sizes: Record<string, string> = { sm: "h-8 px-3 text-xs rounded-md", md: "h-9 px-4 text-sm rounded-md", lg: "h-10 px-6 text-sm rounded-lg", icon: "h-9 w-9 rounded-md" };
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: keyof typeof variants; size?: keyof typeof sizes; }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = "default", size = "md", ...props }, ref) => (
  <button ref={ref} className={cn("inline-flex items-center justify-center gap-1.5 font-semibold transition disabled:opacity-50", variants[variant], sizes[size], className)} {...props} />
));
Button.displayName = "Button";
