import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { chats, modelConfigs, templates, users, entities, entityMembers } from "@/db/schema";
import { and, desc, eq, gte, isNull, or, sql, inArray, SQL } from "drizzle-orm";
import { aliasedTable } from "drizzle-orm";

// GET /api/chats?page=1&pageSize=20&scope=owned|participated|all&projectId=xxx&since=ISO_DATE
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get("pageSize") ?? "20")));
  const scope = url.searchParams.get("scope") || "owned";
  const projectId = url.searchParams.get("projectId");
  const workspaceId = url.searchParams.get("workspaceId");
  const since = url.searchParams.get("since");
  const offset = (page - 1) * pageSize;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [];

  if (scope === "all") {
    // 兼容旧调用: 显示自己的 chats + 成员项目/工作空间的 chats
    const userCondition = or(eq(chats.userId, auth.id), isNull(chats.userId));
    const ownedEntities = await db
      .select({ id: entities.id, type: entities.type })
      .from(entities)
      .where(eq(entities.ownerId, auth.id));
    const ownedProjectIds = ownedEntities.filter(e => e.type === "project").map(e => e.id);
    const ownedWorkspaceIds = ownedEntities.filter(e => e.type === "workspace").map(e => e.id);
    const memberProjectIds = [...ownedProjectIds];
    const memberWorkspaceIds = [...ownedWorkspaceIds];
    // 查找参与的实体
    const memberRows = await db
      .select({ entityId: entityMembers.entityId })
      .from(entityMembers)
      .where(eq(entityMembers.userId, auth.id));
    if (memberRows.length > 0) {
      const memberEntities = await db
        .select({ id: entities.id, type: entities.type })
        .from(entities)
        .where(inArray(entities.id, memberRows.map(r => r.entityId)));
      for (const e of memberEntities) {
        if (e.type === "project" && !memberProjectIds.includes(e.id)) memberProjectIds.push(e.id);
        if (e.type === "workspace" && !memberWorkspaceIds.includes(e.id)) memberWorkspaceIds.push(e.id);
      }
    }
    const memberParts: SQL[] = [];
    if (memberProjectIds.length > 0) memberParts.push(inArray(chats.projectId, memberProjectIds));
    if (memberWorkspaceIds.length > 0) memberParts.push(inArray(chats.workspaceId, memberWorkspaceIds));
    if (memberParts.length > 0) {
      conditions.push(or(userCondition!, ...memberParts)!);
    } else {
      conditions.push(userCondition!);
    }
  } else if (scope === "owned") {
    // "我的项目/空间": 查 entities 表中 ownerId = auth.id 的 project/workspace
    const ownedEntities = await db
      .select({ id: entities.id, type: entities.type })
      .from(entities)
      .where(eq(entities.ownerId, auth.id));
    const ownedProjectIds = ownedEntities.filter(e => e.type === "project").map(e => e.id);
    const ownedWorkspaceIds = ownedEntities.filter(e => e.type === "workspace").map(e => e.id);

    const parts: SQL[] = [];
    if (ownedProjectIds.length > 0) parts.push(inArray(chats.projectId, ownedProjectIds));
    if (ownedWorkspaceIds.length > 0) parts.push(inArray(chats.workspaceId, ownedWorkspaceIds));
    // 同时包含无项目关联的个人会话
    parts.push(and(isNull(chats.projectId), isNull(chats.workspaceId))!);
    // 兼容旧数据：userId = auth.id 但没有关联项目的
    parts.push(eq(chats.userId, auth.id));
    conditions.push(or(...parts)!);
  } else {
    // "我参与的": 查 entityMembers 表中 userId = auth.id 且 ownerId != auth.id
    const memberRows2 = await db
      .select({ entityId: entityMembers.entityId })
      .from(entityMembers)
      .where(
        and(
          eq(entityMembers.userId, auth.id),
          sql`${entityMembers.ownerId} != ${auth.id}`
        )
      );
    const participatedIds = memberRows2.map(r => r.entityId);
    if (participatedIds.length === 0) {
      // 没有参与的实体，直接返回空
      return NextResponse.json({ chats: [], total: 0, page, pageSize, totalPages: 0 });
    }
    // 分别查这些 ID 是 project 还是 workspace
    const participatedEntities = await db
      .select({ id: entities.id, type: entities.type })
      .from(entities)
      .where(inArray(entities.id, participatedIds));
    const participatedProjectIds = participatedEntities.filter(e => e.type === "project").map(e => e.id);
    const participatedWorkspaceIds = participatedEntities.filter(e => e.type === "workspace").map(e => e.id);

    const parts: SQL[] = [];
    if (participatedProjectIds.length > 0) parts.push(inArray(chats.projectId, participatedProjectIds));
    if (participatedWorkspaceIds.length > 0) parts.push(inArray(chats.workspaceId, participatedWorkspaceIds));
    if (parts.length > 0) {
      conditions.push(or(...parts)!);
    }
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

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(chats)
    .where(whereCondition);
  const total = totalResult?.count ?? 0;

  const creatorUser = aliasedTable(users, "creator_user");
  const modifierUser = aliasedTable(users, "modifier_user");

  const rows = await db
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
      creatorName: creatorUser.name,
      modifierName: modifierUser.name,
    })
    .from(chats)
    .leftJoin(modelConfigs, eq(chats.modelId, modelConfigs.id))
    .leftJoin(templates, eq(chats.templateId, templates.id))
    .leftJoin(creatorUser, eq(chats.userId, creatorUser.id))
    .leftJoin(modifierUser, eq(chats.updatedBy, modifierUser.id))
    .where(whereCondition)
    .orderBy(desc(chats.updatedAt))
    .limit(pageSize)
    .offset(offset);

  return NextResponse.json({ chats: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

// DELETE /api/chats - 清空当前用户的会话
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  await db.delete(chats).where(eq(chats.userId, auth.id));
  return NextResponse.json({ success: true });
}

// POST /api/chats
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const { title, modelId, templateId, projectId, workspaceId } = body;

  const now = new Date().toISOString();
  const [created] = await db.insert(chats).values({
    userId: auth.id,
    title: title || "New Chat",
    modelId: modelId ?? undefined,
    templateId: templateId ?? undefined,
    projectId: projectId ?? undefined,
    workspaceId: workspaceId ?? undefined,
    createdAt: now,
    updatedAt: now,
  }).returning();

  return NextResponse.json(created);
}
