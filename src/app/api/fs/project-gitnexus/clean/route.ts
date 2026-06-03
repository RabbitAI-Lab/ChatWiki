import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { readProjectMeta } from "@/lib/fs";
import { cancelGitNexus, runGitNexus } from "@/lib/gitnexus-service";
import { logOperation, extractProjectId } from "@/lib/operation-log";

export const dynamic = "force-dynamic";

// POST /api/fs/project-gitnexus/clean
// Body: { dirSegments: string[], action: "clean" | "cancel" }
// 行为：清理或取消项目根目录的 GitNexus 任务。不再针对单个仓库。
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const { dirSegments, action } = body;

  if (!dirSegments || !action) {
    return NextResponse.json(
      { error: "dirSegments and action are required" },
      { status: 400 }
    );
  }

  if (action !== "clean" && action !== "cancel") {
    return NextResponse.json(
      { error: "action must be 'clean' or 'cancel'" },
      { status: 400 }
    );
  }

  try {
    const meta = readProjectMeta(dirSegments);
    if (!meta) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Cancel 分支：终止正在运行的任务
    if (action === "cancel") {
      const cancelled = cancelGitNexus("project", dirSegments);
      if (!cancelled) {
        return NextResponse.json(
          { error: "No running task to cancel" },
          { status: 409 }
        );
      }
      logOperation({
        projectId: extractProjectId(dirSegments),
        category: "repository",
        action: "update",
        detail: "GitNexus cancel 项目根",
      });
      return NextResponse.json({ cancelled: true });
    }

    // Clean 分支：清理项目根的 .gitnexus/ 索引
    const result = runGitNexus({
      scope: "project",
      dirSegments,
      command: "clean",
    });

    if (!result.started) {
      if (result.reason === "already_running") {
        return NextResponse.json(
          { error: "Another task is already running" },
          { status: 409 }
        );
      }
      if (result.reason === "path_not_found") {
        return NextResponse.json(
          { error: "Project root directory not found" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: "Failed to start clean" }, { status: 500 });
    }

    logOperation({
      projectId: extractProjectId(dirSegments),
      category: "repository",
      action: "update",
      detail: "GitNexus clean 项目根",
    });

    return NextResponse.json({ started: true, status: result.status });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
