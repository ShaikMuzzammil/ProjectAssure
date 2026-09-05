import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
export const metadata: Metadata = { title: "ProjectAssure Host Control", description: "Master control plane for ProjectAssure — SIH 2026 · SIH26103 · Team NEXGEN" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}<Toaster position="bottom-right" richColors /></body></html>);
}
