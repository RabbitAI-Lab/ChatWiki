import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { chats, modelConfigs, templates } from "@/db/schema";
import { and, desc, eq, gte, isNull, or, sql, inArray, SQL } from "drizzle-orm";
import { findMemberEntityIds } from "@/lib/fs";

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

  // 用户隔离: 显示自己的 chats + 项目成员可见的 chats（userId 为 null 的旧数据也可见）
  const userCondition = or(eq(chats.userId, auth.id), isNull(chats.userId));

  // 查找用户作为成员的项目 ID，这些项目的 chats 也应该可见
  const memberProjectIds = findMemberEntityIds(auth.id, "projects", ".project.json");
  const memberWorkspaceIds = findMemberEntityIds(auth.id, "workspace", ".workspace.json");

  // 构建成员可见的 chats 条件：项目或工作空间关联的 chats
  let memberCondition: SQL | undefined = undefined;
  if (memberProjectIds.length > 0 || memberWorkspaceIds.length > 0) {
    const memberParts: SQL[] = [];
    if (memberProjectIds.length > 0) {
      memberParts.push(inArray(chats.projectId, memberProjectIds));
    }
    if (memberWorkspaceIds.length > 0) {
      memberParts.push(inArray(chats.workspaceId, memberWorkspaceIds));
    }
    // 成员 chats 条件：属于成员项目/工作空间的（不要求 userId 匹配）
    memberCondition = memberParts.length === 1 ? memberParts[0] : or(...memberParts);
  }

  // 综合条件：自己的 chats OR 成员项目/工作空间的 chats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [];
  if (memberCondition) {
    conditions.push(or(userCondition, memberCondition)!);
  } else {
    conditions.push(userCondition);
  }
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

// DELETE /api/chats - 清空当前用户的会话
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  db.delete(chats).where(eq(chats.userId, auth.id)).run();
  return NextResponse.json({ success: true });
}

// POST /api/chats
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const { title, modelId, templateId, projectId, workspaceId } = body;

  const now = new Date().toISOString();
  const result = db.insert(chats).values({
    userId: auth.id,
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
