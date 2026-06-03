# ProjectWorkspace.tsx 组件拆分重构计划

## Context

`ProjectWorkspace.tsx` 是项目文档编辑器的核心组件（730行），承担了文件树管理、Tab 系统、聊天集成、编辑器渲染等多个职责。文件过大，可读性和可维护性差。此外还存在 `insertNode` 函数重复定义、`accountInfo` prop 未使用、类型定义分散等问题。

本计划将 730 行的主组件拆分为 4 个文件 + 1 个类型文件，每个组件单一职责，主组件仅作为协调器。

## 拆分方案

### 新建文件

```
src/components/project/
├── types.ts                     (~50行) 共享类型
├── ProjectSidebar.tsx           (~70行) 左侧文件树侧边栏
├── ProjectTabBar.tsx            (~110行) 顶部标签栏
├── ProjectEditorArea.tsx        (~120行) 编辑器内容区
└── ProjectWorkspace.tsx         (~200行) 主协调器（精简后）
```

### 1. 创建 `types.ts` — 共享类型

将分散在 `ProjectWorkspace.tsx` 和 `ProjectInfoTab.tsx` 中的重复类型集中管理：

- `FileTab` — 文件标签页
- `ProjectMeta` — 项目元数据（合并两处定义，包含 `sandbox?`、`members?` 字段）
- `AccountInfo` — 账户信息
- `RecentChat` — 最近聊天
- `ProjectWorkspaceProps` — 主组件 Props（对外接口不变）
- `CHAT_TAB = "__chat__"` 常量

### 2. 创建 `ProjectSidebar.tsx` — 左侧边栏

提取原文件 L463-521 的侧边栏 JSX，纯 UI 组件：

- 标题栏（`{projectName} Documents`）
- Document / Folder 新建按钮
- `<FileTree>` 组件

所有行为通过 props 回调传入（onCreateFile、onCreateDir、onFileClick、onMentionFile 等）。

### 3. 创建 `ProjectTabBar.tsx` — 顶部标签栏

提取原文件 L526-623 的标签栏 JSX，纯 UI 组件：

- Project Info 固定标签
- Chat 固定标签（含浮动聊天按钮）
- 文件标签列表（含类型图标 + 关闭按钮）

### 4. 创建 `ProjectEditorArea.tsx` — 编辑器内容区

提取原文件 L625-714 的内容区 JSX：

- ProjectInfoTab 渲染区域
- ChatWorkspace 渲染区域
- 文件编辑器标签页（CherryEditor / HtmlEditor / 加载中）
- `dynamic import`（CherryEditor、HtmlEditor）放在此组件中

### 5. 精简 `ProjectWorkspace.tsx` — 主协调器

重构后仅保留：
- **状态声明**：文件树状态、Tab 系统状态、聊天状态
- **回调函数**：所有 useCallback（状态之间有耦合，保留在主组件）
- **精简 JSX**：组合 `<ProjectSidebar>` + `<ProjectTabBar>` + `<ProjectEditorArea>`

### 6. 同步修改 `ProjectInfoTab.tsx`

删除本地 `ProjectMeta` 和 `RecentChat` 定义，改为 `import { ProjectMeta, RecentChat } from "./types"`。

## 清理项

| 项目 | 处理 |
|------|------|
| `insertNode` 重复定义 (L718-730) | 删除，改为 `import { insertNode } from "@/lib/tree"` |
| `accountInfo` prop 未使用 | 保留在 Props 类型中（向后兼容），标记 `@deprecated` |
| `"__chat__"` 魔法字符串 | 提升为 `CHAT_TAB` 常量，放在 `types.ts` |

## 对外影响

- `src/app/project/[...path]/page.tsx` — **无需修改**，import 路径和 Props 签名不变
- `src/components/project/ProjectInfoTab.tsx` — 仅修改类型 import 来源

## 验证步骤

1. `npm run build` 确认编译通过
2. 访问 `/project/personal/default/projects/{projectId}` 确认页面正常渲染
3. 测试文件树操作：新建文件/文件夹、重命名、删除
4. 测试 Tab 系统：打开文件标签、切换标签、关闭标签
5. 测试聊天功能：切换到 Chat 标签、提及文件、浮动聊天
6. 测试编辑器：Markdown 编辑器保存、HTML 编辑器保存
