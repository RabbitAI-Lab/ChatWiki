# ChatWorkspace 重构计划

## Context

`ChatWorkspace.tsx` 当前 **1458 行**，承担了消息流式处理、数据加载、分享管理、导航切换、UI 渲染等全部职责，且 `handleSend` 和 `handleRegenerate` 之间存在 ~150 行 SSE 流式逻辑重复。本次重构将按职责拆分为 **4 个自定义 Hook + 4 个子组件 + 2 个工具模块**，主文件精简至 ~250 行。

**原则**: `ChatWorkspaceProps` 和 `ChatWorkspaceRef` 接口完全不变，所有消费方零修改。

---

## 目标文件结构

```
src/components/chat/
├── chat-workspace-ref.ts        # 类型定义 (~50行)
├── chat-constants.ts            # 纯函数 + 常量 (~90行)
├── useChatSelectors.ts          # 数据加载 + 选择持久化 (~120行)
├── useChatShare.ts              # 分享管理 (~80行)
├── useChatNavigation.ts         # 导航/聊天切换 (~100行)
├── useChatMessages.ts           # 消息状态 + 流式发送 (~320行) [核心去重]
├── ChatBubbleItem.tsx           # ThinkingBlock + bubbleItems 映射 (~120行)
├── ChatInputFooter.tsx          # 输入区底部 3 个 Dropdown (~140行)
├── ChatHeader.tsx               # 头部 UI (~160行)
└── ChatWorkspace.tsx            # 主编排组件 (1458 → ~250行)
```

---

## 执行步骤

### Task 1: 创建 `chat-workspace-ref.ts` — 类型导出

- 将 `Message`、`ChatWorkspaceProps`、`ChatWorkspaceRef` 三个 interface 移入
- 主文件 `ChatWorkspace.tsx` 改为 `import type { ... } from "./chat-workspace-ref"` 并 re-export
- **验证**: 编译通过，所有消费方 import 不变

### Task 2: 创建 `chat-constants.ts` — 纯函数和常量

- 移入: `buildSystemMessage`、`roles`、`switchStyles`、`consumeSseStream`
- 主文件 import 使用
- **验证**: 编译通过，功能不变

### Task 3: 创建 `useChatSelectors.ts` — 数据加载与选择持久化

- 封装: models/projects/workspaces/templates 的 fetch (原 302-349 行)
- 封装: `handleModelChange`、`handleProjectChange`、`handleWorkspaceChange`、`handleTemplateChange` (原 253-298 行)
- 暴露: 状态值 + handlers + setters (供 `useChatNavigation.loadChat` 使用)
- **验证**: 页面加载后底部下拉菜单数据正常、选择可持久化

### Task 4: 创建 `useChatShare.ts` — 分享管理

- 封装: `shareToken`、`shareOpen`、`shareLoading` 状态
- 封装: `handleShare`、`handleCopyLink`、`handleRegenerateLink`、`handleCancelShare` (原 351-417 行)
- 依赖: `effectiveChatId` (从主文件传入)
- **验证**: 分享按钮可用、复制/重新生成/取消正常

### Task 5: 创建 `useChatNavigation.ts` — 导航与聊天切换

- 封装: `loadChat` (原 750-774)、`handleHistorySelect` (原 776-809)、`handleNewChat` 逻辑 (原 720-734)
- 依赖: `effectiveChatId`/`setEffectiveChatId`、`setMessages`、selector setters、`router`
- **验证**: 历史记录选择、新会话按钮跳转正常

### Task 6: 创建 `useChatMessages.ts` — 核心：消息状态 + 流式发送（去重）

- **核心改动**: 提取 `streamAiResponse` 内部函数，统一 `handleSend` 和 `handleRegenerate` 的 SSE 逻辑，消除 ~150 行重复
- 封装: `messages`/`inputValue`/`loading` 状态 + `handleSend` + `handleRegenerate` + `handleCancel` + `handleClear`
- 封装: `mentionedFiles` 状态 + consume effect
- 依赖: selectors 返回值、`effectiveChatId`、`router`、callbacks
- **验证**: 发送消息流式正常、重生成正常、取消正常、消息保存到 DB

### Task 7: 创建 `ChatBubbleItem.tsx` — 消息气泡映射

- 移入: `ThinkingBlock` 组件 (原 140-164)
- 移入: `renderMarkdown` (原 1037-1041)
- 导出 `mapMessagesToBubbleItems()` 函数 (原 1044-1106 的映射逻辑)
- **验证**: 消息气泡展示正常、ThinkingBlock 展开/折叠、操作按钮可用

### Task 8: 创建 `ChatInputFooter.tsx` — 输入区底部下拉菜单

- 封装: Sender footer 中的 3 个 Dropdown + Sender.Switch 组合 (原 1322-1431)
- Props: selectors 返回的状态 + handlers
- **验证**: 底部 3 个下拉菜单功能正常

### Task 9: 创建 `ChatHeader.tsx` — 头部 UI

- 封装: header 区域 JSX (原 1112-1252)
- 包含: title、新会话按钮、Share Popover、ChatHistoryPopover、Clear 按钮
- `floating` 模式下不渲染 (由 FloatingChatWindow 自行管理头部)
- **验证**: header 按钮全部正常、floating 模式不显示 header

### Task 10: 清理主文件 `ChatWorkspace.tsx`

- 主文件仅保留: hooks 调用编排、`useImperativeHandle` 聚合、`handleSaveToDocument` 等少量逻辑、JSX 骨架
- 移除冗余 import
- **验证**: 全量功能回归测试

---

## 关键约束

1. **接口不变**: `ChatWorkspaceProps` + `ChatWorkspaceRef` 保持原样，5 个消费方零修改
2. **不引入 Context**: ChatWorkspace 可能多实例共存 (ChatPageContent 两个分支)，Context 会导致状态串扰
3. **状态共享方式**: 主文件持有核心状态 (`effectiveChatId` 等)，以参数传入各 hook
4. **所有新文件标记 `"use client"`**: 因为都使用了 React hooks 或组件
5. **闭包安全**: `streamAiResponse` 内部通过 `setMessages(prev => ...)` 函数式更新，避免闭包陷阱

---

## 验证方案

每完成一个 Task 后执行:

```bash
npx next build 2>&1 | head -50   # 编译检查
```

功能验证清单:
- [ ] 打开 `/chat/new` → 空状态输入框居中显示
- [ ] 发送消息 → AI 流式回复正常
- [ ] 点击重新生成 → 重生成正常
- [ ] 点击取消 → 中断流式
- [ ] 切换模型/项目/模板 → 下拉菜单正常、选择持久化
- [ ] 点击分享 → Popover 弹出、复制链接/重新生成/取消正常
- [ ] 历史记录 → 选择跳转正常
- [ ] 浮动聊天窗口 → 通过 ref 操作正常
- [ ] 项目详情页嵌入式聊天 → 功能正常
- [ ] 工作区详情页 → showProjectSelector 正常
