import { AsyncLocalStorage } from "node:async_hooks";

interface McpContext {
  userId: string | null;
}

const storage = new AsyncLocalStorage<McpContext>();

/**
 * 在指定的 MCP 用户上下文中执行异步操作。
 * 用于将 API Key 认证后的 userId 传递到 tool handler。
 */
export function runWithMcpContext<T>(
  ctx: McpContext,
  fn: () => T | Promise<T>
): Promise<T> {
  return Promise.resolve(storage.run(ctx, fn));
}

/**
 * 获取当前 MCP 请求的 userId。
 * 如果不在 MCP 上下文中，返回 null。
 */
export function getMcpUserId(): string | null {
  return storage.getStore()?.userId ?? null;
}
