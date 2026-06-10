import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { userMcpConfigs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NAME_PATTERN, type McpServerEntry } from "@/components/mcp/types";

export const dynamic = "force-dynamic";

// GET /api/user-mcp — 返回当前用户的所有第三方 MCP 配置
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select()
    .from(userMcpConfigs)
    .where(eq(userMcpConfigs.userId, auth.id));

  const result = rows.map((row) => ({
    id: row.id,
    name: row.name,
    entry: JSON.parse(row.entryJson) as McpServerEntry,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  return NextResponse.json(result);
}

// POST /api/user-mcp — 新增一条第三方 MCP 配置
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { name, entry } = body as {
    name?: string;
    entry?: McpServerEntry;
  };

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (!NAME_PATTERN.test(name)) {
    return NextResponse.json(
      { error: "name must contain only letters, digits, underscore and dash" },
      { status: 400 }
    );
  }

  if (!entry || typeof entry !== "object") {
    return NextResponse.json({ error: "entry is required" }, { status: 400 });
  }

  // 检查同名
  const [existing] = await db
    .select({ id: userMcpConfigs.id })
    .from(userMcpConfigs)
    .where(
      and(
        eq(userMcpConfigs.userId, auth.id),
        eq(userMcpConfigs.name, name)
      )
    );

  if (existing) {
    return NextResponse.json(
      { error: `MCP "${name}" already exists` },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const [inserted] = await db
    .insert(userMcpConfigs)
    .values({
      userId: auth.id,
      name,
      entryJson: JSON.stringify(entry),
      enabled: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return NextResponse.json({ id: inserted.id, name: inserted.name }, { status: 201 });
}
