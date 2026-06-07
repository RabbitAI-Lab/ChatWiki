import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig & { preloadEntriesOnStart?: boolean } = {
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "@agentclientprotocol/sdk", "better-sqlite3", "bcrypt"],
  // 禁用启动时预加载所有页面模块到内存，改为按需加载
  // 默认 true 会将全部页面的 JS 模块在启动时加载，对于依赖多的项目会多占用 500MB-1GB
  preloadEntriesOnStart: false,
};

export default withNextIntl(nextConfig);
