import type { NextConfig } from "next";

/**
 * FIX for Vercel deploy failure (vercel/next.js#96646):
 *   Error: ENOENT: no such file or directory, open '/vercel/path0/.next/next-server.js.nft.json'
 *
 * Root cause: Next.js 16.3.x + `output: "standalone"` no longer emits
 * `.next/next-server.js.nft.json`, but Vercel's onBuildComplete hook still
 * expects it -> deterministic build failure on Vercel (local builds pass).
 *
 * Fix: only enable standalone output when NOT building on Vercel.
 * Vercel always sets the VERCEL env var; standalone stays available for
 * Docker / self-hosted `next start` deployments.
 */
const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  reactStrictMode: false,
};

export default nextConfig;
