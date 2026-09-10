import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
