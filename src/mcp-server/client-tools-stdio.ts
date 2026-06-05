/**
 * Client Tools 独立 stdio MCP Server 入口
 *
 * 供 ACP Agent 通过 session/new.mcpServers spawn。
 * 注册 refresh_file_tree 和 preview_html 两个工具，
 * 返回固定文本（实际动作由前端通过 SSE tool_call 事件执行）。
 *
 * 运行方式：node dist/client-tools-mcp.js
 * ACP Agent 会自动 spawn 并通过 stdio JSON-RPC 连接。
 */

import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import { z } from "zod/v4";

async function main() {
  const server = new McpServer({
    name: "rabbitdocs_client",
    version: "1.0.0",
  });

  server.registerTool(
    "refresh_file_tree",
    {
      description:
        "Refresh the file tree in the user's UI. Call this tool after you create, delete, or rename files or directories so the user immediately sees the updated file tree.",
    },
    async () => ({
      content: [
        { type: "text" as const, text: "File tree refresh notification sent." },
      ],
    })
  );

  server.registerTool(
    "preview_html",
    {
      description:
        "Open or switch to an HTML file in the project workspace tab. The path is relative to the project root, e.g. 'docs/index.html'.",
      inputSchema: z.object({ path: z.string().describe("HTML file path relative to the project root, e.g. 'docs/foo.html'") }),
    },
    async ({ path }: { path: string }) => {
      if (!path || typeof path !== "string" || !path.endsWith(".html")) {
        throw new Error("preview_html only accepts .html files");
      }
      return {
        content: [
          { type: "text" as const, text: `Preview requested for ${path}` },
        ],
      };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[client-tools-mcp] server started on stdio");
}

main().catch((err) => {
  console.error("[client-tools-mcp] fatal:", err);
  process.exit(1);
});
