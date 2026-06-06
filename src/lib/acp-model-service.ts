/**
 * ACP 模式的流式模型响应
 *
 * 替代 model-service.ts 中的 SDK 直调逻辑，通过 ACP 连接池与 Agent 通信。
 */
import type { StreamEvent } from "./types";
import type { ContentBlock } from "@agentclientprotocol/sdk";
import { getOrCreateEntry, getOrCreateSession, buildPoolKey, type AcpPoolConfig } from "./acp-pool";
import { resolveModelConfig } from "./model-service";
import { db } from "@/db";
import { tokenUsageLogs } from "@/db/schema";

export async function* streamAcpModelResponse(
  modelId: number,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options: {
    userId: string;
    projectId?: string;
    workspaceId?: string;
    chatId: number;
    cwd?: string;
  }
): AsyncGenerator<StreamEvent> {
  const config = resolveModelConfig(modelId);

  // 构建 pool key
  const key = buildPoolKey({
    projectId: options.projectId,
    workspaceId: options.workspaceId,
    userId: options.userId,
  });

  // 构建 pool 配置
  const poolConfig: AcpPoolConfig = {
    modelId,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    modelName: config.modelName,
    cwd: options.cwd || process.cwd(),
    extraEnvJson: config.extraEnvJson,
  };

  console.log("[ACP] streamAcpModelResponse 开始");
  console.log("[ACP]   modelId:", modelId);
  console.log("[ACP]   key:", key);
  console.log("[ACP]   poolConfig.cwd:", poolConfig.cwd);
  console.log("[ACP]   poolConfig.modelName:", poolConfig.modelName);
  console.log("[ACP]   poolConfig.baseUrl:", poolConfig.baseUrl);
  console.log("[ACP]   messages count:", messages.length);
  console.log("[ACP]   options.userId:", options.userId);
  console.log("[ACP]   options.chatId:", options.chatId);

  let accumulatedText = "";
  let accumulatedThinking = "";

  try {
    // 1. 获取或创建连接池 entry
    console.log("[ACP] 获取连接池 entry, key=", key);
    const entry = await getOrCreateEntry(key, poolConfig);
    console.log("[ACP] 连接池 entry 就绪, key=", key, "closed=", entry.closed);

    // 2. 获取或创建 session（按 chatId 复用）
    const chatIdStr = String(options.chatId);
    const isNewSession = !entry.sessions.has(chatIdStr);
    console.log("[ACP] 获取 session, chatId=", chatIdStr, "isNewSession=", isNewSession);
    const sessionId = await getOrCreateSession(entry, chatIdStr, poolConfig.cwd);
    console.log("[ACP] sessionId=", sessionId);

    // 3. 准备 prompt 消息
    const isContinuation = entry.sessions.has(chatIdStr);
    const promptMessages = buildPromptMessages(messages, isContinuation);
    console.log("[ACP] prompt 消息准备完毕, isContinuation=", isContinuation, "promptBlocks=", promptMessages.length);
    if (promptMessages[0] && promptMessages[0].type === "text") {
      console.log("[ACP] prompt text length=", promptMessages[0].text.length, "preview=", promptMessages[0].text.slice(0, 200));
    }

    // 4. 重置 client 事件队列
    entry.clientRef.resetForNewPrompt();

    // 5. 发起 prompt
    console.log("[ACP] 发起 prompt, sessionId=", sessionId);
    const promptPromise = entry.connection
      .prompt({
        sessionId,
        prompt: promptMessages,
      })
      .then((response) => {
        // prompt 完成 → 标记 done
        entry.clientRef.markPromptDone();
        return response;
      })
      .catch((err) => {
        // prompt 错误 → 将错误推入队列
        entry.clientRef.markPromptDone();
        console.error("[ACP] prompt error:", err instanceof Error ? err.message : String(err));
        throw err;
      });

    // 6. 同时消费事件队列和等待 prompt 完成
    let _promptDone = false;
    let promptError: Error | null = null;

    // 后台等待 prompt 完成
    void promptPromise.catch((err: unknown) => {
      promptError = err instanceof Error ? err : new Error(String(err));
    }).finally(() => {
      _promptDone = true;
    });

    // 消费事件流
    console.log("[ACP] 开始消费事件流...");
    let eventCount = 0;
    for await (const event of entry.clientRef.drainEvents()) {
      eventCount++;
      if (event.type === "text_delta") {
        accumulatedText += event.text;
        yield event;
      } else if (event.type === "thinking_start") {
        yield event;
      } else if (event.type === "thinking_delta") {
        accumulatedThinking += event.text;
        yield event;
      } else if (event.type === "tool_call") {
        console.log("[ACP] tool_call event:", event.toolName);
        yield event;
      } else {
        console.log("[ACP] unhandled event type:", event.type);
      }
    }
    console.log("[ACP] 事件流结束, total events=", eventCount);

    // 7. 检查 prompt 是否有错误
    if (promptError) {
      yield {
        type: "error",
        error: `ACP 模型调用失败: ${(promptError as Error).message}`,
        code: "SDK_ERROR",
      };
      return;
    }

    // 8. 发送 done 事件
    console.log(
      "[ACP] response complete: key=", key, "textLength=",
      accumulatedText.length,
      "thinkingLength=",
      accumulatedThinking.length
    );

    // ── Token usage 采集（ACP 模式） ──
    const finalUsage = entry.clientRef.getLastUsageUpdate();
    if (finalUsage) {
      const prevUsed = entry.clientRef.getPrevUsageUsed();
      const incrementalUsed = Math.max(0, finalUsage.used - prevUsed);
      console.log(
        "[ACP] usage: used=", finalUsage.used,
        "prevUsed=", prevUsed,
        "incremental=", incrementalUsed,
        "contextSize=", finalUsage.size
      );
      try {
        db.insert(tokenUsageLogs).values({
          userId: options.userId,
          modelId,
          chatId: options.chatId,
          backend: "acp",
          inputTokens: 0,
          outputTokens: incrementalUsed,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
          totalTokens: incrementalUsed,
          costUsd: finalUsage.cost
            ? Math.round(finalUsage.cost.amount * 10000)
            : 0,
          contextSize: finalUsage.size,
          contextUsed: finalUsage.used,
          projectId: options.projectId,
          workspaceId: options.workspaceId,
          createdAt: new Date().toISOString(),
        }).run();
      } catch (err) {
        console.error("[ACP TokenUsage] failed to log:", err);
      }

      // 向前端发送 usage 事件
      yield {
        type: "usage" as const,
        inputTokens: 0,
        outputTokens: incrementalUsed,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
        totalTokens: incrementalUsed,
        costUsd: finalUsage.cost?.amount,
        contextSize: finalUsage.size,
        contextUsed: finalUsage.used,
      };
    }

    yield {
      type: "done",
      fullText: accumulatedText,
      thinking: accumulatedThinking || undefined,
    };
  } catch (err) {
    console.error("[ACP] stream error:", err instanceof Error ? err.message : String(err));
    yield {
      type: "error",
      error: `ACP 调用出错: ${err instanceof Error ? err.message : String(err)}`,
      code: "SDK_ERROR",
    };
  }
}

/**
 * 构建 ACP prompt 消息列表。
 *
 * 复用 session 时（isContinuation=true）只发最新一条用户消息。
 * 新 session 时发送完整消息列表。
 */
function buildPromptMessages(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  isContinuation: boolean
): ContentBlock[] {
  // ACP prompt 需要 user role 的消息
  // 将 system/assistant 消息包装为 user 消息中的上下文

  if (isContinuation) {
    // 复用 session：仅发送最新一条用户消息
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      return [{ type: "text" as const, text: lastUserMsg.content }];
    }
  }

  // 新 session：发送完整消息列表作为上下文
  const parts: string[] = [];
  for (const msg of messages) {
    if (msg.role === "system") {
      parts.push(`[System Instructions]: ${msg.content}`);
    } else if (msg.role === "user") {
      parts.push(`[用户]: ${msg.content}`);
    } else if (msg.role === "assistant") {
      parts.push(`[助手]: ${msg.content}`);
    }
  }

  return [{ type: "text" as const, text: parts.join("\n\n") }];
}
