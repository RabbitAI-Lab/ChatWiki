import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listWorkspaceProjects, linkProjectToWorkspace, unlinkProjectFromWorkspace } from "@/lib/fs";

// GET /api/fs/workspaces/projects?type=personal&accountId=default&workspace={workspaceId}
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "personal") as "personal" | "enterprise";
  const accountId = searchParams.get("accountId") || auth.id;
  const workspace = searchParams.get("workspace");
  const orgId = searchParams.get("orgId") || undefined;

  if (!workspace) return NextResponse.json({ error: "workspace is required" }, { status: 400 });

  const projects = listWorkspaceProjects(type, accountId, workspace, orgId);
  return NextResponse.json(projects);
}

// POST /api/fs/workspaces/projects - link project to workspace
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const { type = "personal", accountId = auth.id, workspace, projectId, orgId } = body;
  if (!workspace || !projectId) {
    return NextResponse.json({ error: "workspace and projectId are required" }, { status: 400 });
  }

  linkProjectToWorkspace(type, accountId, workspace, projectId, orgId);
  return NextResponse.json({ success: true });
}

// DELETE /api/fs/workspaces/projects - unlink project from workspace
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const { type = "personal", accountId = auth.id, workspace, projectId, orgId } = body;
  if (!workspace || !projectId) {
    return NextResponse.json({ error: "workspace and projectId are required" }, { status: 400 });
  }

  unlinkProjectFromWorkspace(type, accountId, workspace, projectId, orgId);
  return NextResponse.json({ success: true });
}
