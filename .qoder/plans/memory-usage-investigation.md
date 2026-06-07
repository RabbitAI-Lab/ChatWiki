# 内存持续增长（内存泄漏）排查报告

## Context

项目 Next.js 16 + Turbopack 启动后不仅初始内存占用高（5GB），而且**内存还在持续增长**。这表明不只是静态的内存占用问题，还存在运行时的内存泄漏。以下是排查发现的几个运行时内存泄漏点。

## 排查发现：内存泄漏根因

### 1. SSE 流未监听客户端断开信号（最严重的泄漏）

**文件**: `src/app/api/chat/completions/route.ts`

```typescript
const stream = new ReadableStream({
  async pull(controller) {
    // ... for await 循环消费 generator
    // ❌ 没有检查 req.signal（AbortSignal）
  },
});
```

**问题**: `ReadableStream` 的 `pull()` 中没有检查 `req.signal`。当用户关闭浏览器标签、网络断开或前端主动中止 fetch 请求时：
- Node.js 的 `Request.signal` 会触发 `abort` 事件
- 但 `for await (const event of generator)` 循环**不会中断**
- generator 内部（SDK 直调模式）的 `query()` 调用或（ACP 模式）`drainEvents()` 会**持续运行直到完成**
- 完整的模型响应（可能数百 KB 到数 MB）会被全部生成并缓存在内存中，但**永远不会被消费**

**影响**: 每次用户中断一个请求，就会泄漏一个完整的模型响应 + generator 上下文。如果模型使用了 Extended Thinking，泄漏量更大。

**修复方案**: 在 `pull()` 中监听 `req.signal` 并在 abort 时关闭 generator。

### 2. ACP 连接池 `stderrBuf` 无限增长

**文件**: `src/lib/acp-pool.ts` 第 234-241 行

```typescript
let stderrBuf = "";
child.stderr?.on("data", (chunk: Buffer | string) => {
  stderrBuf += typeof chunk === "string" ? chunk : chunk.toString("utf8");
  // ...
});
```

**问题**: `stderrBuf` 在 `createEntry()` 中声明为闭包变量，持续追加 Agent 子进程的 stderr 输出。只要子进程存活，`stderrBuf` 就会**无限增长**。Agent 子进程可能在 5 分钟空闲超时后才被回收，期间 stderr 可能积累大量日志。

**影响**: 取决于 Agent 子进程的 stderr 输出量，每个连接可能积累数 MB 到数十 MB。

### 3. GitNexus 子进程 `stdoutBuf` / `stderrBuf` 无限增长

**文件**: `src/lib/gitnexus-service.ts` 第 140-149 行

```typescript
let stdoutBuf = "";
let stderrBuf = "";
child.stdout?.on("data", (chunk) => { stdoutBuf += ...; });
child.stderr?.on("data", (chunk) => { stderrBuf += ...; });
```

**问题**: 与 ACP 连接池类似，`stdoutBuf` 和 `stderrBuf` 在子进程运行期间无限增长。虽然 GitNexus 有 5 分钟超时，但如果分析大型项目，stdout/stderr 可能积累到非常大的量。

### 4. `toolCallInputCache` 模块级全局 Map 潜在泄漏

**文件**: `src/lib/acp-event-mapper.ts` 第 17 行

```typescript
const toolCallInputCache = new Map<string, Record<string, unknown>>();
```

**问题**: 这个缓存只在 `tool_call_update` 的 `completed` 状态时清理对应条目。如果 Agent 进程异常退出或工具调用被中断，对应的 `toolCallId` 条目**永远不会被清理**，导致 Map 持续增长。

**影响**: 每个条目通常较小（文件路径等），但长时间运行后会积累。

### 5. ACP `eventQueue` 在异常退出时未清理

**文件**: `src/lib/acp-client.ts` 第 32 行

```typescript
private eventQueue: StreamEvent[] = [];
```

**问题**: 如果 `drainEvents()` 的消费者（SSE 流）在 `promptDone=false` 时被中断（由于第 1 点的 abort 信号未处理），`eventQueue` 中的事件将永远不会被消费。虽然 `resetForNewPrompt()` 会清空队列，但如果连接被异常回收，可能跳过重置步骤。

### 6. Claude Agent SDK `query()` 的资源泄漏

**文件**: `src/lib/model-service.ts` 第 347 行

```typescript
q = query({ prompt, options: sdkOptions });
```

**问题**: SDK 直调模式下，`query()` 返回一个 AsyncIterable，内部会 spawn 子进程或建立 HTTP 连接。当外层 SSE 流被 abort 时（第 1 点），如果没有显式调用 `q.close()`，SDK 的内部资源（子进程、连接）可能不会被及时清理，持续占用内存直到 GC 回收。

## 优化计划

### Task 1: SSE 流增加 abort 信号处理（最高优先级）

**文件**: `src/app/api/chat/completions/route.ts`

在 `ReadableStream` 的 `pull()` 中添加 `req.signal` 监听：
- 当 `req.signal` 触发 abort 时，调用 `controller.error()` 终止流
- SDK 直调模式：调用 `q.close()` 关闭 SDK 连接
- ACP 模式：调用 `entry.clientRef.markPromptDone()` 通知事件队列结束

### Task 2: 限制 ACP stderrBuf 大小

**文件**: `src/lib/acp-pool.ts`

- 为 `stderrBuf` 添加最大长度限制（如 100KB）
- 超出时丢弃旧数据，只保留最新的 tail 部分
- 或使用环形缓冲区

### Task 3: 限制 GitNexus stdoutBuf/stderrBuf 大小

**文件**: `src/lib/gitnexus-service.ts`

- 同上，添加最大长度限制
- 反正退出时只打印 tail 2000 字符，没必要保留全部

### Task 4: toolCallInputCache 添加过期清理

**文件**: `src/lib/acp-event-mapper.ts`

- 添加 LRU 或定期清理逻辑
- 或在 ACP 连接关闭时清理所有缓存

## 验证方法

1. 用 `NODE_OPTIONS='--max-old-space-size=4096' npx next dev` 限制内存
2. 用 `ps aux | grep node` 定期观察 RSS 内存
3. 用 `NODE_OPTIONS='--inspect'` + Chrome DevTools Memory 面板拍 Heap Snapshot 对比
4. 模拟客户端断开：发起一个 chat 请求，然后立即关闭浏览器标签，观察内存是否释放
