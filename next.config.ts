import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // v22: removed `output: "standalone"` — it caused the
  // "ENOENT: .next/next-server.js.nft.json" Vercel build error.
  // Vercel handles the build output natively; standalone mode is only
  // needed for self-hosted Docker and we don't use it here.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
