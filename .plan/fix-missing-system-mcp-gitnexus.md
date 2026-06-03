# 修复 MCP 标签页缺少系统 MCP（gitnexus）

## Context

用户反馈：`/admin/mcp` 标签页中没有看到 `zhipu web search` 和 `gitnexus` 两个系统 MCP，期望它们作为系统级 MCP 默认存在。

**根因（已排查确认）**：
- 代码中存在 `SYSTEM_MCP_NAMES = {"gitnexus", "zhipu-web-search-sse"}` 硬编码白名单（[src/components/mcp/types.ts:29-32](file:///Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki/src/components/mcp/types.ts)）
- 但该白名单**仅用于项目/工作区 MCP 面板的 UI 锁禁用**（禁用删除按钮，[src/components/mcp/mcp-list-item.tsx:54, 109-132](file:///Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki/src/components/mcp/mcp-list-item.tsx)）
- `mcp_config` 表是**单行 JSON 配置表**，从未被 seed 初始化为包含系统 MCP
- `src/db/seed.ts` 历史以来只 seed accounts/templates/systemPrompts，从未碰过 mcp_config
- 迁移 [drizzle/0008_add_mcp_config.sql](file:///Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki/drizzle/0008_add_mcp_config.sql) 仅 INSERT `'{}'`
- 一次性脚本 [scripts/add-gitnexus-to-project.ts](file:///Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki/scripts/add-gitnexus-to-project.ts) 硬编码项目 ID 注入到指定项目的 `.mcp.json`，不属于通用方案
- 数据库当前值（已确认）：`{"chatwiki": {"type": "http", "url": "http://127.0.0.1:4001/mcp"}}`

**用户已确认的决策**：
- 运行时初始化（seed.ts）— 不使用 drizzle migration
- **只初始化 gitnexus**（zhipu 因需要 API key，保留让用户手动添加）
- admin UI 保持现状（纯 JSON 编辑器，不改造为结构化列表）

## Approach

在 [src/db/seed.ts](file:///Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki/src/db/seed.ts) 的 `seed()` 函数末尾追加一段逻辑：**检查并合并系统 MCP 到 `mcp_config` 单行记录**。

注入条目（与既有 `add-gitnexus-to-project.ts:23-27` 的 GITNEXUS_ENTRY 保持一致）：
```ts
{
  type: "stdio",
  command: "npx",
  args: ["-y", "gitnexus@latest", "mcp"],
}
```

**幂等性约束**：
- 若 `mcp_config` 行不存在 → 创建并写入 `{ gitnexus: {...} }`
- 若存在但 `configJson` 是 `{}` 或不含 `gitnexus` 键 → 合并注入（保留其他用户配置）
- 若已存在 `gitnexus` 键 → 跳过（不覆盖用户可能的自定义）
- 不删除或重写任何其他键（保留 `chatwiki` 等用户已添加的 server）

## 关键文件

- [src/db/seed.ts](file:///Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki/src/db/seed.ts) — 在末尾（约 L215 `console.log("[seed] Done.");` 之前）追加系统 MCP 合并逻辑
- 需新增 import：`mcpConfig` from `./schema`
- 参考已有 schema：[src/db/schema.ts:85-91](file:///Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki/src/db/schema.ts)

## 执行步骤

1. 编辑 [src/db/seed.ts](file:///Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki/src/db/seed.ts)：
   - L2 导入补充：`import { accounts, templates, systemPrompts, mcpConfig } from "./schema"`
   - 在 `systemPrompts` 块之后、`console.log("[seed] Done.");` 之前追加新块
2. 新块逻辑：
   - `db.select().from(mcpConfig).get()` 读取单行
   - 解析 `configJson`（容错：解析失败则按 `{}` 处理）
   - 检查是否已含 `gitnexus` 键
   - 若无，合并注入条目后 `db.update(mcpConfig).set({ configJson, updatedAt: now })`
   - 打印对应日志（merged / skipped / created）

## 验证

1. **DB 验证**：
   ```bash
   sqlite3 data.db "SELECT config_json FROM mcp_config;"
   ```
   期望：
   ```
   {
     "chatwiki": {
       "type": "http",
       "url": "http://127.0.0.1:4001/mcp"
     },
     "gitnexus": {
       "type": "stdio",
       "command": "npx",
       "args": ["-y", "gitnexus@latest", "mcp"]
     }
   }
   ```

2. **API 验证**：
   ```bash
   curl http://localhost:3000/api/mcp-config
   ```
   返回的 `configJson` 应包含 `gitnexus` 键。

3. **UI 验证**：浏览器打开 `http://localhost:3000/admin/mcp`，TextArea 内容应同时含 `chatwiki` 和 `gitnexus` 两个条目。

4. **幂等性验证**：再次重启服务，DB 中 `gitnexus` 键值不变（不重复添加、不覆盖用户改动）。

5. **聊天端到端**（可选）：新建一个 chat 发送消息，Claude Agent SDK 应能加载 `mcp__gitnexus__*` 工具（终端日志 `[AgentSDK] mcpServers:` 应打印 `chatwiki, gitnexus, chatwiki_client`）。

## 风险与注意

- `seed()` 在 [src/db/index.ts:160](file:///Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki/src/db/index.ts) 每次 Node 进程启动时执行；新增的合并块需保持幂等
- `npx -y gitnexus@latest` 首次运行会下载包，可能耗时
- 若运行环境无 npx / Node.js，gitnexus 启动会失败（chatwiki 不受影响）
- 现有 chatwiki 条目不受影响
