# Admin Plans (套餐配置) 实现方案

## Context

系统管理后台需要新增套餐（Plans）配置功能，支持管理订阅套餐的标题、定价（月付/年付）、折扣（百分比/固定价）、功能点（名称+状态）等。管理员可以在后台 CRUD 套餐，并通过启用/禁用开关和排序控制展示。

---

## 需要修改/创建的文件

| 操作 | 文件路径 |
|------|----------|
| 修改 | `src/db/schema.ts` — 追加 `plans` 表定义 |
| 创建 | `drizzle/0028_add_plans.sql` — 建表迁移 |
| 创建 | `src/app/api/plans/route.ts` — GET 列表 + POST 创建 |
| 创建 | `src/app/api/plans/[id]/route.ts` — PATCH 更新 + DELETE 删除 |
| 创建 | `src/app/admin/plans/page.tsx` — 服务端页面 |
| 创建 | `src/components/admin/PlansPageClient.tsx` — 客户端 CRUD UI |
| 修改 | `src/components/admin/AdminSidebar.tsx` — 添加导航项 |

---

## Task 1: 数据库 Schema + 迁移

### Schema 定义（追加到 `src/db/schema.ts` 末尾）

```ts
// plans: 套餐计划
export const plans = sqliteTable("plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  monthlyPrice: integer("monthly_price").notNull().default(0),   // 月付价格（分）
  yearlyPrice: integer("yearly_price").notNull().default(0),     // 年付价格（分）
  discountType: text("discount_type", { enum: ["none", "percentage", "fixed"] }).notNull().default("none"),
  discountValue: integer("discount_value").notNull().default(0), // percentage: 85=8.5折; fixed: 分
  features: text("features").notNull().default("[]"),            // JSON: [{name, included}]
  enabled: integer("enabled").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
```

### 迁移 SQL（`drizzle/0028_add_plans.sql`）

```sql
CREATE TABLE `plans` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `monthly_price` integer DEFAULT 0 NOT NULL,
  `yearly_price` integer DEFAULT 0 NOT NULL,
  `discount_type` text DEFAULT 'none' NOT NULL,
  `discount_value` integer DEFAULT 0 NOT NULL,
  `features` text DEFAULT '[]' NOT NULL,
  `enabled` integer DEFAULT 1 NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
```

---

## Task 2: API 路由

### `src/app/api/plans/route.ts`

遵循 `system-prompts/route.ts` 模式：
- `GET` — 查询所有套餐，按 `sortOrder` 排序，无需鉴权
- `POST` — `requireAuth` 守卫，创建套餐，必填 `title`

### `src/app/api/plans/[id]/route.ts`

遵循 `models/[id]/route.ts` 模式：
- `PATCH` — `requireAuth` 守卫，动态更新字段，`features` 自动 JSON.stringify
- `DELETE` — `requireAuth` 守卫，按 ID 删除

---

## Task 3: 管理后台页面

### `src/app/admin/plans/page.tsx`（Server Component）

```ts
import { db } from "@/db";
import { plans } from "@/db/schema";
import PlansPageClient from "@/components/admin/PlansPageClient";

export default function PlansPage() {
  const allPlans = db.select().from(plans).orderBy(plans.sortOrder).all();
  return <PlansPageClient initialPlans={allPlans} />;
}
```

### `src/components/admin/PlansPageClient.tsx`（Client Component）

遵循 `SystemPromptsPageClient.tsx` 模式，核心结构：

- **表格列**: Title | Monthly | Yearly | Discount | Features | Enabled (Switch) | Sort | Actions (图标按钮)
- **Create/Edit Modal**: `maskClosable={false}`, `width={700}`
  - 表单字段：Title (Input), Description (TextArea), Monthly Price (InputNumber), Yearly Price (InputNumber), Discount Type (Select: none/percentage/fixed), Discount Value (InputNumber), Status (Select), Sort Order (InputNumber)
  - **Features 编辑器**: 使用 Ant Design `Form.List` 实现动态列表，每项包含 name (Input) + included (Switch ✓/✗) + 删除按钮，底部有"Add Feature"按钮
- **删除确认**: `App.useApp().modal.confirm`
- **启用/禁用**: 直接通过 Switch 切换，调用 PATCH API

---

## Task 4: 侧边栏导航

在 `AdminSidebar.tsx` 的 `menuGroups` 数组末尾添加新分组：

```ts
{
  title: "Business",
  items: [
    {
      href: "/admin/plans",
      label: "Plans",
      icon: <svg>/* 卡片/套餐图标 */</svg>,
    },
  ],
}
```

---

## 验证方式

1. 启动开发服务器 `npm run dev`
2. 登录管理员账号，访问 `/admin/plans`
3. 验证：创建套餐 → 编辑套餐 → 切换启用/禁用 → 添加/删除功能点 → 删除套餐
4. 检查数据库 `plans` 表数据正确性
5. 验证排序功能：设置不同 sortOrder，刷新后列表顺序正确
