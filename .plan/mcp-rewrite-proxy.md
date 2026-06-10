# MCP 反向代理：localhost:3000/mcp → localhost:4001/mcp

## Context

MCP 服务作为独立 Express 服务器运行在 4001 端口（由 `instrumentation.ts` 启动）。用户希望在 apipost 中通过 `localhost:3000/mcp` 调试，而不用记另一个端口。通过 Next.js 内置的 `rewrites` 功能，将 `/mcp` 路径的请求透明代理到 MCP Express 服务。

## 修改文件

### `next.config.ts`

添加 `rewrites` 配置，将 `/mcp` 代理到 `http://127.0.0.1:4001/mcp`：

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "@agentclientprotocol/sdk", "@electric-sql/pglite", "bcrypt"],
  async rewrites() {
    return [
      {
        source: "/mcp",
        destination: "http://127.0.0.1:4001/mcp",
      },
    ];
  },
};

export default withNextIntl(nextConfig);
```

只改一个文件，加一个 `rewrites` 方法。

## 注意事项

- `rewrites` 是 Next.js 内置的反向代理，支持 SSE 长连接和流式响应，能正确代理 MCP 的 `POST`/`GET`/`DELETE` 三种请求
- Docker 环境中 MCP_HOST 设为 `0.0.0.0`，但 Next.js rewrite 目标是 `127.0.0.1`（同一容器内通信），不受影响
- 原有的 `localhost:4001/mcp` 直连方式继续可用，rewrite 是额外入口

## 验证

1. 重启 dev server（`pnpm dev`）
2. 在 apipost 中 `POST http://localhost:3000/mcp`，带 `Authorization: Bearer atm_xxx` header，发送 MCP `initialize` JSON-RPC 请求，确认返回正常
3. 确认 `GET http://localhost:3000/mcp`（SSE）也能正常建立连接
