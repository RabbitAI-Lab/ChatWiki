import { db } from "@/db";
import { userSubscriptions, plans, tokenUsageLogs, tokenTopUps } from "@/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import type { AuthUser } from "./session";

interface QuotaCheckResult {
  allowed: boolean;
  /** 已使用 token 数 */
  used: number;
  /** 配额上限 (0 = unlimited) */
  limit: number;
  /** 剩余 token 数 */
  remaining: number;
  /** 充值增加的额度 */
  topUpTotal: number;
}

/**
 * 检查用户当前计费周期内的 token 用量是否超出套餐限额。
 *
 * 逻辑：
 * 1. admin 用户直接放行
 * 2. 查询用户活跃订阅 → 获取套餐的 tokenLimitMonthly / tokenLimitYearly
 * 3. limit === 0 表示无限额度，直接放行
 * 4. 查询本周期 tokenUsageLogs 的 totalTokens 总和
 * 5. 比较 used >= limit → 不允许
 *
 * 无活跃订阅的用户不允许使用（返回 allowed: false）
 */
export async function checkTokenQuota(auth: AuthUser): Promise<QuotaCheckResult> {
  // admin 放行
  if (auth.isAdmin) {
    return { allowed: true, used: 0, limit: 0, remaining: Infinity, topUpTotal: 0 };
  }

  // 查询活跃订阅 + 套餐限额
  const [subscription] = await db
    .select({
      billingCycle: userSubscriptions.billingCycle,
      startedAt: userSubscriptions.startedAt,
      expiresAt: userSubscriptions.expiresAt,
      planEnabled: plans.enabled,
      tokenLimitMonthly: plans.tokenLimitMonthly,
      tokenLimitYearly: plans.tokenLimitYearly,
    })
    .from(userSubscriptions)
    .innerJoin(plans, eq(userSubscriptions.planId, plans.id))
    .where(and(
      eq(userSubscriptions.userId, auth.id),
      eq(userSubscriptions.status, "active"),
    ))
    .limit(1);

  // 无活跃订阅 → 不允许
  if (!subscription) {
    return { allowed: false, used: 0, limit: 0, remaining: 0, topUpTotal: 0 };
  }

  // plan 被禁用或订阅已过期 → 不允许
  if (!subscription.planEnabled) {
    return { allowed: false, used: 0, limit: 0, remaining: 0, topUpTotal: 0 };
  }
  if (new Date(subscription.expiresAt) < new Date()) {
    return { allowed: false, used: 0, limit: 0, remaining: 0, topUpTotal: 0 };
  }

  // 确定配额
  const tokenLimit = subscription.billingCycle === "monthly"
    ? subscription.tokenLimitMonthly
    : subscription.tokenLimitYearly;

  // limit === 0 表示无限额度
  if (tokenLimit === 0) {
    return { allowed: true, used: 0, limit: 0, remaining: Infinity, topUpTotal: 0 };
  }

  // 查询本周期已用量
  const periodStart = subscription.startedAt;
  const [usageRow] = await db
    .select({
      totalTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalTokens}), 0)`,
    })
    .from(tokenUsageLogs)
    .where(and(
      eq(tokenUsageLogs.userId, auth.id),
      gte(tokenUsageLogs.createdAt, periodStart),
    ));

  const used = usageRow?.totalTokens || 0;

  // 查询未过期充值总额
  const nowISO = new Date().toISOString();
  const [topUpRow] = await db
    .select({ total: sql<number>`COALESCE(SUM(${tokenTopUps.tokens}), 0)` })
    .from(tokenTopUps)
    .where(and(
      eq(tokenTopUps.userId, auth.id),
      gte(tokenTopUps.expiresAt, nowISO),
    ));

  const topUpTotal = topUpRow?.total || 0;
  const effectiveLimit = tokenLimit + topUpTotal;
  const remaining = Math.max(0, effectiveLimit - used);

  return {
    allowed: used < effectiveLimit,
    used,
    limit: effectiveLimit,
    remaining,
    topUpTotal,
  };
}
