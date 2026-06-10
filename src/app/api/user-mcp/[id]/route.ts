import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { userMcpConfigs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { McpServerEntry } from "@/components/mcp/types";

// PATCH /api/user-mcp/[id] — 修改一条 MCP 配置（entry/enabled）
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(userMcpConfigs)
    .where(
      and(
        eq(userMcpConfigs.id, parseInt(id)),
        eq(userMcpConfigs.userId, auth.id)
      )
    );

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (body.entry !== undefined) {
    if (typeof body.entry !== "object" || body.entry === null) {
      return NextResponse.json(
        { error: "entry must be an object" },
        { status: 400 }
      );
    }
    updateData.entryJson = JSON.stringify(body.entry as McpServerEntry);
  }

  if (body.enabled !== undefined) {
    updateData.enabled = !!body.enabled;
  }

  await db
    .update(userMcpConfigs)
    .set(updateData)
    .where(eq(userMcpConfigs.id, parseInt(id)));

  return NextResponse.json({ success: true });
}

// DELETE /api/user-mcp/[id] — 删除一条 MCP 配置
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  await db
    .delete(userMcpConfigs)
    .where(
      and(
        eq(userMcpConfigs.id, parseInt(id)),
        eq(userMcpConfigs.userId, auth.id)
      )
    );

  return NextResponse.json({ success: true });
}
