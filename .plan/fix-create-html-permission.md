# 修复 create_html MCP 工具权限被拒绝

## Context

`create_html` / `update_html` / `delete_html` 是 `chatwiki-mcp` MCP 服务器（运行在 4001 端口）提供的 HTML 文档操作工具。Agent SDK 通过全局/项目 MCP 配置连接该服务器后，工具名称格式为 `mcp__chatwiki_mcp__create_html`。

但在 `src/lib/model-service.ts` 中，`allowedTools` 白名单只放行了 `mcp__chatwiki_client__*`，没有包含 `chatwiki-mcp` 的工具，导致 agent 无法调用任何 `chatwiki-mcp` 提供的工具。

## 修复

修改 `src/lib/model-service.ts` 第 236-239 行，在 `allowedTools` 中添加对 ChatWiki MCP 工具的白名单放行。

将：
```typescript
sdkOptions.allowedTools = [
  "mcp__chatwiki_client__*",
  "Read", "Write", "Edit",
  "Glob", "Grep", "WebFetch",
];
```
改为：
```typescript
sdkOptions.allowedTools = [
  "mcp__chatwiki_client__*",
  "mcp__chatwiki_mcp__*",
  "Read", "Write", "Edit",
  "Glob", "Grep", "WebFetch",
];
```

> 注：`chatwiki-mcp` 服务器名中的连字符 `-` 在 SDK 内部会被转换为下划线 `_`，形成 `mcp__chatwiki_mcp__*` 的工具名前缀。

## 关键文件

- `src/lib/model-service.ts` — 第 236-239 行

## 验证

1. 确保 `chatwiki-mcp` 已在管理后台 → MCP 配置中添加（指向 `http://127.0.0.1:4001/mcp`）
2. 启动 dev server，在对话中让 agent 调用 `create_html` 创建 `docs/test.html`
3. 确认 agent 成功创建 HTML 文件，文件树中能看到新文件
