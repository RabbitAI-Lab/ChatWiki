# 项目信息子Tab URL同步方案

## Context

ProjectInfoTab 和 WorkspaceInfoTab 内部有多个子Tab（activity、integration、skills、mcp、members、log 等），当前使用 `useState("activity")` 管理状态。用户切换到某个子Tab后刷新页面，会丢失选择回到 activity。需要将子Tab状态同步到URL query参数，使刷新后能恢复。

## 方案

- URL参数: `?tab=mcp`（与已有的 `?file=` 和 `?chatId=` 并列）
- 初始化: RSC page.tsx 读取 searchParams → props 逐层传递 → InfoTab 组件用作 useState 初始值
- 更新: 切换子Tab时用 `window.history.replaceState` 更新URL（不触发服务端请求，不产生历史记录）
- 默认值 `activity` 不出现在URL中，保持URL干净

## 修改文件（共 9 个）

### 1. `src/app/project/[...path]/page.tsx`
- searchParams 类型加 `tab?: string`
- 解析 `tab` 参数，校验是否为合法值，fallback 到 `"activity"`
- 传 `initialSubTab` 给 `<ProjectWorkspace>`

### 2. `src/app/workspace/[...path]/page.tsx`
- 同上逻辑，传 `initialSubTab` 给 `<WorkspaceDetail>`

### 3. `src/components/project/types.ts`
- `ProjectWorkspaceProps` 新增 `initialSubTab?: string`

### 4. `src/components/project/ProjectWorkspace.tsx`
- 解构 `initialSubTab`，透传给 `<ProjectEditorArea>`

### 5. `src/components/project/ProjectEditorArea.tsx`
- `ProjectEditorAreaProps` 新增 `initialSubTab?: string`
- 解构并透传给 `<ProjectInfoTab>`

### 6. `src/components/project/ProjectInfoTab.tsx` (核心)
- Props 新增 `initialSubTab?: string`
- `useState` 初始值从 `"activity"` 改为 `initialSubTab`（校验合法性后）
- 新增 `updateUrlTabParam()` 辅助函数，在 `handleTabChange` 中调用

### 7. `src/components/workspace/WorkspaceDetail.tsx`
- `WorkspaceDetailProps` 新增 `initialSubTab?: string`
- 解构并透传给 `<WorkspaceEditorArea>`

### 8. `src/components/workspace/WorkspaceEditorArea.tsx`
- `WorkspaceEditorAreaProps` 新增 `initialSubTab?: string`
- 解构并透传给 `<WorkspaceInfoTab>`

### 9. `src/components/workspace/WorkspaceInfoTab.tsx` (核心)
- 同 ProjectInfoTab 逻辑

## URL辅助函数（在两个 InfoTab 中）

```typescript
function updateUrlTabParam(tab: string): void {
  const url = new URL(window.location.href);
  if (tab === "activity") {
    url.searchParams.delete("tab");
  } else {
    url.searchParams.set("tab", tab);
  }
  window.history.replaceState(null, "", url.toString());
}
```

## 合法子Tab校验

- Project: `["activity", "integration", "skills", "mcp", "members", "log"]`
- Workspace: `["activity", "projects", "integration", "skills", "mcp", "members", "log"]`

## URL示例

```
/project/abc?tab=mcp
/project/abc?file=README.md&tab=members
/workspace/xyz?chatId=123&tab=log
```

## 验证

1. 访问 `/project/xxx?tab=mcp`，确认页面直接显示 MCP 面板
2. 点击子Tab切换，确认URL更新但无页面刷新
3. 刷新页面，确认停留在当前子Tab
4. 访问 `/project/xxx?tab=invalid`，确认 fallback 到 activity
5. 确认已有的 `?file=` 和 `?chatId=` 参数不受影响
