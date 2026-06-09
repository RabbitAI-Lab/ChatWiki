# 数据按用户隔离方案

## Context

当前系统已实现多用户认证（JWT + users 表），但所有业务数据没有按用户隔离。两个不同账号登录后看到完全相同的数据。

**根本原因：**
1. **文件系统**：所有用户的 projects/workspaces 存储在同一个路径 `data/personal/default/` 下。前端和 API 路由中 `accountId` 全部硬编码为 `"default"`（约 50+ 处）。
2. **数据库**：`chats`、`chatMessages`、`todos`、`modelConfigs`、`templates` 等表没有 `userId` 列，所有用户共享同一份数据。
3. **API 路由**：后端查询不按用户过滤，部分路由甚至缺少认证。

## 方案概要

将 `accountId` 从硬编码的 `"default"` 改为使用当前登录用户的 `user.id`，同时为数据库表添加 `userId` 列并过滤数据。分两阶段实施：

- **阶段 1**：文件系统隔离（核心问题，前端 + API 路由）
- **阶段 2**：数据库隔离（chats、todos、templates、modelConfigs）

---

## 阶段 1：文件系统隔离

### 核心思路

将所有 `accountId = "default"` 改为 `accountId = user.id`，使文件系统路径从 `data/personal/default/projects/` 变为 `data/personal/{userId}/projects/`。

### 1.1 后端 API 路由 — 使用 `auth.id` 替代默认值

在 `/api/fs/*` 路由中，将 `accountId` 默认值从 `"default"` 改为 `auth.id`：

**文件清单：**

| 文件 | 修改内容 |
|------|----------|
| `src/app/api/fs/projects/route.ts` | GET: `searchParams.get("accountId") \|\| auth.id`; POST/DELETE/PATCH/PUT: 从 body 取 `accountId`，默认 `auth.id` |
| `src/app/api/fs/workspaces/route.ts` | 同上 |
| `src/app/api/fs/workspaces/projects/route.ts` | 同上 |
| `src/app/api/chat/completions/route.ts` | 第30行 `"personal", "default"` → `"personal", auth.id` |
| `src/app/api/fs/directory/route.ts` | 路径 segments 中验证用户归属 |
| `src/app/api/fs/document/route.ts` | 验证文档路径中的用户归属 |
| `src/app/api/fs/documents/route.ts` | 验证路径中的用户归属 |
| `src/app/api/fs/tree/route.ts` | 验证路径中的用户归属 |
| `src/app/api/fs/project-*` (6个文件) | 验证 `dirSegments` 中的用户归属 |
| `src/app/api/fs/workspace-*` (6个文件) | 验证 `dirSegments` 中的用户归属 |

**后端统一改造模式：**

```typescript
// 之前
const accountId = searchParams.get("accountId") || "default";

// 之后
const accountId = searchParams.get("accountId") || auth.id;
```

### 1.2 前端组件 — 使用 `user.id` 替代硬编码

**文件清单（约 15 个文件，50+ 处修改）：**

| 文件 | 硬编码位置 | 修改方式 |
|------|-----------|----------|
| `src/components/layout/ProjectsPanel.tsx` | 第46/76/89/148行 `accountId=default` | `accountId=${user.id}` |
| `src/components/layout/WorkspacesPanel.tsx` | 第47/77/90/159行 `accountId=default` | `accountId=${user.id}` |
| `src/components/layout/TemplatesPanel.tsx` | 第23/32行 `accountId=default` | `accountId=${user.id}` |
| `src/components/layout/ChatsHistoryPanel.tsx` | 第148行 `personal/default/` | `personal/${user.id}/` |
| `src/components/chat/ChatPageContent.tsx` | 第91/314行 `personal/default/` | `personal/${user.id}/` |
| `src/components/chat/NewChatWorkspace.tsx` | 第50/121/380行 `personal/default/` | `personal/${user.id}/` |
| `src/components/chat/SaveToDocumentModal.tsx` | 第65/112/287行 `personal/default/` | `personal/${user.id}/` |
| `src/components/chat/useProjectFileTree.ts` | 第39行 `personal/default/` | `personal/${user.id}/` |
| `src/components/chat/useChatNavigation.ts` | 第89/91/118行 `personal/default/` | `personal/${user.id}/` |
| `src/app/chats/page.tsx` | 第46/55/180行 `accountId=default`, `personal/default/` | 使用 `user.id` |

**前端统一改造模式：**

```typescript
const { user } = useAuth();

// 之前
authFetch("/api/fs/projects?type=personal&accountId=default")

// 之后
authFetch(`/api/fs/projects?type=personal&accountId=${user.id}`)
```

对于路径字符串中的硬编码：

```typescript
// 之前
`/workspace/personal/default/${workspaceId}`
`personal/default/projects/${projectId}/docs`

// 之后
`/workspace/personal/${user.id}/${workspaceId}`
`personal/${user.id}/projects/${projectId}/docs`
```

### 1.3 其他后端硬编码

| 文件 | 修改 |
|------|------|
| `src/lib/model-service.ts` 第222行 | `["personal", "default", ...]` → `["personal", userId, ...]` |
| `src/mcp-server/tools/project.ts` | `accountId` 默认值改为动态获取 |

### 1.4 数据迁移

创建脚本 `scripts/migrate-user-directories.ts`：
- 扫描 `data/personal/default/` 目录
- 找到 `users` 表中第一个 admin 用户
- 将 `data/personal/default/` 重命名为 `data/personal/{adminUserId}/`
- 对于后续新注册用户，首次访问时自动创建空目录（`listProjects` 已自动处理目录不存在返回空数组的情况）

---

## 阶段 2：数据库隔离

### 2.1 Schema 变更

在 `src/db/schema.ts` 中添加 `userId` 字段：

| 表 | 添加字段 | 说明 |
|----|---------|------|
| `chats` | `userId: text("user_id")` nullable | nullable 兼容旧数据 |
| `todos` | `userId: text("user_id")` not null default "" | |
| `templates` | `userId: text("user_id")` nullable | 系统模板(userId=null)共享，用户模板隔离 |
| `modelConfigs` | `userId: text("user_id")` nullable | 全局模型(userId=null)共享，用户模型隔离 |
| `sharedHtmlFiles` | `userId: text("user_id")` nullable | |
| `operationLogs` | `userId: text("user_id")` nullable | |
| `documentActivities` | `userId: text("user_id")` nullable | |

`chatMessages` 和 `sharedChats` 不需要加 `userId`，通过 `chatId -> chats.userId` 间接隔离。

### 2.2 迁移文件 `drizzle/0031_add_user_isolation.sql`

```sql
ALTER TABLE chats ADD COLUMN user_id TEXT;
ALTER TABLE todos ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE templates ADD COLUMN user_id TEXT;
ALTER TABLE model_configs ADD COLUMN user_id TEXT;
ALTER TABLE shared_html_files ADD COLUMN user_id TEXT;
ALTER TABLE operation_logs ADD COLUMN user_id TEXT;
ALTER TABLE document_activities ADD COLUMN user_id TEXT;

CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_todos_user_id ON todos(user_id);
```

### 2.3 回填脚本

创建 `scripts/backfill-user-id.ts`：
- 查找 admin 用户
- `UPDATE chats SET user_id = {adminId} WHERE user_id IS NULL`
- `UPDATE todos SET user_id = {adminId} WHERE user_id = ''`
- `UPDATE model_configs SET user_id = {adminId} WHERE user_id IS NULL`
- `UPDATE templates SET user_id = {adminId} WHERE user_id IS NULL AND is_system = 0`
- 系统模板 (`is_system = 1`) 保持 `user_id = NULL`

### 2.4 API 路由过滤

**chats 相关（4个文件）：**
- `GET /api/chats` → 添加 `WHERE user_id = auth.id`
- `POST /api/chats` → 写入 `userId: auth.id`
- `GET/PATCH/DELETE /api/chats/[chatId]` → 校验 `chat.userId === auth.id`
- `GET /api/chats/[chatId]/messages` → 先校验 chat 所有权
- Share 相关路由 → 先校验 chat 所有权

**todos（1个文件）：**
- `GET` → `WHERE user_id = auth.id`
- `POST` → `userId: auth.id`
- `PUT/DELETE` → 校验 `userId === auth.id`

**templates（2个文件）：**
- `GET` → 返回 `isSystem = 1 OR userId = auth.id`
- `POST` → `userId: auth.id`
- `PATCH/DELETE` → 校验 `userId === auth.id`

**models（2个文件）：**
- `GET` → 返回 `userId IS NULL OR userId = auth.id`
- `POST` → `userId: auth.id`
- `PATCH/DELETE` → 仅操作 `userId = auth.id` 的记录

### 2.5 紧急安全修复（可合并到阶段 2）

为缺少认证的路由添加 `requireAuth`：
- `GET/DELETE /api/chats/[chatId]`
- `GET /api/chats/[chatId]/messages`
- `GET/DELETE /api/models/[id]`
- Share 相关路由

---

## 验证方案

1. **文件系统隔离验证**
   - 用用户 A 登录，创建一个项目，确认目录在 `data/personal/{userA.id}/projects/`
   - 用用户 B 登录，确认看不到用户 A 的项目
   - 用用户 B 创建项目，确认在 `data/personal/{userB.id}/projects/`

2. **数据库隔离验证**
   - 用用户 A 创建 chat、todo、template
   - 用用户 B 登录，确认看不到用户 A 的数据
   - 确认系统模板和全局模型对两个用户都可见

3. **回归测试**
   - 现有功能（chat、workspace、project CRUD）正常工作
   - 模型配置、系统提示词管理正常
   - 文件上传、文档编辑正常

## 实施顺序

建议先做 **阶段 1**（文件系统隔离），因为这是用户最直观感受到的问题（projects/workspaces 共享），且改动相对集中。阶段 2（数据库隔离）影响面更广但紧迫性稍低。

每个阶段完成后独立部署验证。
