# @ 触发文件选择下拉菜单 + 气泡展示方案

## Context

当前聊天输入框通过 FileTree 侧栏按钮触发文件引用（`onMentionFile`），UX 不够直观。需要支持在输入框内通过 `@` 符号触发文件选择下拉菜单，使用 `@ant-design/x` 的 `Suggestion` 组件包裹 `Sender` 实现。同时需要设计 @引用文件在气泡中的展示方式。

## 气泡展示方案

用户消息中的 `@fileName` 模式将被渲染为**内联样式标签（inline chip）**：
- 蓝色背景 + 蓝色文字的小标签，如 `@readme.md`
- 非引用部分继续用 Markdown 渲染
- 使用 `--ant-color-primary-bg` 和 `--ant-color-primary` CSS 变量，自动适配 dark mode

示例效果：用户发送 `@guide.md 帮我修改这篇文档` → 气泡中展示为 `[guide.md 蓝色标签] 帮我修改这篇文档`

## 数据流

```
ChatPageContent (fileTree)
  └─> ChatWorkspace (fileTree prop)
       └─> Suggestion(items=扁平化文件列表)
            └─> Sender (子组件)
                 └─> @ 检测 → onTrigger() → 打开下拉
                 └─> 选择文件 → onSelect() → setMentionedFiles + 清除@文本
```

## 实现步骤

### Task 1: 添加文件树扁平化工具函数
**文件**: `src/lib/tree.ts`

- 新增 `flattenFileNodes(tree: TreeNode[]): Array<{ name: string; path: string }>` 函数
- 递归遍历树，只收集 `type === "file"` 的节点
- 返回 `{ name, path }` 数组

### Task 2: 扩展类型定义
**文件**: `src/components/chat/chat-workspace-ref.ts`

- `ChatWorkspaceProps` 新增 `fileTree?: TreeNode[]` 属性

### Task 3: 传递文件树数据
**文件**: `src/components/chat/ChatPageContent.tsx`

- 在渲染 `ChatWorkspace` 处添加 `fileTree={displayTree}` prop
- `displayTree` 已存在（line 148），根据当前视图模式动态切换

### Task 4: Suggestion 包裹 Sender（核心）
**文件**: `src/components/chat/ChatWorkspace.tsx`

1. 导入 `Suggestion` 和 `FileOutlined` icon
2. 导入 `flattenFileNodes` 工具函数
3. 解构 `fileTree` prop
4. `useMemo` 将文件树转换为 `SuggestionItem[]`：
   ```ts
   items={(info) => {
     const query = atIndexRef.current !== null
       ? inputValue.substring(atIndexRef.current + 1).toLowerCase()
       : '';
     return fileSuggestions.filter(item =>
       item.label.toLowerCase().includes(query) ||
       item.value.toLowerCase().includes(query)
     );
   }}
   ```
5. 用 `<Suggestion>` 包裹 `<Sender>`：
   - `onChange` 中检测 `@` 输入 → 调用 `onTrigger()`
   - `onKeyDown` 中 `open` 为 true 时转发给 `suggestionOnKeyDown(e)`
   - `onSelect` 中添加文件到 `mentionedFiles`，移除输入框中的 `@query` 文本
   - IME 组合期间不触发（检查 `isComposing`）

### Task 5: 气泡中 @引用 展示
**文件**: `src/components/chat/ChatBubbleItem.tsx`

1. 新增 `renderUserMessageWithMentions(content: string)` 函数
   - 用正则 `/@([\w][\w.-]*(?:\/[\w.-]+)*)/g` 解析 `@filePath`
   - 非引用部分用 `XMarkdown` 渲染
   - 引用部分渲染为 styled `<span>` chip
2. 修改 `mapMessagesToBubbleItems`：
   - user 消息不再使用 `contentRender: renderMarkdown`
   - 改为直接渲染 `renderUserMessageWithMentions(msg.content)` 作为 content node

### Task 6: DB 持久化修正
**文件**: `src/components/chat/useChatMessages.ts`

- 将 `processSingleMessage` 中保存到 DB 的内容从 `trimmedContent` 改为 `fullContent`
- 确保 reload 后气泡仍能展示 @引用（正则解析 content 中的 @文件名）

### Task 7: i18n 文案
**文件**: `messages/en.json`, `messages/zh.json`

- 新增 `chat.input.mentionNoFiles` 等提示文案（可选）

## 边界情况

| 场景 | 处理方式 |
|------|---------|
| IME 输入法组合中输入 `@` | 不触发 Suggestion |
| 无项目选中 / fileTree 为空 | 不触发 Suggestion |
| Floating 模式 | `fileTree` 为 undefined，不触发 |
| 多个 `@` 字符 | 以最新 `@` 为触发点 |
| 输入法 composition | 使用 `compositionstart/end` 事件追踪 |
| 页面刷新后 | DB 存储 `fullContent`，正则解析仍可展示 |

## 验证方式

1. 在有项目的聊天页面输入 `@`，验证下拉菜单弹出
2. 输入 `@re` 验证文件名过滤
3. 选择文件后验证 Tag 出现在输入框 header，`@query` 被移除
4. 发送消息后验证气泡中文件名以 chip 样式展示
5. 刷新页面后验证气泡仍展示 @引用 chip
6. 在 floating 模式下验证 `@` 不触发（无文件树）
7. 验证 dark mode 下 chip 颜色正确
