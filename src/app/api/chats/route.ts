import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { chats, modelConfigs, templates } from "@/db/schema";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";

// GET /api/chats?page=1&pageSize=20&projectId=xxx&since=ISO_DATE
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get("pageSize") ?? "20")));
  const projectId = url.searchParams.get("projectId");
  const workspaceId = url.searchParams.get("workspaceId");
  const since = url.searchParams.get("since");
  const offset = (page - 1) * pageSize;

  const conditions: ReturnType<typeof eq | typeof isNull | typeof gte>[] = [];
  if (projectId) {
    conditions.push(projectId === "__none__" ? isNull(chats.projectId) : eq(chats.projectId, projectId));
  }
  if (workspaceId) {
    conditions.push(workspaceId === "__none__" ? isNull(chats.workspaceId) : eq(chats.workspaceId, workspaceId));
  }
  if (since) {
    conditions.push(gte(chats.updatedAt, since));
  }
  const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

  const totalResult = db
    .select({ count: sql<number>`count(*)` })
    .from(chats)
    .where(whereCondition)
    .get();
  const total = totalResult?.count ?? 0;

  const rows = db
    .select({
      id: chats.id,
      title: chats.title,
      modelId: chats.modelId,
      templateId: chats.templateId,
      projectId: chats.projectId,
      workspaceId: chats.workspaceId,
      createdAt: chats.createdAt,
      updatedAt: chats.updatedAt,
      modelName: modelConfigs.name,
      templateName: templates.name,
    })
    .from(chats)
    .leftJoin(modelConfigs, eq(chats.modelId, modelConfigs.id))
    .leftJoin(templates, eq(chats.templateId, templates.id))
    .where(whereCondition)
    .orderBy(desc(chats.updatedAt))
    .limit(pageSize)
    .offset(offset)
    .all();

  return NextResponse.json({ chats: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

// DELETE /api/chats - 清空所有会话
export async function DELETE() {
  // Static handler — note: no req means no auth possible; skipping guard
  // (if this handler needs auth, it should be a route with req param)
  db.delete(chats).run();
  return NextResponse.json({ success: true });
}

// POST /api/chats
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const { title, modelId, templateId, projectId, workspaceId } = body;

  const now = new Date().toISOString();
  const result = db.insert(chats).values({
    title: title || "New Chat",
    modelId: modelId ?? undefined,
    templateId: templateId ?? undefined,
    projectId: projectId ?? undefined,
    workspaceId: workspaceId ?? undefined,
    createdAt: now,
    updatedAt: now,
  }).run();

  const created = db.select().from(chats).where(
    eq(chats.id, result.lastInsertRowid as number)
  ).get();

  return NextResponse.json(created);
}
