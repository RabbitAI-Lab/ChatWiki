# Pricing 页面从 API/数据库获取套餐数据

## Context

当前 `/pricing` 营销页面的套餐数据完全硬编码在 `page.tsx` 中，从 i18n 翻译文件读取 3 个固定套餐（免费版、专业版、团队版）。需要改为从数据库获取管理员在后台配置的套餐，使定价页面与实际可订阅的套餐保持一致。

## 方案：服务端直接查询 DB

保持服务端组件，直接调用 `db` 查询（与 `admin/plans/page.tsx` 同一模式），避免转为客户端组件带来的 SEO 损失。

## 修改文件

### `src/app/(marketing)/pricing/page.tsx`

**改动要点：**

1. **新增导入**：`db`, `plans` schema, `eq` from drizzle-orm, `getLocale`
2. **查询已启用的套餐**：
   ```ts
   const allPlans = db.select().from(plans)
     .where(eq(plans.enabled, 1))
     .orderBy(plans.sortOrder)
     .all();
   ```
3. **数据转换**：DB Plan → `PricingPlan` 接口映射

   | PricingPlan 字段 | 数据来源 |
   |---|---|
   | `name` | `plan.title` |
   | `description` | `plan.description ?? ""` |
   | `price` | 从 `prices` JSON 中按 locale 匹配货币，取 `monthlyPrice` |
   | `period` | `t("plans.period")` (i18n) |
   | `features` | `JSON.parse(plan.features).filter(f => f.included).map(f => f.name)` |
   | `cta` | 价格为 0 → `t("plans.free.cta")`，否则 → `t("plans.team.cta")` |
   | `ctaHref` | 价格为 0 → `"/register"`，否则 → `"mailto:sales@rabbitai-lab.com"` |
   | `highlight` | 中间套餐 `true`（`index = Math.floor(allPlans.length / 2)`） |
   | `badge` | 高亮套餐使用 `t("plans.popular")` |

4. **货币匹配逻辑**：
   - `zh` locale → 查找 `CNY` 价格
   - `en` locale → 查找 `USD` 价格
   - 未找到 → 回退到 `plan.defaultCurrency` → 再回退到数组第一项
   - 格式化：`"{symbol}{price}"`（如 `"¥99"`, `"$15"`）

5. **空套餐回退**：无已启用套餐时，跳过 `<PricingTable>` 渲染
   ```tsx
   {pricingPlans.length > 0 && <PricingTable title="" plans={pricingPlans} />}
   ```

### 其他文件 — 无需修改

- `src/components/marketing/sections/PricingTable.tsx` — 接口不变，无需改动
- `src/app/api/plans/route.ts` — API 不变
- `messages/*.json` — 暂不删除旧的 `plans.free/pro/team` 翻译键，保留可回退能力

## 验证步骤

1. 确保数据库中有已启用的套餐（通过 admin 后台 `/admin/plans` 创建）
2. 访问 `/pricing` 页面，确认显示数据库中的套餐卡片
3. 切换中/英文，确认货币符号正确（CNY/¥ vs USD/$）
4. 在 admin 后台禁用所有套餐，确认 `<PricingTable>` 区域不渲染
5. 测试 0/1/2/3/4 个已启用套餐的布局表现
