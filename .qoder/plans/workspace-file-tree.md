# Workspace 文件树功能

## Context

Workspace 页面目前没有文件树，不能管理文档。需要参考 Project 页面的文件树实现，给 Workspace 添加左侧文件树侧边栏，支持文档的创建/删除/重命名和编辑功能。

Workspace 将拥有独立的 `docs/` 目录（如 `data/personal/default/workspace/{id}/docs/`），与 Project 的文档体系独立。

## 布局变化

```
当前:                              改造后:
┌────────────────────────┐        ┌──────────┬─────────────────────┐
│ Tab Bar (Info | Chat)  │        │ Sidebar  │ Tab Bar             │
├────────────────────────┤   →    │ (240px)  │ (Info|Chat|files)   │
│ Content (full width)   │        │ FileTree ├─────────────────────┤
│                        │        │          │ Content             │
└────────────────────────┘        └──────────┴─────────────────────┘
```

## 实现步骤

### Task 1: 启用 Workspace docs 目录
**文件**: `src/lib/fs/workspace.ts`
- 将 `createDocsDir: false` 改为 `createDocsDir: true`
- 新建 workspace 时自动创建 `docs/` 子目录
- 旧 workspace 无 `docs/` 目录时，`listTree()` 返回空数组（安全）；首次创建文件时 `createDir({ recursive: true })` 自动创建

### Task 2: 创建 Workspace 类型定义
**新建文件**: `src/components/workspace/types.ts`
- 定义 `WORKSPACE_INFO_TAB`、`CHAT_TAB` 常量
- 定义 `FileTab` 接口（与 `project/types.ts` 中的 `FileTab` 相同）

### Task 3: 创建 WorkspaceSidebar 组件
**新建文件**: `src/components/workspace/WorkspaceSidebar.tsx`
- 参照 `src/components/project/ProjectSidebar.tsx`（106行）
- 240px 宽，标题 `{workspaceName} Documents`，Document/Folder 按钮，FileTree 组件
- Props 接口与 ProjectSidebar 基本一致（tree, selectedPath, renaming 状态, CRUD 回调）

### Task 4: 创建 WorkspaceTabBar 组件
**新建文件**: `src/components/workspace/WorkspaceTabBar.tsx`
- 参照 `src/components/project/ProjectTabBar.tsx`（129行）
- 固定标签: "Workspace Info" + "Chat"（含浮动聊天按钮）
- 动态文件标签: 遍历 `FileTab[]`，显示文件名 + 关闭按钮

### Task 5: 创建 WorkspaceEditorArea 组件
**新建文件**: `src/components/workspace/WorkspaceEditorArea.tsx`
- 参照 `src/components/project/ProjectEditorArea.tsx`（175行）
- 三个绝对定位面板:
  - `WORKSPACE_INFO_TAB`: 渲染 `WorkspaceInfoTab`（现有组件）
  - `CHAT_TAB`: 渲染 `ChatWorkspace`（现有组件）
  - 文件标签: 遍历 `tabs`，渲染 `CherryEditor` 或 `HtmlEditor`

### Task 6: 修改 RSC 页面加载文件树
**文件**: `src/app/workspace/[...path]/page.tsx`
- 导入 `listTree`, `stripTreePrefix`, `readDocument`, `TreeNode`
- 构建 `docsDirSegments = [accountType, accountId, "workspace", workspaceId, "docs"]`
- 调用 `listTree(docsDirSegments, [".md", ".html"])` + `stripTreePrefix()`
- 支持 `?file=` 搜索参数预加载文件内容
- 传递新 props 到 `WorkspaceDetail`: `tree`, `docsPath`, `selectedFile`, `initialContent`

### Task 7: 重构 WorkspaceDetail 主控制器
**文件**: `src/components/workspace/WorkspaceDetail.tsx`
- **布局**: 从单列改为 `flex` 左右结构（`<WorkspaceSidebar>` + 右侧内容区）
- **新增状态**: `tree`, `renamingPath/Name`, `tabs`, `contentCache`, `mentionFile`
- **新增处理函数**（移植自 `ProjectWorkspace.tsx`）:
  - 文件树 CRUD: `handleCreateFile`, `handleCreateDir`, `handleRenameConfirm/Cancel/Start`, `handleDeleteDir`, `handleDeleteFile`
  - 标签管理: `handleFileClick`, `handleTabClose`, `handleFileSave`, `handleFileChange`, `handlePreviewHtml`
  - 辅助: `updateTabPaths`
- **渲染结构**:
  ```
  <div className="flex h-full">
    <WorkspaceSidebar ... />
    <div className="flex-1 h-full flex flex-col overflow-hidden">
      <WorkspaceTabBar ... />
      <WorkspaceEditorArea ... />
    </div>
  </div>
  ```

## 无需修改的文件
- 所有 `/api/fs/` API 路由 — 路径无关，可直接工作
- `src/lib/fs/core.ts` — `listTree`, `createDir` 等通用函数
- `src/lib/tree.ts` — 共享树工具函数
- `src/components/ui/FileTree.tsx` — 可复用文件树组件
- 编辑器组件 `CherryEditor`, `HtmlEditor` — 可复用

## 验证方式
1. 访问已有 workspace 页面 → 左侧应显示空文件树
2. 点击 Document 按钮 → 创建新 .md 文件，文件树显示新节点
3. 点击 Folder 按钮 → 创建新目录
4. 点击文件 → 右侧打开文件标签页，编辑器加载内容
5. 重命名文件/目录 → 文件树和标签页同步更新
6. 删除文件 → 标签页自动关闭，文件树更新
7. 切换到 Chat 标签 → 聊天功能正常
8. 新建 workspace → 自动创建 `docs/` 目录
