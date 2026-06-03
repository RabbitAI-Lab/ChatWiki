/** 固定标签 ID：Workspace 信息页 */
export const WORKSPACE_INFO_TAB = "__workspace_info__" as const;

/** 固定标签 ID：聊天页 */
export const CHAT_TAB = "__chat__" as const;

/** 文件标签页 */
export interface FileTab {
  filePath: string;
  content: string;
  loaded: boolean;
  type: "markdown" | "html";
}
