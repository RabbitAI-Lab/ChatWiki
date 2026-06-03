# ChatPageContent.tsx 重构计划

## Context

`ChatPageContent.tsx` (714行) 是一个 "God Component"，管理 20+ state 变量，职责涵盖聊天切换、文件树 CRUD、文件标签页系统、Tab 渲染和项目上下文。

**关键发现**: `src/components/chat/` 目录下已有三个自定义 Hook (`useChatSwitching`, `useFileTabSystem`, `useProjectFileTree`)，且 `NewChatWorkspace.tsx` 已经在使用它们。但 `ChatPageContent` 没有使用，而是手动管理所有状态。

**目标**: 让 `ChatPageContent` 与 `NewChatWorkspace` 采用相同的 Hook 组合模式，将 714 行缩减至 ~250 行。

---

## 涉及文件

**新建**:
- `src/components/chat/TabButton.tsx` — 通用 Tab 按钮（消除 4+ 处重复 JSX）
- `src/components/chat/FileTreeToolbar.tsx` — 文件树工具栏（创建文件/文件夹按钮）
- `src/components/chat/EditorTabContent.tsx` — 编辑器 Tab 内容（CherryEditor + loading）

**修改**:
- `src/components/chat/useChatSwitching.ts` — 添加 projectId/router 支持
- `src/components/chat/useFileTabSystem.ts` — 添加 closeFallbackTab 选项
- `src/components/chat/useProjectFileTree.ts` — 添加 initialTree + onFileCreated
- `src/components/chat/ChatPageContent.tsx` — 主要重构目标

**不变**:
- `src/app/chat/[chatId]/page.tsx` — Props 接口完全不变

---

## Task 1: 创建子组件

### TabButton.tsx

提取重复的 Tab 按钮模式（当前出现 4+ 次）：

```tsx
interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  suffix?: React.ReactNode;
}
```

### FileTreeToolbar.tsx

提取文件树工具栏（Document / Folder 创建按钮 + SVG 图标）：

```tsx
interface FileTreeToolbarProps {
  onCreateFile: () => void;
  onCreateDir: () => void;
  disabled: boolean;
}
```

### EditorTabContent.tsx

提取编辑器 Tab 面板（CherryEditor 加载/渲染逻辑）：

```tsx
interface EditorTabContentProps {
  filePath: string;
  loaded: boolean;
  content: string;
  onChange: (markdown: string) => void;
  onSave: () => void;
}
```

---

## Task 2: 修改 Hooks（向后兼容）

### useChatSwitching.ts

- 扩展 options 接口，增加可选字段：`projectId`, `router`, `onNewChatNavigate`
- `handleSwitchToChat` 添加跨项目导航检查（先 fetch chat 获取 projectId，不同则 `router.push`）
- `handleNewChat` 支持外部导航回调（ChatPageContent 用 `router.push("/chat/new")`）
- 添加 `init()` 方法接受初始值（chatId, messages, modelId 等）
- 所有新字段可选，不影响 NewChatWorkspace 的现有调用

### useFileTabSystem.ts

- 添加可选 `closeFallbackTab` 参数（默认 `PROJECT_INFO_TAB`）
- ChatPageContent 的无项目模式传 `CHAT_TAB` 作为 fallback
- 修复 `handleFileClick` 中硬编码路径为使用 `projectPath` 参数

### useProjectFileTree.ts

- 添加可选 `initialTree` 参数（默认 `[]`）
- 添加可选 `onFileCreated` 回调（创建文件后通知调用方打开 tab + 填充缓存）

---

## Task 3: 重构 ChatPageContent.tsx

将组件替换为 Hook 组合 + JSX 渲染的协调器模式：

1. **删除** 本地 `insertNode` 函数（已从 `@/lib/tree` 导入）
2. **删除** 本地 `Message`/`FileTab`/`RecentChat` 类型定义（从 hooks 导入）
3. **组合三个 Hook**:
   - `tabSystem = useFileTabSystem({ projectId, projectPath, closeFallbackTab: CHAT_TAB })`
   - `fileTree = useProjectFileTree({ ..., initialTree, onFileCreated })`
   - `chatSwitching = useChatSwitching({ projectId, router, onNewChatNavigate })`
4. **调用 `chatSwitching.init()`** 初始化服务器 props
5. **桥接回调**: handleToolCall, handleNavigateToDocument, mentionFile 逻辑
6. **使用子组件**: TabButton, FileTreeToolbar, EditorTabContent 替换内联 JSX
7. **修复**: `alert()` → `message.warning()`，中文 → 英文

---

## Task 4: 验证

- `npm run build` 编译通过
- 手动测试场景：
  - 无项目聊天（无文件树面板）
  - 有项目聊天（左侧文件树 + 右侧 Tab 系统）
  - 文件 Tab 打开/关闭/保存
  - 文件树 创建/重命名/删除
  - 同项目聊天切换（客户端快速切换）
  - 跨项目聊天切换（全页面导航）
  - Mention 文件功能（浮动聊天窗 + 内嵌聊天窗）
