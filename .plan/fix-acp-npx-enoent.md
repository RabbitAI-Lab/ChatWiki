# 修复 ACP spawn npx ENOENT 错误

## Context

ACP 模式调用时，`spawn("npx", ...)` 抛出 `ENOENT` 错误，表示 Next.js 服务进程的 `PATH` 中找不到 `npx` 命令。日志证据：

```
[ACP Pool] spawned agent: ... pid=undefined model=glm-5.1
[ACP Pool] agent error: ... error=spawn npx ENOENT
```

虽然用户终端中 `npx` 可用（`/Users/xujialiang/.nvm/versions/node/v24.12.0/bin/npx`），但 Next.js 16 + Turbopack 环境下 `process.env.PATH` 可能不包含 nvm 的 bin 目录，导致子进程 spawn 失败。

## 修复方案

在 `acp-pool.ts` 中，将硬编码的 `"npx"` 替换为动态解析的绝对路径，使用 `process.execPath`（即当前 Node.js 二进制路径）推导出同目录下的 `npx`。

### Task 1: 修改 `src/lib/acp-pool.ts`

在文件顶部添加一个辅助常量，基于当前 Node.js 可执行文件路径推导 npx 绝对路径：

```typescript
import * as path from "node:path";

const NPX_BIN = path.join(path.dirname(process.execPath), "npx");
```

将 `createEntry` 函数中的 spawn 调用（第 188 行）：

```typescript
const child = spawn("npx", ["-y", "@agentclientprotocol/claude-agent-acp"], {
```

改为：

```typescript
const child = spawn(NPX_BIN, ["-y", "@agentclientprotocol/claude-agent-acp"], {
```

### Task 2: 增强错误诊断日志

在 spawn 前添加一条日志，打印实际使用的 npx 路径：

```typescript
console.log(`[ACP Pool] using npx: ${NPX_BIN}`);
```

## 涉及文件

- `src/lib/acp-pool.ts` — 唯一需要修改的文件

## 验证

1. 重启 `pnpm dev`
2. 发送一条聊天消息，观察日志中 `[ACP Pool] spawned agent` 的 pid 不再是 `undefined`
3. 确认不再出现 `spawn npx ENOENT` 错误
