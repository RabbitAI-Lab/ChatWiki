# Todo 拖拽排序功能

## Context

当前 Todo 列表按 `createdAt desc` 排序，用户无法调整顺序。需要增加拖拽排序能力，让用户可以自由调整待办项的先后顺序。项目中的 `WorkspacesPanel` 和 `ProjectsPanel` 已使用原生 HTML5 Drag & Drop 实现了相同模式的拖拽排序，本方案沿用该模式，不引入新依赖。

## 需要修改的文件

| 文件 | 说明 |
|------|------|
| `src/db/schema.ts` | `todos` 表新增 `sortOrder` 字段 |
| `drizzle/0044_add_sort_order_to_todos.sql` | 新增迁移 SQL |
| `drizzle/meta/_journal.json` | 追加迁移条目 |
| `src/app/api/todos/route.ts` | GET 改排序、POST 自动 sortOrder、PUT 增批量排序 |
| `src/mcp-server/tools/todo.ts` | 同步排序逻辑和创建时 sortOrder |
| `src/app/(app)/todos/page.tsx` | 添加拖拽交互和视觉反馈 |

## Task 1: 数据库 — 新增 sortOrder 字段

**`src/db/schema.ts`** — `todos` 表定义（第 162-171 行）中新增：
```ts
sortOrder: integer("sort_order").notNull().default(0),
```

**`drizzle/0044_add_sort_order_to_todos.sql`** — 新建：
```sql
ALTER TABLE "todos" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;
```

**`drizzle/meta/_journal.json`** — 追加条目 idx=3, tag=`0044_add_sort_order_to_todos`

## Task 2: API 变更

**`src/app/api/todos/route.ts`**：

1. **GET**：`orderBy(desc(todos.createdAt))` → `orderBy(asc(todos.sortOrder), desc(todos.createdAt))`
2. **POST**：创建前查询 `MAX(sortOrder)` 计算 `nextOrder = max + 1`，insert 时带上 `sortOrder`
3. **PUT**：新增 `orders` 批量排序字段支持 — 当 `body.orders` 为数组时，逐条更新 `sortOrder`；当 `completed` 状态变化时，自动计算目标区的 sortOrder

## Task 3: MCP Server 同步

**`src/mcp-server/tools/todo.ts`**：
1. `list_todos`：排序改为 `asc(sortOrder), desc(createdAt)`
2. `create_todo`：创建时计算 `sortOrder`

## Task 4: 前端拖拽交互

**`src/app/(app)/todos/page.tsx`**：

参照 `WorkspacesPanel`（第 39-184 行、第 262-301 行）的原生 HTML5 DnD 实现：

1. **Todo interface** 新增 `sortOrder: number`
2. **DnD 状态**：`dragId`, `dropTargetId`, `dropPosition` 三个 state
3. **拖拽事件**：`handleDragStart`, `handleDragEnd`, `handleDragOver`, `handleDragLeave`, `handleDrop` — Pending 区和 Completed 区各自独立排序
4. **排序持久化**：`handleReorder` 调用 `PUT /api/todos` 传 `{ orders }`
5. **TodoItem** 组件：增加 `draggable`、拖拽事件绑定、拖拽手柄图标、蓝色指示线视觉反馈
6. **列表排序**：`pendingTodos` 和 `completedTodos` 按 `sortOrder` 排序

## 验证方式

1. 运行迁移后确认 `todos` 表有 `sort_order` 列
2. 创建新 Todo，确认 `sortOrder` 递增
3. 在 Pending 区拖拽调整顺序，松手后刷新页面顺序保持
4. 在 Completed 区拖拽调整顺序，松手后刷新页面顺序保持
5. Toggle 完成状态后，确认 item 排到目标区末尾
