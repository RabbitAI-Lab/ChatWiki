# Todo List 功能实施计划

## Context

用户需要在左侧菜单新增一个 "Todo" 菜单项（位于 Chats 上方），实现一个简单的待办事项管理功能。待办和已完成分开展示，每个 item 有标题、描述、勾选框和删除按钮。

## 需要修改/新增的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/db/schema.ts` | 修改 | 新增 `todos` 表定义 |
| `drizzle/0022_add_todos.sql` | 新增 | 数据库迁移 SQL |
| `src/app/api/todos/route.ts` | 新增 | API 路由（GET/POST/PUT/DELETE） |
| `src/app/todos/page.tsx` | 新增 | Todo 页面（Client Component） |
| `src/components/layout/Sidebar.tsx` | 修改 | 新增 Todo NavLink（Chats 上方） |

## Task 1: 数据库 — 新增 todos 表

**`src/db/schema.ts`** — 在文件末尾追加：

```ts
export const todos = sqliteTable("todos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  completed: integer("completed").notNull().default(0),  // 0=待办, 1=已完成
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
```

**`drizzle/0022_add_todos.sql`** — 迁移文件：

```sql
CREATE TABLE `todos` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `title` text NOT NULL, `description` text NOT NULL DEFAULT '', `completed` integer NOT NULL DEFAULT 0, `created_at` text NOT NULL, `updated_at` text NOT NULL);
```

## Task 2: API 路由

**`src/app/api/todos/route.ts`**：

- `GET` — 查询所有 todos，按 createdAt desc 排序
- `POST` — 新建 todo（body: `{ title, description }`），校验 title 必填且≤100字，description≤100字
- `PUT` — 更新 todo（body: `{ id, title?, description?, completed? }`），用于勾选切换和编辑
- `DELETE` — 删除 todo（body: `{ id }`）

## Task 3: 页面组件

**`src/app/todos/page.tsx`** — Client Component（参考 chats/page.tsx 模式）：

布局结构：
```
<div className="h-full flex flex-col p-6">
  {/* 顶栏：标题 + Add Todo 按钮 */}
  <div className="flex items-center justify-between mb-6">
    <h1>Todo</h1>
    <button>+ Add Todo</button>
  </div>

  <div className="flex-1 overflow-y-auto">
    {/* Pending Section */}
    <section>
      <h2>Pending</h2>
      {pendingTodos.map(todo => <TodoItem />)}
    </section>

    {/* Completed Section */}
    <section>
      <h2>Completed</h2>
      {completedTodos.map(todo => <TodoItem />)}
    </section>
  </div>
</div>
```

每个 TodoItem：
- 左侧 Checkbox（自定义 SVG，点击切换完成状态）
- 中间：标题（粗体）+ 描述（灰色小字）
- 右侧：删除图标按钮（仅图标，参考 chats 页面的删除确认弹窗模式）

添加按钮弹出内联表单（非 Modal），输入标题和描述后提交。

UI 文本全部英文，遵循编码规范。

## Task 4: 侧边栏菜单

**`src/components/layout/Sidebar.tsx`** — 在 NewChatButton 之后、Chats NavLink 之前插入：

```tsx
<div className="px-2 mb-1">
  <NavLink
    href="/todos"
    icon={
      <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    }
  >
    Todo
  </NavLink>
</div>
```

图标使用蓝色（`text-blue-400`），与 Chats/Templates 一致。

## 验证方式

1. 启动开发服务器 `npm run dev`
2. 检查数据库迁移是否自动执行（查看控制台日志 `✓ 0022_add_todos.sql`）
3. 点击侧边栏 Todo 菜单，验证路由跳转到 `/todos`
4. 测试添加待办（标题+描述）、勾选完成、删除操作
5. 验证空状态显示正常
