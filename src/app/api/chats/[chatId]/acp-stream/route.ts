import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { chats } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canAccessChat } from "@/lib/auth/chat-access";
import { isAcpPromptInProgress, getAcpClientRef } from "@/lib/acp-model-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/chats/[chatId]/acp-stream
 *
 * ACP 恢复 SSE 流式端点。
 * 当用户刷新页面后，检测是否有 ACP prompt 正在进行中。
 * 如果有，先回放所有历史事件（_eventHistory），然后实时消费新事件。
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { chatId } = await params;
  const chatIdNum = parseInt(chatId);

  // 校验 chat 访问权限
  const chat = db.select().from(chats).where(eq(chats.id, chatIdNum)).get();
  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }
  if (!canAccessChat(auth, chat)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 检查是否有 ACP prompt 正在进行
  if (!isAcpPromptInProgress(chatIdNum)) {
    // 不在进行中，返回 SSE 流立即关闭
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`event: not_in_progress\ndata: {"type":"not_in_progress"}\n\n`)
        );
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // ACP 正在进行，建立 SSE 流
  const clientRef = getAcpClientRef(chatIdNum);
  if (!clientRef) {
    // clientRef 获取失败（极端情况），按不在进行中处理
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`event: not_in_progress\ndata: {"type":"not_in_progress"}\n\n`)
        );
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const encoder = new TextEncoder();
  let aborted = false;
  const onAbort = () => { aborted = true; };
  req.signal.addEventListener("abort", onAbort, { once: true });

  // 15 分钟空闲超时：每次输出事件后重置，仅在持续无输出时才触发
  const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
  let idleTimeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    console.log("[ACP-Stream] 空闲超时关闭, chatId=", chatIdNum);
    aborted = true;
  }, IDLE_TIMEOUT_MS);

  const resetIdleTimeout = () => {
    if (idleTimeoutId) clearTimeout(idleTimeoutId);
    idleTimeoutId = setTimeout(() => {
      console.log("[ACP-Stream] 空闲超时关闭, chatId=", chatIdNum);
      aborted = true;
    }, IDLE_TIMEOUT_MS);
  };

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        // 步骤 1: 同步读取事件历史 + 清空队列（Node.js 单线程保证原子性）
        const history = clientRef.getEventHistory();
        clientRef.clearEventQueue();

        console.log("[ACP-Stream] 回放历史事件, chatId=", chatIdNum, "count=", history.length);

        // 步骤 2: 回放所有历史事件（原始格式，与正常流完全一致）
        for (const event of history) {
          if (aborted) break;
          const eventType = event.type === "text_delta" ? "delta" : event.type;
          const data = JSON.stringify(event);
          controller.enqueue(
            encoder.encode(`event: ${eventType}\ndata: ${data}\n\n`)
          );
          resetIdleTimeout();
        }

        if (aborted) {
          controller.close();
          return;
        }

        // 步骤 3: 实时消费后续新事件
        console.log("[ACP-Stream] 开始实时消费, chatId=", chatIdNum);
        for await (const event of clientRef.drainEvents()) {
          if (aborted) break;
          const eventType = event.type === "text_delta" ? "delta" : event.type;
          const data = JSON.stringify(event);
          controller.enqueue(
            encoder.encode(`event: ${eventType}\ndata: ${data}\n\n`)
          );
          resetIdleTimeout();
        }

        if (aborted) {
          controller.close();
          return;
        }

        // drainEvents 结束（promptDone=true），获取完整文本发送 done 事件
        const { text, thinking } = clientRef.getTextFromHistory();
        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({
              type: "done",
              fullText: text,
              thinking: thinking || undefined,
            })}\n\n`
          )
        );

        controller.close();
        console.log("[ACP-Stream] 流结束, chatId=", chatIdNum, "textLength=", text.length);
      } catch (err) {
        console.error("[ACP-Stream] 错误:", err instanceof Error ? err.message : String(err));
        if (!aborted) {
          try {
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({
                  type: "error",
                  error: `ACP 恢复流错误: ${err instanceof Error ? err.message : String(err)}`,
                })}\n\n`
              )
            );
          } catch { /* controller may be closed */ }
        }
        try { controller.close(); } catch { /* ok */ }
      } finally {
        clearTimeout(idleTimeoutId!);
        idleTimeoutId = null;
        req.signal.removeEventListener("abort", onAbort);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
