import { NextRequest } from "next/server";

const MCP_TARGET = `http://127.0.0.1:${process.env.MCP_PORT || "4001"}/mcp`;

/**
 * 将请求透传到 MCP Express 服务器，正确处理 JSON 和 SSE 流式响应。
 * 路径: /mcp → http://127.0.0.1:4001/mcp
 */
async function proxy(req: NextRequest): Promise<Response> {
  // 构建上游请求 headers（排除 host）
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower !== "host" && lower !== "connection") {
      headers.set(key, value);
    }
  });

  const method = req.method;
  let body: BodyInit | null = null;

  if (method === "POST" || method === "PUT" || method === "PATCH") {
    body = JSON.stringify(await req.json());
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
  }

  const upstream = await fetch(MCP_TARGET, {
    method,
    headers,
    body,
    // @ts-expect-error duplex 在 Node.js fetch 中支持
    duplex: body ? "half" : undefined,
  });

  // 构建响应 headers，透传 MCP 相关 header
  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    // 跳过 transfer-encoding，让运行时自动处理
    if (lower !== "transfer-encoding" && lower !== "content-encoding") {
      resHeaders.set(key, value);
    }
  });

  // SSE 流式响应：直接透传 readable stream
  const contentType = upstream.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream") || contentType.includes("application/octet-stream")) {
    if (!upstream.body) {
      return new Response(null, { status: upstream.status, headers: resHeaders });
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    });
  }

  // 普通 JSON 响应
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export async function POST(req: NextRequest) {
  return proxy(req);
}

export async function GET(req: NextRequest) {
  return proxy(req);
}

export async function DELETE(req: NextRequest) {
  return proxy(req);
}
