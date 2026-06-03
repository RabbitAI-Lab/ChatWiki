# 修复：系统提示词未注入到 Chat 的 SDK systemPrompt 中

## Context

`/admin/system-prompts` 配置的全局系统提示词已启用，但未作为系统级指令注入到模型的 system prompt 中。当前代码将系统提示词嵌入到用户 prompt 文本中（`[System Instructions]: ...`），而非通过 Claude Agent SDK 的 `systemPrompt` 选项传递。SDK 使用默认的 Claude Code 系统提示词，全局系统提示词被降级为用户级文本，导致模型可能不遵循。

## 问题根因

`src/lib/model-service.ts` 第 74-88 行将系统消息（包含全局系统提示词）以 `[System Instructions]:` 文本前缀形式嵌入到 `prompt` 参数中。而 `query({ prompt, options: sdkOptions })` 中 `sdkOptions` 未设置 `systemPrompt`，SDK 使用默认系统提示词，全局系统提示词被当作用户消息处理。

SDK 的 `Options.systemPrompt` 支持：
- `string` — 完全自定义
- `{ type: 'preset', preset: 'claude_code', append: string }` — 保留默认 + 追加

## 修复方案

仅修改 `src/lib/model-service.ts`，提取系统消息内容，通过 SDK `systemPrompt` 选项传递。

### 修改文件

**`src/lib/model-service.ts`**

1. **提取系统消息**：从 `messages[0]` 提取系统消息内容，作为 SDK 的 `systemPrompt` 的 `append` 部分
2. **设置 SDK systemPrompt**：使用 `{ type: 'preset', preset: 'claude_code', append: systemContent }`
3. **精简 prompt 文本**：prompt 仅包含用户/助手对话历史，不再嵌入 `[System Instructions]:`
4. **修复调试日志**：让日志正确反映系统提示词的实际状态

### 具体改动

```typescript
// === 修改前 (L74-88) ===
const promptParts: string[] = [];
const hasSystemMessage = messages.length > 0 && messages[0].role === "system";
if (hasSystemMessage) {
  promptParts.push(`[System Instructions]: ${messages[0].content}\n\n`);
} else if (options?.systemPrompt) {
  promptParts.push(`[System Instructions]: ${options.systemPrompt}\n\n`);
}
const chatMessages = hasSystemMessage ? messages.slice(1) : messages;
for (const msg of chatMessages) {
  const label = msg.role === "user" ? "用户" : "助手";
  promptParts.push(`[${label}]: ${msg.content}`);
}
const prompt = promptParts.join("\n\n");

// === 修改后 ===
// Extract system message content for SDK systemPrompt
const hasSystemMessage = messages.length > 0 && messages[0].role === "system";
const systemContent = hasSystemMessage
  ? messages[0].content
  : options?.systemPrompt || undefined;

// Set SDK systemPrompt: keep Claude Code default + append our instructions
if (systemContent) {
  sdkOptions.systemPrompt = {
    type: 'preset',
    preset: 'claude_code',
    append: systemContent,
  };
}

// Build prompt from chat messages only (user/assistant)
const chatMessages = hasSystemMessage ? messages.slice(1) : messages;
const promptParts: string[] = [];
for (const msg of chatMessages) {
  const label = msg.role === "user" ? "用户" : "助手";
  promptParts.push(`[${label}]: ${msg.content}`);
}
const prompt = promptParts.join("\n\n");
```

日志也需更新：

```typescript
// 修改前 (L231)
console.log("[AgentSDK] systemPrompt:", options?.systemPrompt ? `(length: ${options.systemPrompt.length})` : "(none)");

// 修改后
console.log("[AgentSDK] systemPrompt:", systemContent ? `(length: ${systemContent.length})` : "(none)");
```

## 验证方式

1. 启动开发服务器 `npm run dev`
2. 在 `/admin/system-prompts` 确保有启用的系统提示词
3. 在 Chat 中发送消息，查看终端日志：
   - `[AgentSDK] systemPrompt:` 应显示 `(length: N)` 而非 `(none)`
4. 验证模型行为是否遵循系统提示词中的指令
