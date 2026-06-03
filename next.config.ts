import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "better-sqlite3", "bcrypt"],
};

export default nextConfig;
