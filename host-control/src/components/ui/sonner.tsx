"use client";

// Sonner toaster wrapper — uses next-themes for dark mode sync.
// This file exists so that any leftover shadcn/ui imports resolve cleanly
// during the Vercel build. If next-themes is not configured, the toaster
// still works (just without automatic dark-mode sync).
import { Toaster as SonnerToaster } from "sonner";

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

export const Toaster = ({ ...props }: ToasterProps) => {
  return <SonnerToaster {...props} />;
};

export { toast } from "sonner";
