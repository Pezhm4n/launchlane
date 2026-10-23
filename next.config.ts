import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  ...(process.env.LAUNCHLANE_STANDALONE === "true" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
