# 修复 ACP Write 被拒时缺少 docs/ 目录提示

## Context

当 ACP agent 尝试通过 Write 工具写入 `.md` 文件到非 `docs/` 目录时，当前在 `acp-client.ts` 的 `requestPermission` 层直接选择 `reject`，ACP SDK 将此转换为固定的 `"User refused permission to run tool"` 错误消息。

而 `model-service.ts` 中的 **PreToolUse hook** 已经实现了正确的拦截逻辑，会返回 `reason: "Markdown (.md) files must be written to the docs/ directory..."`。但 `requestPermission` 在 ACP 协议层**先于** PreToolUse hook 执行，导致 hook 的友好提示永远无法传递给 agent。

## Task 1: 移除 `requestPermission` 中的 `.md` 路径拦截

**文件**: `src/lib/acp-client.ts`

将第 71-88 行的 `.md` 文件路径校验逻辑从 `requestPermission` 中移除，让所有 Write 请求自动通过 `allow`，由 `model-service.ts` 中的 PreToolUse hook（第 182-203 行）统一负责路径校验并返回有意义的错误信息。

修改后 `requestPermission` 方法简化为：

```typescript
async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
  const toolTitle = params.toolCall?.title ?? "(no title)";
  console.log("[ACP Client] requestPermission:", toolTitle);

  // 所有权限请求自动批准 allow，路径校验由 PreToolUse hook 统一处理
  const allowOption = params.options?.find(o => o.optionId === "allow");
  if (allowOption) {
    return {
      outcome: { outcome: "selected", optionId: allowOption.optionId },
    } as RequestPermissionResponse;
  }
  if (params.options && params.options.length > 0) {
    return {
      outcome: { outcome: "selected", optionId: params.options[0].optionId },
    } as RequestPermissionResponse;
  }
  return {
    outcome: { outcome: "selected" },
  } as RequestPermissionResponse;
}
```

同时移除不再需要的 `import * as path from "node:path"` 导入（如果没有其他地方使用）。

## 验证

1. 启动开发服务器
2. 在 Chat 中让 agent 尝试 Write 一个 `.md` 文件到非 `docs/` 目录（如 `test.md`）
3. 确认 agent 收到的错误消息包含 "Markdown (.md) files must be written to the docs/ directory" 而不是 "User refused permission to run tool"
4. 确认 Write 到 `docs/` 目录下的 `.md` 文件仍然正常工作
