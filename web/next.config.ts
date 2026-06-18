import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a minimal standalone server bundle for self-hosted Docker images.
  // No-op on Vercel. See web/Dockerfile and SELF_HOSTING.md.
  output: "standalone",
};

export default nextConfig;
