import { NextRequest } from "next/server";
import { streamModelResponse } from "@/lib/model-service";
import type { ChatCompletionRequest } from "@/lib/types";
import { ModelError } from "@/lib/types";
import path from "node:path";
import { getDataRoot } from "@/lib/fs";
import { db } from "@/db";
import { systemPrompts } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// POST /api/chat/completions — SSE streaming endpoint
export async function POST(req: NextRequest) {
  const body: Partial<ChatCompletionRequest> = await req.json();
  const { modelId, messages, systemPrompt, projectId } = body;

  if (!modelId || !messages || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "modelId and messages are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Construct cwd from DATA_ROOT and projectId
  let cwd: string | undefined;
  if (projectId) {
    cwd = path.join(getDataRoot(), "personal", "default", "projects", projectId);
  }

  // Inject cwd info into the system message
  if (cwd) {
    const cwdSection = `\n\n---\n\n## 运行环境\n\n- 工作目录(cwd): ${cwd}\n- 所有文件操作都应限制在此目录内。`;
    if (messages[0]?.role === "system") {
      messages[0] = { ...messages[0], content: messages[0].content + cwdSection };
    } else {
      messages.unshift({
        role: "system",
        content: `## 运行环境\n\n- 工作目录(cwd): ${cwd}\n- 所有文件操作都应限制在此目录内。`,
      });
    }
  }

  // Inject global system prompts
  const activePrompts = db.select().from(systemPrompts)
    .where(eq(systemPrompts.enabled, 1))
    .orderBy(systemPrompts.sortOrder)
    .all();

  if (activePrompts.length > 0) {
    const globalSection = activePrompts.map(p => p.content).join("\n\n---\n\n");
    if (messages[0]?.role === "system") {
      messages[0] = { ...messages[0], content: globalSection + "\n\n" + messages[0].content };
    } else {
      messages.unshift({
        role: "system",
        content: globalSection,
      });
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const generator = streamModelResponse(modelId, messages, {
          cwd,
          projectId,
        });

        for await (const event of generator) {
          const eventType = event.type === "text_delta" ? "delta" : event.type;
          const data = JSON.stringify(event);
          controller.enqueue(
            encoder.encode(`event: ${eventType}\ndata: ${data}\n\n`)
          );
        }

        controller.close();
      } catch (err) {
        if (err instanceof ModelError) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                type: "error",
                error: err.message,
                code: err.code,
              })}\n\n`
            )
          );
        } else {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                type: "error",
                error: `服务内部错误: ${err instanceof Error ? err.message : String(err)}`,
              })}\n\n`
            )
          );
        }
        controller.close();
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
