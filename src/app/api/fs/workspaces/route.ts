import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { requireFeature } from "@/lib/auth/feature-gate";
import { listWorkspaces, createWorkspace, deleteWorkspace, readWorkspaceMeta, writeWorkspaceMeta } from "@/lib/fs";
import { getApiT } from "@/lib/i18n-api";

// GET /api/fs/workspaces?accountId={userId}
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId") || auth.id;

  const workspaces = await listWorkspaces(accountId);
  return NextResponse.json(workspaces);
}

// POST /api/fs/workspaces - create workspace
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;

  // 功能门控：workspace 功能需要订阅包含该 feature 的套餐
  const featureErr = await requireFeature(auth, "workspace");
  if (featureErr) return featureErr;

  const t = await getApiT();
  const body = await req.json();
  const { name } = body;
  const accountId = auth.id;
  if (!name) return NextResponse.json({ error: t('api.nameRequired') }, { status: 400 });

  const meta = await createWorkspace(accountId, name);
  return NextResponse.json(meta);
}

// DELETE /api/fs/workspaces - delete workspace
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: t('api.idRequired') }, { status: 400 });

  await deleteWorkspace(id);
  return NextResponse.json({ success: true });
}

// PATCH /api/fs/workspaces - update workspace (rename / sortOrder)
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { id, name, sortOrder } = body;
  if (!id) return NextResponse.json({ error: t('api.idRequired') }, { status: 400 });

  const dirSegments = ["workspace", id];

  const meta = await readWorkspaceMeta(dirSegments);
  if (!meta) return NextResponse.json({ error: t('api.workspaceNotFound') }, { status: 404 });

  if (name !== undefined) meta.name = name;
  if (sortOrder !== undefined) meta.sortOrder = sortOrder;
  await writeWorkspaceMeta(meta, dirSegments);
  return NextResponse.json(meta);
}

// PUT /api/fs/workspaces - batch reorder workspaces
// Body: { type, accountId, orgId?, orders: [{ id, sortOrder }] }
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { orders } = body;
  if (!Array.isArray(orders)) return NextResponse.json({ error: t('api.missingRequiredParams') }, { status: 400 });

  for (const item of orders) {
    const dirSegments = ["workspace", item.id];
    const meta = await readWorkspaceMeta(dirSegments);
    if (meta) {
      meta.sortOrder = item.sortOrder;
      await writeWorkspaceMeta(meta, dirSegments);
    }
  }
  return NextResponse.json({ success: true });
}
