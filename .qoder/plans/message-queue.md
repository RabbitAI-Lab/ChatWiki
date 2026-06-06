# 聊天消息队列实现计划

## Context

当前聊天组件在 AI 响应期间（`loading=true`）会阻止发送新消息。用户希望改为排队机制：等待期间的待发送消息进入队列，上一条消息响应完成后自动发送队列中的下一条，直到队列清空。

## 需要修改的文件

| 文件 | 修改内容 |
|------|---------|
| `src/components/chat/useChatMessages.ts` | 核心：新增队列状态、拆分 handleSend 为入队+处理两层、暴露 queueSize |
| `src/components/chat/ChatWorkspace.tsx` | 中等：添加 onKeyDown 拦截 + 队列指示器 UI |
| `messages/zh.json` | 新增 queue 相关 i18n |
| `messages/en.json` | 新增 queue 相关 i18n |

## 核心设计

### 1. `useChatMessages.ts` 改造

**新增状态/类型：**
```ts
interface QueuedMessage {
  content: string;
  mentionedFiles: string[];
}
```

- `queueRef: useRef<QueuedMessage[]>` — 消息队列（ref 避免重渲染）
- `queueSize: useState<number>` — 驱动 UI 更新
- `isProcessingRef: useRef<boolean>` — 是否正在处理
- `messagesRef: useRef<Message[]>` — 消息最新值（解决闭包陈旧值问题）
- `effectiveChatIdRef: useRef<number | null>` — chatId 最新值

**拆分 handleSend 为两层：**

1. **`handleSend`（入队判断层）**：
   - 如果 `isProcessingRef.current === true`：消息入队，捕获 mentionedFiles 快照
   - 否则：设 `isProcessingRef=true`、`setLoading(true)`，调用 `processSingleMessage`

2. **`processSingleMessage`（实际发送层）**：
   - 包含原 handleSend 的全部核心逻辑
   - 使用 `messagesRef.current` 和 `effectiveChatIdRef.current` 读取最新值
   - 完成后调用 `drainQueue()`

3. **`drainQueue()`**：
   - 从队列 shift 一条消息，通过 `queueMicrotask()` 调用 `processSingleMessage`
   - 队列为空时：`isProcessingRef=false`、`setLoading(false)`

**其他函数修改：**
- `handleCancel`：增加清空队列 + 重置 `isProcessingRef`
- `handleRegenerate`：检查 `isProcessingRef.current` 阻止冲突
- `handleClear`：调用 `clearQueue()` 清空队列

### 2. `ChatWorkspace.tsx` 改造

**关键问题：`@ant-design/x` Sender 组件在 `loading=true` 时内部阻止 `onSubmit` 调用。**

**解决方案：利用 Sender 的 `onKeyDown` 拦截**

TextArea 内部逻辑：先调用 `onKeyDown`，如果返回 `false` 则跳过后续 submit。我们可以传入自定义 `onKeyDown`：

```tsx
<Sender
  value={messagesApi.inputValue}
  onChange={messagesApi.setInputValue}
  onSubmit={messagesApi.handleSend}
  loading={messagesApi.loading}
  onCancel={messagesApi.handleCancel}
  onKeyDown={(e) => {
    // loading 时拦截 Enter 键，手动触发入队
    if (
      messagesApi.loading &&
      e.key === 'Enter' &&
      !e.shiftKey &&
      !(e.ctrlKey || e.altKey || e.metaKey) &&
      !e.nativeEvent.isComposing &&
      messagesApi.inputValue.trim()
    ) {
      messagesApi.handleSend(messagesApi.inputValue);
      return false;
    }
  }}
  ...
/>
```

**队列指示器**（在 Sender 上方）：
- 当 `queueSize > 0` 时显示蓝色提示条
- 包含排队数量和取消按钮（取消当前请求并清空队列）

### 3. i18n 新增

`zh.json` 和 `en.json` 的 `chat` 对象内：
```json
"queue": {
  "pending": "{count} 条消息等待发送中..."
}
```

## 关键边界情况

| 场景 | 处理方式 |
|------|---------|
| 新聊天第一条消息创建 chat，后续队列消息复用 chatId | `effectiveChatIdRef` 同步更新 |
| 队列消息需要包含前面消息的 AI 回复作为上下文 | `messagesRef` 读取最新值 |
| 用户快速连续发送 10+ 条 | 全部入队，queueMicrotask 逐条处理 |
| AI 响应错误（isError=true） | 队列继续处理，isError 消息在上下文构建时被过滤 |
| 用户取消 | 中止请求 + 清空队列 + 重置状态 |
| 组件卸载时队列未清空 | 清空队列，中止请求 |

## 验证方式

1. 发送消息 A → AI 响应中 → 发送 B、C → 验证 B、C 入队并依次自动发送
2. 发送消息 A → AI 响应中 → 发送 B → 取消 → 验证 B 被清除
3. 新聊天发送 A → 队列中发 B → 验证 B 使用同一 chatId 且上下文包含 A 的回复
4. AI 响应错误后 → 队列中下一条消息 → 验证正常继续
