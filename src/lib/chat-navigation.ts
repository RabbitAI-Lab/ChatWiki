/**
 * Chat 导航工具函数。
 * 根据 chat 的 projectId / workspaceId 构建对应的项目/工作区详情页 URL。
 */

export interface GetChatUrlParams {
  chatId: number;
  projectId?: string | null;
  workspaceId?: string | null;
  userId: string;
}

/**
 * 根据 chat 所属的项目/工作区，返回详情页 URL。
 * - 有 projectId → `/project/{projectId}?chatId={chatId}`
 * - 仅 workspaceId → `/workspace/{workspaceId}?chatId={chatId}`
 * - 都没有 → 返回 null（孤立 chat）
 */
export function getChatUrl(params: GetChatUrlParams): string | null {
  const { chatId, projectId, workspaceId, userId: _userId } = params;

  if (projectId) {
    return `/project/${projectId}?chatId=${chatId}`;
  }

  if (workspaceId) {
    return `/workspace/${workspaceId}?chatId=${chatId}`;
  }

  return null;
}
