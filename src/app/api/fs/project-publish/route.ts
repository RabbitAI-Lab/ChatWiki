import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { readProjectMeta, writeProjectMeta, type PublishStatus } from "@/lib/fs";
import { logOperation, extractProjectId } from "@/lib/operation-log";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

// GET /api/fs/project-publish - 获取项目发布状态
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const t = await getApiT();

  if (!projectId) {
    return NextResponse.json({ error: t('api.projectIdRequired') }, { status: 400 });
  }

  const dirSegments = ["projects", projectId];
  const meta = await readProjectMeta(dirSegments);

  if (!meta) {
    return NextResponse.json({ error: t('api.projectNotFound') }, { status: 404 });
  }

  return NextResponse.json({ publishStatus: meta.publishStatus ?? { enabled: false } });
}

// POST /api/fs/project-publish - 切换发布状态
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { projectId, enabled } = body as {
    projectId: string;
    enabled: boolean;
  };

  if (!projectId || typeof enabled !== "boolean") {
    return NextResponse.json({ error: t('api.missingRequiredParams') }, { status: 400 });
  }

  const dirSegments = ["projects", projectId];
  const meta = await readProjectMeta(dirSegments);
  if (!meta) {
    return NextResponse.json({ error: t('api.projectNotFound') }, { status: 404 });
  }

  // 仅 Owner 可操作
  if (auth.id !== meta.ownerId) {
    return NextResponse.json({ error: t('api.noPermission') }, { status: 403 });
  }

  const now = new Date().toISOString();
  const publishStatus: PublishStatus = enabled
    ? { enabled: true, publishedAt: meta.publishStatus?.publishedAt || now }
    : { enabled: false };

  meta.publishStatus = publishStatus;
  await writeProjectMeta(meta, dirSegments);

  logOperation({
    projectId: extractProjectId(dirSegments),
    category: "sandbox", // 复用 category
    action: enabled ? "enable" : "disable",
    detail: enabled ? "Publish docs site" : "Unpublish docs site",
  });

  return NextResponse.json({ publishStatus });
}
