import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import {
  readWorkspaceMeta,
  addWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspaceMember,
} from "@/lib/fs";
import { logOperation, extractProjectId } from "@/lib/operation-log";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getApiT } from "@/lib/i18n-api";

// GET /api/fs/workspace-members?workspaceId={id}
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  const t = await getApiT();
  if (!workspaceId) {
    return NextResponse.json({ error: t('api.dirSegmentsRequired') }, { status: 400 });
  }
  const dirSegments = ["workspace", workspaceId];
  const meta = await readWorkspaceMeta(dirSegments);
  if (!meta) {
    return NextResponse.json({ error: t('api.workspaceNotFound') }, { status: 404 });
  }
  return NextResponse.json(meta.members || []);
}

// POST /api/fs/workspace-members - add a member
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { workspaceId, member } = body;
  if (!workspaceId || !member) {
    return NextResponse.json({ error: t('api.members.dirSegmentsAndMemberRequired') }, { status: 400 });
  }
  const dirSegments = ["workspace", workspaceId];
  try {
    // 根据 accountName 查询用户表自动关联 userId
    if (!member.userId && member.accountName) {
      const [userRow] = await db.select().from(users).where(eq(users.email, member.accountName))
        ?? (await db.select().from(users).where(eq(users.name, member.accountName)));
      if (userRow) {
        member.userId = userRow.id;
      }
    }
    const members = await addWorkspaceMember(dirSegments, member);
    logOperation({
      projectId: extractProjectId(dirSegments),
      category: "member",
      action: "create",
      detail: `添加了成员 ${member.accountName}`,
    });
    return NextResponse.json(members);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

// PATCH /api/fs/workspace-members - update a member
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { workspaceId, memberId, updates } = body;
  if (!workspaceId || !memberId || !updates) {
    return NextResponse.json({ error: t('api.missingRequiredParams') }, { status: 400 });
  }
  const dirSegments = ["workspace", workspaceId];
  try {
    const updated = await updateWorkspaceMember(dirSegments, memberId, updates);
    if (!updated) {
      return NextResponse.json({ error: t('api.memberNotFound') }, { status: 404 });
    }
    logOperation({
      projectId: extractProjectId(dirSegments),
      category: "member",
      action: "update",
      detail: `更新了成员 ${updated.accountName}`,
    });
    return NextResponse.json(updated);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

// DELETE /api/fs/workspace-members - remove a member
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { workspaceId, memberId } = body;
  if (!workspaceId || !memberId) {
    return NextResponse.json({ error: t('api.dirSegmentsRequired') }, { status: 400 });
  }
  const dirSegments = ["workspace", workspaceId];
  try {
    const meta = await readWorkspaceMeta(dirSegments);
    const memberName = meta?.members?.find((m) => m.id === memberId)?.accountName || memberId;
    removeWorkspaceMember(dirSegments, memberId);
    logOperation({
      projectId: extractProjectId(dirSegments),
      category: "member",
      action: "delete",
      detail: `移除了成员 ${memberName}`,
    });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
