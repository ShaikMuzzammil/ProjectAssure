import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono-jb", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ProjectAssure Host Control — Master Control Plane | SIH 2026",
  description: "The host domain for ProjectAssure — one pane of glass for India's central-sector infrastructure portfolio. Mission control, approvals, budget risk, alerts aggregation, intelligence console. SIH 2026 · SIH26103 · Team NEXGEN.",
  keywords: ["ProjectAssure", "Host Control", "SIH 2026", "SIH26103", "project monitoring", "portfolio", "approvals", "audit"],
  applicationName: "ProjectAssure Host Control",
};

export const viewport: Viewport = { themeColor: "#072b49", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${mono.variable} antialiased bg-background text-foreground`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
