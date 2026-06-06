import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod/v4";

export const CLIENT_TOOL_PREFIX = "mcp__rabbitdocs_client__";

const refreshFileTree = tool(
  "refresh_file_tree",
  "Refresh the file tree in the user's UI. Call this tool after you create, delete, or rename files or directories so the user immediately sees the updated file tree.",
  {},
  async () => ({
    content: [
      { type: "text" as const, text: "File tree refresh notification sent." },
    ],
  })
);

/**
 * 让 agent 提示用户在项目工作区打开/预览一个 HTML 文件。
 * path 相对于项目根，例如 'docs/index.html'。
 * 如果对应 tab 已打开，会切换到该 tab；未打开则打开新 tab。
 * 前端负责拦截处理。
 */
const previewHtml = tool(
  "preview_html",
  "Open or switch to an HTML file in the project workspace tab. The path is relative to the project root, e.g. 'docs/index.html'. If a tab is already open for this file, switches to it; otherwise opens a new tab with a Monaco editor and iframe preview.",
  {
    path: z
      .string()
      .describe(
        "HTML file path relative to the project root, e.g. 'docs/foo.html'"
      ),
  },
  async ({ path }) => {
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

/**
 * 让 agent 通知前端刷新已打开文件的内容。
 * path 相对于项目根，例如 'docs/index.html'。
 * 前端仅刷新已在 tabs 中打开的文件，不打开新 tab。
 */
const refreshFileContent = tool(
  "refresh_file_content",
  "Notify the frontend to reload a file's content in the editor after it has been modified externally. The path is relative to the project root, e.g. 'docs/foo.md'. Call this after writing or editing a file that is currently open in the user's editor.",
  {
    path: z
      .string()
      .describe(
        "File path relative to the project root, e.g. 'docs/foo.md'"
      ),
  },
  async ({ path }) => {
    if (!path || typeof path !== "string") {
      throw new Error("refresh_file_content requires a valid path");
    }
    return {
      content: [
        { type: "text" as const, text: `File content refresh requested for ${path}` },
      ],
    };
  }
);

export function createClientToolsMcpServer() {
  return createSdkMcpServer({
    name: "rabbitdocs_client",
    version: "1.0.0",
    tools: [refreshFileTree, previewHtml, refreshFileContent],
  });
}
