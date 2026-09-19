import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Profile photos are uploaded through a server action. They are shrunk in the
    // browser first (~200 KB), but allow up to the 2 MB bucket limit plus form overhead.
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
