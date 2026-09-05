import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono-jb", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ProjectAssure — Intelligence-Powered Predictive Project Monitoring | SIH 2026",
  description: "Central-sector portfolio monitoring with 30–60 day delay prediction, smart document reading, risk-ranked alerts, audit-grade governance and ₹0 infrastructure. SIH 2026 · SIH26103 · Team NEXGEN.",
  keywords: ["ProjectAssure", "SIH 2026", "SIH26103", "project monitoring", "delay prediction", "risk intelligence", "Smart India Hackathon"],
  applicationName: "ProjectAssure",
};

export const viewport: Viewport = { themeColor: "#0b426e", width: "device-width", initialScale: 1 };

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
