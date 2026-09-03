import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ProjectAssure — AI-Powered Predictive Project Monitoring | SIH 2026",
  description:
    "One dashboard for India's projects. Predicts delays 30-60 days early, reads reports itself, and recommends actions. SIH 2026 submission — Problem SIH26103, MoSPI.",
  keywords: [
    "ProjectAssure",
    "SIH 2026",
    "SIH26103",
    "MoSPI",
    "project monitoring",
    "predictive analytics",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
