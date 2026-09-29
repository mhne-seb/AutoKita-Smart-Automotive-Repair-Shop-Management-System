import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next.js only bakes in NEXT_PUBLIC_ values that exist. Defaulting this one
  // to 'false' makes the login page's demo check fixed at build time, so the
  // demo passwords are left out of the live site's JavaScript entirely.
  env: {
    NEXT_PUBLIC_SHOW_DEMO_LOGIN: process.env.NEXT_PUBLIC_SHOW_DEMO_LOGIN ?? 'false',
  },
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;