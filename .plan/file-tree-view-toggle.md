# 文件树 Footer：文档/工作区视图切换

## Context

当前所有文件树（工作区页面、项目页面、聊天页面）都只显示 `docs/` 目录下的 `.md` 和 `.html` 文件。用户需要在文件树底部增加一个切换 Footer，可以在「文档」视图（仅 docs 目录）和「工作区」视图（完整根目录）之间切换。

## 实现方案

### Phase 1: 基础设施

#### 1.1 修改 `listTree` 支持全文件类型 — `src/lib/fs/core.ts`
- 当 `exts` 为空数组时，接受所有文件（跳过隐藏目录如 `.git`、`.gitnexus`）
- 添加隐藏目录排除逻辑（以 `.` 开头的目录和 `node_modules`）

#### 1.2 扩展树 API — `src/app/api/fs/tree/route.ts`
- 新增 `all` 查询参数，当 `all=true` 时传入空 exts 数组（返回所有文件）
- 保持默认行为不变（只返回 `.md` 和 `.html`）

#### 1.3 新增 i18n 键 — `messages/zh.json` + `messages/en.json`
- 在 `common` 命名空间下添加：
  - `"docsView": "文档"` / `"Documents"`
  - `"workspaceView": "工作区"` / `"Workspace"`

#### 1.4 创建 `FileTreeFooter` 组件 — `src/components/ui/FileTreeFooter.tsx`
- Props: `activeView: "docs" | "workspace"`, `onViewChange: (view) => void`
- 两个等宽按钮，当前激活的高亮显示（蓝色），非激活灰色
- 固定在 sidebar 底部，border-top 分隔，高度约 32px

### Phase 2: 工作区页面 (Workspace)

#### 2.1 服务端 — `src/app/workspace/[...path]/page.tsx`
- 新增 `listTree(workspaceDirSegments, [])` 获取根目录全量树
- `stripTreePrefix` 处理后作为 `rootTree` prop 传给 `WorkspaceDetail`

#### 2.2 客户端 — `src/components/workspace/WorkspaceDetail.tsx`
- 新增 prop: `rootTree: TreeNode[]`
- 新增状态: `const [treeView, setTreeView] = useState<"docs" | "workspace">("docs")`
- 传递给 `WorkspaceSidebar`: `rootTree`, `activeView={treeView}`, `onViewChange={setTreeView}`

#### 2.3 侧边栏 — `src/components/workspace/WorkspaceSidebar.tsx`
- 新增 props: `rootTree`, `activeView`, `onViewChange`
- 根据 `activeView` 选择显示 `tree`（docs）或 `rootTree`（workspace）
- 在 `FileTree` 下方渲染 `FileTreeFooter`

### Phase 3: 项目页面 (Project)

#### 3.1 服务端 — `src/app/project/[...path]/page.tsx`
- 新增 `listTree(projectDirSegments, [])` 获取根目录全量树
- 作为 `rootTree` prop 传给 `ProjectWorkspace`

#### 3.2 客户端 — `src/components/project/ProjectWorkspace.tsx`
- 新增 prop: `rootTree: TreeNode[]`
- 新增状态: `treeView`
- 传递给 `ProjectSidebar`

#### 3.3 侧边栏 — `src/components/project/ProjectSidebar.tsx`
- 同 WorkspaceSidebar 的变更模式

### Phase 4: 聊天页面 (Chat)

#### 4.1 Hook 扩展 — `src/components/chat/useProjectFileTree.ts`
- 新增 `rootTree` 状态和 `refreshRootTree` 方法
- `refreshRootTree` 调用 `/api/fs/tree?path=projects/{pid}&all=true`

#### 4.2 ChatPageContent — `src/components/chat/ChatPageContent.tsx`
- 新增状态: `treeView`
- 切换到 workspace 视图时调用 `refreshRootTree`（懒加载）
- 在文件树下方渲染 `FileTreeFooter`

#### 4.3 NewChatWorkspace — `src/components/chat/NewChatWorkspace.tsx`
- 同 ChatPageContent 的变更模式

### 工作区视图的文件交互行为
- `.md` / `.html` 文件：正常打开编辑器
- 其他文件类型：仅展示文件树结构，点击不打开编辑器
- 创建/删除/重命名操作：工作区视图下使用根目录路径

## 修改文件清单

| 文件 | 操作 |
|------|------|
| `src/lib/fs/core.ts` | 修改 |
| `src/app/api/fs/tree/route.ts` | 修改 |
| `src/components/ui/FileTreeFooter.tsx` | **新建** |
| `messages/zh.json` | 修改 |
| `messages/en.json` | 修改 |
| `src/app/workspace/[...path]/page.tsx` | 修改 |
| `src/components/workspace/WorkspaceDetail.tsx` | 修改 |
| `src/components/workspace/WorkspaceSidebar.tsx` | 修改 |
| `src/app/project/[...path]/page.tsx` | 修改 |
| `src/components/project/ProjectWorkspace.tsx` | 修改 |
| `src/components/project/ProjectSidebar.tsx` | 修改 |
| `src/components/chat/useProjectFileTree.ts` | 修改 |
| `src/components/chat/ChatPageContent.tsx` | 修改 |
| `src/components/chat/NewChatWorkspace.tsx` | 修改 |

## 验证方式
1. 启动开发服务器 `pnpm dev`
2. 访问工作区页面，确认文件树底部出现 Footer，可切换「文档/工作区」
3. 切换到「工作区」后确认显示根目录所有文件（排除隐藏目录）
4. 切回「文档」确认恢复为 docs 目录
5. 在项目页面和聊天页面重复验证
6. 确认切换时文件交互（点击、新建、删除）正常工作
