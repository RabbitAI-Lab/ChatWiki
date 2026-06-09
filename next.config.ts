import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "@agentclientprotocol/sdk", "@electric-sql/pglite", "bcrypt"],
};

export default withNextIntl(nextConfig);
