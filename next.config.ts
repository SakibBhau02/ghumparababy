import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is for self-hosted/Docker only. On Vercel it breaks
  // the build (Next 16.3 nft.json regression in onBuildComplete) — Vercel
  // packages the output itself, so leave the default there.
  // Vercel always sets VERCEL=1 during builds.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    // R2 bucket (public) — used when R2_IMAGES_LIVE flips on in site-images.ts
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-9f2bc7ee02c44d26bb204d4ceb965ccf.r2.dev",
      },
    ],
  },
};

export default nextConfig;
