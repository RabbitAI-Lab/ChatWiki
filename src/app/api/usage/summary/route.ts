import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { tokenUsageLogs, userSubscriptions, plans } from "@/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/usage/summary — 当前订阅周期内的 token 用量概览
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  // 1. 查询当前活跃订阅
  const [subscription] = await db
    .select({
      id: userSubscriptions.id,
      planId: userSubscriptions.planId,
      billingCycle: userSubscriptions.billingCycle,
      status: userSubscriptions.status,
      startedAt: userSubscriptions.startedAt,
      expiresAt: userSubscriptions.expiresAt,
      planTitle: plans.title,
      tokenLimitMonthly: plans.tokenLimitMonthly,
      tokenLimitYearly: plans.tokenLimitYearly,
    })
    .from(userSubscriptions)
    .innerJoin(plans, eq(userSubscriptions.planId, plans.id))
    .where(and(
      eq(userSubscriptions.userId, auth.id),
      eq(userSubscriptions.status, "active"),
    ));

  if (!subscription) {
    return NextResponse.json({ subscription: null, quota: null });
  }

  // 2. 确定配额和周期起始时间
  const tokenLimit = subscription.billingCycle === "monthly"
    ? subscription.tokenLimitMonthly
    : subscription.tokenLimitYearly;
  const periodStart = subscription.startedAt;

  // 3. 查询本周期用量
  const [usageRow] = await db
    .select({
      totalTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalTokens}), 0)`,
      inputTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.inputTokens}), 0)`,
      outputTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.outputTokens}), 0)`,
      cacheCreationTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.cacheCreationInputTokens}), 0)`,
      cacheReadTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.cacheReadInputTokens}), 0)`,
      requestCount: sql<number>`COUNT(*)`,
    })
    .from(tokenUsageLogs)
    .where(and(
      eq(tokenUsageLogs.userId, auth.id),
      gte(tokenUsageLogs.createdAt, periodStart),
    ));

  const used = usageRow?.totalTokens || 0;
  const remaining = tokenLimit > 0 ? Math.max(0, tokenLimit - used) : 0;
  const percentage = tokenLimit > 0 ? Math.min(100, Math.round((used / tokenLimit) * 100)) : 0;

  return NextResponse.json({
    subscription: {
      planId: subscription.planId,
      planTitle: subscription.planTitle,
      billingCycle: subscription.billingCycle,
      startedAt: subscription.startedAt,
      expiresAt: subscription.expiresAt,
    },
    quota: {
      limit: tokenLimit,
      used,
      remaining,
      percentage,
      periodStart,
      unlimited: tokenLimit === 0,
    },
    breakdown: {
      inputTokens: usageRow?.inputTokens || 0,
      outputTokens: usageRow?.outputTokens || 0,
      cacheCreationTokens: usageRow?.cacheCreationTokens || 0,
      cacheReadTokens: usageRow?.cacheReadTokens || 0,
    },
    requestCount: usageRow?.requestCount || 0,
  });
}
