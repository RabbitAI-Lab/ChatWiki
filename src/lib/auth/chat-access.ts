import { findMemberEntityIds } from "@/lib/fs";

/**
 * 检查用户是否有权访问某个 chat。
 * 有权条件：
 * 1. admin 用户
 * 2. chat 的 userId 匹配当前用户
 * 3. chat 的 userId 为 null（旧数据）
 * 4. chat 关联的项目/工作空间，用户是其成员
 */
export async function canAccessChat(
  auth: { id: string; isAdmin: boolean },
  chat: { userId: string | null; projectId: string | null; workspaceId: string | null }
): Promise<boolean> {
  if (auth.isAdmin) return true;
  if (!chat.userId || chat.userId === auth.id) return true;

  // 检查成员项目/工作空间
  if (chat.projectId) {
    const memberProjectIds = await findMemberEntityIds(auth.id, "projects", ".project.json");
    if (memberProjectIds.includes(chat.projectId)) return true;
  }
  if (chat.workspaceId) {
    const memberWorkspaceIds = await findMemberEntityIds(auth.id, "workspace", ".workspace.json");
    if (memberWorkspaceIds.includes(chat.workspaceId)) return true;
  }

  return false;
}
