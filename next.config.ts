import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "@agentclientprotocol/sdk", "@electric-sql/pglite", "bcrypt"],
  // 注意: preloadEntriesOnStart 在 Next.js 16+ 中已不可用，
  // 该选项原用于禁用启动时预加载所有页面模块以节省内存（约 500MB-1GB）
};

export default withNextIntl(nextConfig);
