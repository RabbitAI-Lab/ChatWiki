/**
 * 套餐初始化脚本：插入三档套餐到 PGlite 数据库。
 *
 * 用法: npx tsx scripts/seed-plans.ts
 *
 * 安全：已存在的套餐不会被重复插入（按 title 去重）。
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import fs from "fs";
import os from "os";
import path from "path";

const RABBITDOCS_HOME =
  process.env.RABBITDOCS_HOME ||
  path.join(os.homedir(), ".rabbitdocs");
const DATA_DIR = path.join(RABBITDOCS_HOME, "pgdata");

// ── 三档套餐数据 ──

const PLANS = [
  {
    title: "Starter",
    description: "基础版 — 适合个人用户",
    defaultCurrency: "CNY",
    prices: [{ currency: "CNY", monthlyPrice: "29", yearlyPrice: "290" }],
    discountType: "none" as const,
    discountValue: 0,
    features: [
      { name: "个人项目（无限）", included: true },
      { name: "AI 对话（基础模型）", included: true },
      { name: "文档模板（6 个内置）", included: true },
      { name: "聊天分享", included: true },
      { name: "工作空间", included: false },
      { name: "团队协作", included: false },
      { name: "自定义 MCP 服务器", included: false },
      { name: "代码沙箱", included: false },
    ],
    enabled: true,
    sortOrder: 0,
    tokenLimitMonthly: 500_000,
    tokenLimitYearly: 5_000_000,
    providerPrices: {
      stripe: {
        monthlyPriceId: "price_1TgAdB1WC8viNpw1mmb5LN3V",
        yearlyPriceId: "price_1TgAdC1WC8viNpw1eYsoa64J",
      },
    },
    billingMode: "subscription" as const,
  },
  {
    title: "Pro",
    description: "专业版 — 适合中小团队",
    defaultCurrency: "CNY",
    prices: [{ currency: "CNY", monthlyPrice: "99", yearlyPrice: "990" }],
    discountType: "none" as const,
    discountValue: 0,
    features: [
      { name: "个人项目（无限）", included: true },
      { name: "AI 对话（高级模型 + 扩展思考）", included: true },
      { name: "文档模板（全部）", included: true },
      { name: "聊天分享 & HTML 发布", included: true },
      { name: "工作空间（最多 5 个）", included: true },
      { name: "团队协作（最多 10 人）", included: true },
      { name: "自定义 MCP 服务器", included: true },
      { name: "GitNexus 代码索引", included: true },
      { name: "代码沙箱", included: false },
    ],
    enabled: true,
    sortOrder: 1,
    tokenLimitMonthly: 2_000_000,
    tokenLimitYearly: 20_000_000,
    providerPrices: {
      stripe: {
        monthlyPriceId: "price_1TgAdC1WC8viNpw13zk3qTVn",
        yearlyPriceId: "price_1TgAdD1WC8viNpw1mWB0v5E1",
      },
    },
    billingMode: "subscription" as const,
  },
  {
    title: "Ultimate",
    description: "旗舰版 — 适合大型团队",
    defaultCurrency: "CNY",
    prices: [{ currency: "CNY", monthlyPrice: "299", yearlyPrice: "2990" }],
    discountType: "none" as const,
    discountValue: 0,
    features: [
      { name: "个人项目（无限）", included: true },
      { name: "AI 对话（全部模型 + 扩展思考）", included: true },
      { name: "文档模板（全部 + 自定义）", included: true },
      { name: "聊天分享 & HTML 发布", included: true },
      { name: "工作空间（无限）", included: true },
      { name: "团队协作（无限）", included: true },
      { name: "自定义 MCP 服务器", included: true },
      { name: "GitNexus 代码索引", included: true },
      { name: "代码沙箱", included: true },
      { name: "API / CLI 访问", included: true },
    ],
    enabled: true,
    sortOrder: 2,
    tokenLimitMonthly: 0, // 0 = 无限制
    tokenLimitYearly: 0,
    providerPrices: {
      stripe: {
        monthlyPriceId: "price_1TgAdE1WC8viNpw1UptUN3w2",
        yearlyPriceId: "price_1TgAdF1WC8viNpw1Amum9kwN",
      },
    },
    billingMode: "subscription" as const,
  },
];

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`❌ 数据库目录不存在: ${DATA_DIR}`);
    console.error("请先启动应用一次以初始化数据库。");
    process.exit(1);
  }

  console.log(`📂 数据库路径: ${DATA_DIR}`);

  const client = new PGlite(DATA_DIR);
  await client.waitReady;
  const db = drizzle(client, { schema });

  const { plans } = schema;
  let inserted = 0;
  let skipped = 0;

  for (const plan of PLANS) {
    // 按 title 去重
    const existing = await db.select().from(plans).where(eq(plans.title, plan.title));
    if (existing.length > 0) {
      console.log(`⏭  跳过已存在: ${plan.title} (id=${existing[0].id})`);
      skipped++;
      continue;
    }

    const now = new Date().toISOString();
    const [row] = await db.insert(plans).values({
      title: plan.title,
      description: plan.description,
      defaultCurrency: plan.defaultCurrency,
      prices: JSON.stringify(plan.prices),
      discountType: plan.discountType,
      discountValue: plan.discountValue,
      features: JSON.stringify(plan.features),
      enabled: plan.enabled,
      sortOrder: plan.sortOrder,
      tokenLimitMonthly: plan.tokenLimitMonthly,
      tokenLimitYearly: plan.tokenLimitYearly,
      providerPrices: JSON.stringify(plan.providerPrices),
      billingMode: plan.billingMode,
      createdAt: now,
      updatedAt: now,
    }).returning();

    console.log(`✅ 创建: ${plan.title} (id=${row.id}) — ¥${plan.prices[0].monthlyPrice}/月 ¥${plan.prices[0].yearlyPrice}/年`);
    inserted++;
  }

  await client.close();

  console.log(`\n═══════════════════════════`);
  console.log(`  完成: ${inserted} 个创建, ${skipped} 个跳过`);
  console.log(`═══════════════════════════`);
}

main().catch((err) => {
  console.error("❌ 脚本执行失败:", err);
  process.exit(1);
});
