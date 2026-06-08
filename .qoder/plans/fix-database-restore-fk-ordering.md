# 修复数据库恢复的外键顺序问题

## Context

数据库恢复功能（Admin > Database > Restore）按**字母序**处理表。由于外键约束，引用 `users` 的表（`api_keys`、`cli_authorization_codes`、`cli_tokens`、`email_verifications`、`invite_codes`、`orders`、`passkeys`、`refunds`、`user_subscriptions`）排在 `users` 之前，INSERT 时 FK 检查失败（源系统的 user_id 在目标 users 表中不存在）。错误被 catch 后跳过整个表，导致这些表数据丢失。

同时，恢复操作没有事务保护——中途失败会留下不一致的数据库状态（部分表已清空但未插入新数据）。

## 修改文件

### 1. `src/lib/db-dump.ts` — 核心修复

**新增**：拓扑排序常量 `RESTORE_INSERT_ORDER`

```
Level 0（无FK）: accounts, enterprises, plans, users, chats, model_configs, mcp_config, sandbox_config, storage_config, templates, system_prompts, system_settings, shared_html_files, operation_logs, document_activities, todos, token_usage_logs, entities, entity_members, entity_repositories, notification_jobs
Level 1（FK→Level 0）: organisations→enterprises, chat_messages→chats, shared_chats→chats, invite_codes→users, email_verifications→users, passkeys→users, cli_authorization_codes→users, cli_tokens→users, api_keys→users, user_model_configs→users, orders→users+plans, user_subscriptions→users+plans
Level 2（FK→Level 1）: refunds→orders+users
```

**新增**：`getOrderedTables()` 函数，将 dump 中的表按拓扑序排列，未知表追加到末尾兜底

**重写**：`restoreFromJson()`
- 用 `client.transaction()` 包裹全部操作
- Phase 1：DELETE 用**逆拓扑序**（先删 Level 2 → Level 1 → Level 0），避免 NO ACTION FK 阻塞
- Phase 2：INSERT 用**正拓扑序**（先插 Level 0 → Level 1 → Level 2），确保被引用行先存在
- 事务失败时整体回滚，返回 `rolledBack: true`

**扩展**：`RestoreResult` 增加 `rolledBack?: boolean` 字段

### 2. `src/app/api/auth/admin/database/restore/route.ts` — 增强错误响应

- 事务回滚时返回 `{ success: false, status: 500 }` 而非 `success: true`
- 区分完全失败（回滚）和部分警告

### 3. `src/components/admin/DatabasePageClient.tsx` — 前端错误展示

- 恢复失败时用 `modal.error()` 展示详细错误（而非 `message.error()` 一行提示）
- 恢复成功后提示用户重新登录（session 可能已失效）

### 4. `src/app/api/auth/admin/database/reset-password/route.ts` — 新增密码重置 API

- `POST /api/auth/admin/database/reset-password`
- 接收 `{ userId, newPassword }`
- 需要 `requireAdmin` 认证
- 用 `hashPassword(newPassword)` 更新 users 表

### 5. `messages/zh.json` + `messages/en.json` — 新增 i18n key

- 密码重置相关文案
- 恢复错误详情文案

## 验证方法

1. 启动开发服务器，在 Admin > Database 页面导出 JSON 备份
2. 修改一些数据（创建新用户、聊天等）
3. 恢复之前导出的备份
4. 验证所有表数据正确恢复（特别是 users、api_keys、invite_codes）
5. 用源系统的凭据登录，验证密码正确
6. 测试恢复失败场景（如上传损坏的 dump），验证事务回滚
