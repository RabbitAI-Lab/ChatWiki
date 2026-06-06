# /chats 页面改造计划

## Context

/chats 页面表格需要优化：添加创建人/修改人列、合并项目和工作空间为一列（icon区分）、Title 固定宽度。

**关键发现**：`chats.updatedBy` 字段已存在（migration 0039），且已在消息创建和聊天更新时正确写入。项目/工作空间页面已有成熟的 `aliasedTable(users, "modifier_user")` JOIN 模式可直接复用。**无需任何数据库变更。**

## 变更文件

| 文件 | 操作 |
|------|------|
| `messages/zh.json` | 新增 3 个 i18n key |
| `messages/en.json` | 新增 3 个 i18n key |
| `src/app/api/chats/route.ts` | GET 查询增加 JOIN users 获取 creatorName/modifierName |
| `src/app/chats/page.tsx` | 主要前端改动 |

## 步骤

### 1. i18n - 在 settings namespace 的 chatsPage 相关区域新增 key

**`messages/zh.json`** (settings namespace 内，约 1293 行附近):
- 新增 `"columnLocation": "位置"`
- 新增 `"columnCreator": "创建人"`
- 新增 `"columnModifier": "修改人"`
- 保留 `columnProject`/`columnWorkspace`（其他页面可能引用）

**`messages/en.json`** (同位置):
- 新增 `"columnLocation": "Location"`
- 新增 `"columnCreator": "Creator"`
- 新增 `"columnModifier": "Modifier"`

### 2. API - 修改 GET /api/chats (`src/app/api/chats/route.ts`)

- 导入 `users` from `@/db/schema`，导入 `aliasedTable` from `drizzle-orm/sqlite-core`
- 在 rows 查询中添加 `creatorName: users.name` 和 `modifierName: modifierUser.name`
- 添加 `.leftJoin(users, eq(chats.userId, users.id))` 和 `.leftJoin(modifierUser, eq(chats.updatedBy, modifierUser.id))`
- 参考模式来自 `src/app/project/[...path]/page.tsx` 第 88-100 行

### 3. 前端 - 修改 `src/app/chats/page.tsx`

**3a. 更新 Chat interface**：添加 `creatorName: string | null` 和 `modifierName: string | null`

**3b. 合并 Project/Workspace 为一列 "Location"**：
- 删除原来分开的 Project(w-56) 和 Workspace(w-48) 两列
- 新建一列 Location (w-48)，逻辑：
  - `projectId` 存在 → 显示文件夹 SVG icon + projectMap 中的名称
  - 仅 `workspaceId` 存在 → 显示层叠方块 SVG icon + workspaceMap 中的名称
  - 都没有 → "-"
- 列头使用 `ts('columnLocation')`

**3c. Title 列固定宽度**：
- 表头 `<th>` 添加 `w-[300px]`
- 单元格 `<td>` 添加 `w-[300px]`，内部 span 添加 `truncate block`

**3d. 新增 Creator 和 Modifier 列** (各 w-28)：
- 插入在 Title 和 Location 之间
- 使用 `ts('columnCreator')` 和 `ts('columnModifier')`
- null 时显示灰色 "-"

**最终列布局** (从左到右)：
| 列 | 宽度 |
|----|------|
| Title | `w-[300px]` (固定) |
| Location | `w-48` |
| Creator | `w-28` |
| Modifier | `w-28` |
| Model | `w-36` |
| Template | `w-36` |
| Created | `w-44` |
| Updated | `w-44` |
| Delete | `w-12` |

## 验证

1. 启动开发服务器，访问 `/chats` 页面
2. 确认创建人/修改人列正确显示用户名
3. 确认 Location 列用不同 icon 区分 project 和 workspace
4. 确认 Title 列固定 300px 宽度，长标题被 truncate
5. 确认旧数据（updatedBy 为 null）的修改人列显示 "-"
