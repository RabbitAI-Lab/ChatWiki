/**
 * ACP session/update → ChatWiki StreamEvent 事件映射
 *
 * 将 ACP 协议的 SessionUpdate 通知转换为 ChatWiki 前端可理解的 StreamEvent。
 */
import type { SessionUpdate } from "@agentclientprotocol/sdk";
import type { StreamEvent } from "./types";

// client tools 名称前缀（用于从 ACP tool_call.title 中识别前端信号工具）
const CLIENT_TOOL_NAMES = new Set(["refresh_file_tree", "preview_html", "refresh_file_content"]);

/**
 * 缓存 tool_call 事件的 rawInput，按 toolCallId 索引。
 * 用于 tool_call_update 完成时获取被修改文件的路径。
 * 条目在对应 tool_call_update completed 后清除，或超过最大数量时淘汰最旧的。
 */
const TOOL_CALL_CACHE_MAX = 200;
const toolCallInputCache = new Map<string, Record<string, unknown>>();

/** 清理缓存中最早的条目，保持 Map 不超过 TOOL_CALL_CACHE_MAX */
function evictOverflow() {
  if (toolCallInputCache.size <= TOOL_CALL_CACHE_MAX) return;
  // Map 保持插入顺序，删除最早的条目
  const keysIter = toolCallInputCache.keys();
  const excess = toolCallInputCache.size - TOOL_CALL_CACHE_MAX;
  for (let i = 0; i < excess; i++) {
    const oldest = keysIter.next().value;
    if (oldest !== undefined) toolCallInputCache.delete(oldest);
  }
}

/** 清空所有缓存（连接关闭时调用） */
export function clearToolCallInputCache() {
  toolCallInputCache.clear();
}

/**
 * 将 ACP SessionUpdate 映射为零或多个 ChatWiki StreamEvent。
 */
export function mapAcpUpdateToStreamEvents(update: SessionUpdate): StreamEvent[] {
  const events: StreamEvent[] = [];
  const updateType = update.sessionUpdate;

  switch (updateType) {
    case "agent_message_chunk": {
      // ContentChunk → text_delta
      const content = update.content;
      if (content.type === "text" && typeof content.text === "string") {
        events.push({ type: "text_delta", text: content.text });
      }
      break;
    }

    case "agent_thought_chunk": {
      // ContentChunk → thinking_start + thinking_delta
      const content = update.content;
      if (content.type === "text" && typeof content.text === "string") {
        // 注意：ACP 没有 thinking_start 事件，我们总是 yield thinking_start + thinking_delta
        // 实际使用中由 acp-client 在首次 thought_chunk 时单独发送 thinking_start
        events.push({ type: "thinking_delta", text: content.text });
      }
      break;
    }

    case "tool_call": {
      // ToolCall → tool_call (仅前端信号工具)
      const title = update.title;
      // 从 title 中提取工具名（claude-agent-acp 将工具名映射为 title）
      // 格式可能是 "refresh_file_tree" 或 "mcp__rabbitdocs_client__refresh_file_tree"
      const toolName = extractToolName(title);

      // 缓存 Write/Edit 工具的 rawInput，供 tool_call_update 使用
      if ((toolName === "Write" || toolName === "Edit") && update.toolCallId) {
        const raw = (update as Record<string, unknown>).rawInput as Record<string, unknown> | undefined;
        if (raw) {
          toolCallInputCache.set(update.toolCallId, raw);
          evictOverflow();
        }
      }

      if (CLIENT_TOOL_NAMES.has(toolName)) {
        events.push({
          type: "tool_call",
          toolName,
          args: (update.rawInput as Record<string, unknown>) ?? {},
        });
      }
      // 非 client tool 的 tool_call 只记录日志，不映射到前端
      console.log("[ACP Mapper] tool_call:", title, "toolName:", toolName);
      break;
    }

    case "tool_call_update": {
      // 检测文件写入/编辑完成，自动触发文件树刷新和内容刷新
      const tcu = update as Record<string, unknown>;
      const status = tcu.status as string | undefined;
      const title = tcu.title as string | undefined;
      if (status === "completed" && title) {
        const toolName = extractToolName(title);
        if (toolName === "Write" || toolName === "Edit") {
          console.log(`[ACP Mapper] auto refresh_file_tree: tool=${toolName} completed`);
          events.push({ type: "tool_call", toolName: "refresh_file_tree", args: {} });

          // 提取被修改文件的路径，触发 refresh_file_content
          const toolCallId = tcu.toolCallId as string | undefined;
          let filePath: string | undefined;
          const rawInput = tcu.rawInput as Record<string, unknown> | undefined;
          if (rawInput?.file_path && typeof rawInput.file_path === "string") {
            filePath = rawInput.file_path;
          } else if (toolCallId) {
            const cached = toolCallInputCache.get(toolCallId);
            if (cached?.file_path && typeof cached.file_path === "string") {
              filePath = cached.file_path;
            }
          }
          if (filePath) {
            const normalizedPath = normalizeDocsPath(filePath);
            console.log(`[ACP Mapper] auto refresh_file_content: tool=${toolName} path=${normalizedPath}`);
            events.push({ type: "tool_call", toolName: "refresh_file_content", args: { path: normalizedPath } });
          } else {
            console.log(`[ACP Mapper] auto refresh_file_content: no file_path found for tool=${toolName} toolCallId=${toolCallId}`);
          }
          // 清理缓存
          if (toolCallId) {
            toolCallInputCache.delete(toolCallId);
          }
        }
      }
      console.log("[ACP Mapper] session update:", updateType, "status=", status, "title=", title);
      break;
    }
    case "plan":
    case "plan_update":
    case "plan_removed":
    case "available_commands_update":
    case "current_mode_update":
    case "config_option_update":
    case "session_info_update":
    case "usage_update":
    case "user_message_chunk": {
      // 这些更新类型不需要映射到前端，仅记录日志
      console.log("[ACP Mapper] session update:", updateType);
      break;
    }

    default: {
      console.log("[ACP Mapper] unknown session update:", updateType);
      break;
    }
  }

  return events;
}

/**
 * 从 ACP tool_call 的 title 中提取工具名。
 *
 * claude-agent-acp 传递的 title 格式可能是：
 * - "refresh_file_tree" (直接工具名)
 * - "MCP tool: refresh_file_tree" (带前缀)
 * - "mcp__rabbitdocs_client__refresh_file_tree" (完整 MCP 名称)
 */
function extractToolName(title: string): string {
  // 去掉 MCP 前缀
  const mcpPrefix = "mcp__rabbitdocs_client__";
  if (title.startsWith(mcpPrefix)) {
    return title.slice(mcpPrefix.length);
  }
  // 去掉 "MCP tool: " 前缀
  const mcpToolPrefix = "MCP tool: ";
  if (title.startsWith(mcpToolPrefix)) {
    return title.slice(mcpToolPrefix.length);
  }
  return title;
}

/**
 * 将 Write/Edit 工具的 file_path 标准化为 tab 系统使用的相对路径。
 *
 * Write/Edit 的 file_path 是相对于项目根的路径，例如：
 *   "docs/foo.md" → "foo.md"
 *   "docs/sub/bar.html" → "sub/bar.html"
 *   "./docs/foo.md" → "foo.md"
 */
function normalizeDocsPath(filePath: string): string {
  let normalized = filePath.replace(/^\.\//, "");
  const docsPrefix = "docs/";
  if (normalized.startsWith(docsPrefix)) {
    normalized = normalized.slice(docsPrefix.length);
  }
  return normalized;
}
