# Write 工具 .md 文件路径约束 Hook

## Context

当前 Agent SDK 的 `Write` 工具可以写入任何项目内的文件。用户希望添加一个约束：当写入 `.md` 文件时，必须写入到 `docs/` 目录下，否则拒绝操作并返回提示信息，引导 Agent 将文件放到正确的位置。

## 实现方案

在 `model-service.ts` 的 `canUseTool` 回调中添加 `.md` 文件路径校验逻辑。`canUseTool` 是 Agent SDK 提供的运行时门控回调，可以在工具执行前拦截并决定允许/拒绝。

### 修改文件

**`src/lib/model-service.ts`** — `canUseTool` 回调（第 157-179 行）

在现有的路径校验逻辑中，增加对 `Write` 工具写入 `.md` 文件的 `docs/` 目录约束：

```typescript
canUseTool: async (toolName, input) => {
  // 允许所有 MCP 工具
  if (toolName.startsWith("mcp__")) {
    return { behavior: "allow" };
  }

  // ===== 新增：Write .md 文件必须写入 docs/ 目录 =====
  if (toolName === "Write") {
    const filePath = (input as Record<string, unknown>).file_path as string | undefined;
    if (filePath && filePath.endsWith(".md")) {
      const resolved = path.resolve(cwd, filePath);
      const docsDir = path.resolve(cwd, "docs");
      if (!resolved.startsWith(docsDir + path.sep)) {
        return {
          behavior: "deny",
          message: "Markdown (.md) files must be written to the docs/ directory. Please adjust the file path to be under docs/.",
        };
      }
    }
  }

  // 对文件操作做路径校验（原有逻辑）
  const filePath = (input as Record<string, unknown>).file_path as string | undefined
    || (input as Record<string, unknown>).path as string | undefined;
  if (filePath) {
    const resolved = path.resolve(cwd, filePath);
    if (!resolved.startsWith(cwd)) {
      return { behavior: "deny", message: `路径超出项目范围: ${filePath}` };
    }
  }
  // 拦截 Bash 命令中的路径逃逸（原有逻辑）
  if (toolName === "Bash") {
    const command = (input as Record<string, unknown>).command as string | undefined;
    if (command && /(\.\.\/|\/etc\/|\/home\/|\/Users\/)/.test(command) && !command.includes(cwd)) {
      return { behavior: "deny", message: `Bash 命令包含项目外路径` };
    }
  }
  return { behavior: "allow" };
},
```

### 逻辑说明

1. 当 `toolName === "Write"` 时，检查 `file_path` 参数
2. 如果文件以 `.md` 结尾，将路径 resolve 到 cwd 下
3. 检查 resolved 路径是否以 `docs/` 开头（使用 `path.sep` 确保跨平台兼容）
4. 如果不在 `docs/` 下，返回 `{ behavior: "deny", message: "..." }`
5. Agent 收到拒绝消息后会自动调整路径重试

### 边界情况处理

- `docs/readme.md` → 允许
- `docs/sub/nested.md` → 允许（子目录也在 docs/ 下）
- `readme.md` → 拒绝
- `notes/test.md` → 拒绝
- `docs/style.css` → 不受约束（非 .md 文件）
- `Edit` 工具编辑 .md 文件 → 不受约束（仅限制 Write）

## 验证方式

1. 启动开发服务器：`npm run dev`
2. 在聊天中请求 Agent 创建一个 `.md` 文件（如"帮我写一个 readme.md"）
3. 预期：Agent 第一次尝试写入非 `docs/` 路径时被拒绝，随后自动将文件写入 `docs/` 目录
4. 请求 Agent 创建非 `.md` 文件（如 `test.txt`）→ 应正常写入，不受约束
