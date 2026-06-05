import { readWorkspaceMeta, listWorkspaceProjects, listTree, stripTreePrefix, readDocument } from "@/lib/fs";
import { db } from "@/db";
import { chats, documentActivities } from "@/db/schema";
import { gte, desc, eq, and, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/tokens";
import WorkspaceDetail from "@/components/workspace/WorkspaceDetail";
import { getRecentCutoff } from "@/lib/time";

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ chatId?: string; file?: string }>;
}) {
  const { path: rawPath } = await params;
  const { chatId: chatIdParam, file: rawFile } = await searchParams;
  const urlPath = rawPath.map(decodeURIComponent);

  // 验证用户身份（从 cookie 获取 access token）
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  let currentUserId: string | null = null;
  if (accessToken) {
    const payload = await verifyToken(accessToken);
    if (payload && payload.type === "access") {
      currentUserId = payload.sub;
    }
  }
  void currentUserId; // reserved for future workspace-level access control

  // urlPath = ["personal", "{accountId}", "{workspaceId}"]
  if (urlPath.length < 3) notFound();

  const accountType = urlPath[0];
  const accountId = urlPath[1];
  const workspaceId = urlPath[2];

  // Build FS path: ["personal", "default", "workspace", "{workspaceId}"]
  const workspaceDirSegments = [accountType, accountId, "workspace", workspaceId];

  const workspaceMeta = readWorkspaceMeta(workspaceDirSegments);
  if (!workspaceMeta) notFound();

  const linkedProjects = listWorkspaceProjects(
    accountType as "personal" | "enterprise",
    accountId,
    workspaceId,
  );

  const projectIds = linkedProjects.map((p) => p.id);

  // Build docs path for workspace file tree
  const docsDirSegments = [...workspaceDirSegments, "docs"];
  const docsPrefix = docsDirSegments.join("/");
  const rawTree = listTree(docsDirSegments, [".md", ".html"]);
  const tree = stripTreePrefix(rawTree, docsPrefix);

  // Get selected file content (only when explicitly requested via ?file=)
  let selectedFile: string | null = null;
  let fileContent: string | null = null;

  if (rawFile) {
    selectedFile = decodeURIComponent(rawFile);
    const fileSegments = [...workspaceDirSegments, "docs", ...selectedFile.split("/")];
    fileContent = readDocument(...fileSegments);
  }

  // 预取最近 20 天的聊天（跟着 workspace 走：所有成员可见）
  const twentyDaysAgo = getRecentCutoff();

  const chatConditions = [
    eq(chats.workspaceId, workspaceId),
    gte(chats.updatedAt, twentyDaysAgo),
  ];

  const recentChats = db
    .select({
      id: chats.id,
      title: chats.title,
      updatedAt: chats.updatedAt,
      projectId: chats.projectId,
    })
    .from(chats)
    .where(and(...chatConditions))
    .orderBy(desc(chats.updatedAt))
    .all();

  // 预取最近 20 天的文档活动（聚合 workspace 下所有 linked projects）
  const recentDocuments =
    projectIds.length === 0
      ? []
      : db
          .select()
          .from(documentActivities)
          .where(
            and(
              inArray(documentActivities.projectId, projectIds),
              gte(documentActivities.createdAt, twentyDaysAgo),
            ),
          )
          .orderBy(desc(documentActivities.createdAt))
          .limit(20)
          .all();

  return (
    <WorkspaceDetail
      workspaceMeta={workspaceMeta}
      linkedProjects={linkedProjects}
      recentChats={recentChats}
      recentDocuments={recentDocuments}
      accountType={accountType}
      accountId={accountId}
      initialChatId={chatIdParam ? parseInt(chatIdParam) : undefined}
      tree={tree}
      docsPath={docsPrefix}
      selectedFile={selectedFile}
      initialContent={fileContent || ""}
    />
  );
}
