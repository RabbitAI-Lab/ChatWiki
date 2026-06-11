import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/db";
import { users, userSubscriptions, plans, tokenUsageLogs } from "@/db/schema";
import { and, eq, like, or, sql, desc, inArray, gte } from "drizzle-orm";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// GET /api/admin/user-usage/users — 搜索用户并附带订阅状态概览
export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  const sp = req.nextUrl.searchParams;
  const search = (sp.get("search") || "").trim();
  const pageRaw = parseInt(sp.get("page") || "1", 10);
  const pageSizeRaw = parseInt(sp.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
      ? Math.min(pageSizeRaw, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  // 构建过滤条件
  const filters = [];
  if (search) {
    const term = `%${search}%`;
    filters.push(or(like(users.email, term), like(users.name, term)));
  }
  const where = filters.length === 0 ? undefined : filters.length === 1 ? filters[0] : and(...filters);

  // 总数
  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(where);
  const total = totalRow?.count ?? 0;

  // 查询用户列表
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      disabled: users.disabled,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset(offset);

  // 为每个用户查询活跃订阅 + 配额信息
  const userIds = rows.map((r) => r.id);
  const subscriptionMap = new Map<string, {
    id: string;
    planTitle: string;
    billingCycle: string;
    status: string;
    expiresAt: string;
    startedAt: string;
    tokenLimit: number;
  }>();

  if (userIds.length > 0) {
    const subs = await db
      .select({
        userId: userSubscriptions.userId,
        subscriptionId: userSubscriptions.id,
        planTitle: plans.title,
        billingCycle: userSubscriptions.billingCycle,
        status: userSubscriptions.status,
        expiresAt: userSubscriptions.expiresAt,
        startedAt: userSubscriptions.startedAt,
        tokenLimitMonthly: plans.tokenLimitMonthly,
        tokenLimitYearly: plans.tokenLimitYearly,
      })
      .from(userSubscriptions)
      .innerJoin(plans, eq(userSubscriptions.planId, plans.id))
      .where(
        and(
          inArray(userSubscriptions.userId, userIds),
          eq(userSubscriptions.status, "active"),
        )
      );

    for (const sub of subs) {
      const tokenLimit = sub.billingCycle === "monthly"
        ? sub.tokenLimitMonthly
        : sub.tokenLimitYearly;
      subscriptionMap.set(sub.userId, {
        id: sub.subscriptionId,
        planTitle: sub.planTitle,
        billingCycle: sub.billingCycle,
        status: sub.status,
        expiresAt: sub.expiresAt,
        startedAt: sub.startedAt,
        tokenLimit,
      });
    }

    // 查询每个有订阅用户的本周期 token 用量
    const subscribedUserIds = subs.map((s) => s.userId);
    const usageMap = new Map<string, number>();

    if (subscribedUserIds.length > 0) {
      // 为每个订阅用户查询从 startedAt 开始的用量
      // 使用 UNION ALL 方式批量查询
      const usageRows = await db
        .select({
          userId: tokenUsageLogs.userId,
          used: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalTokens}), 0)`,
        })
        .from(tokenUsageLogs)
        .where(
          and(
            inArray(tokenUsageLogs.userId, subscribedUserIds),
            gte(tokenUsageLogs.createdAt, sql`(
              SELECT ${userSubscriptions.startedAt}
              FROM ${userSubscriptions}
              WHERE ${userSubscriptions.userId} = ${tokenUsageLogs.userId}
                AND ${userSubscriptions.status} = 'active'
              LIMIT 1
            )`),
          )
        )
        .groupBy(tokenUsageLogs.userId);

      for (const row of usageRows) {
        usageMap.set(row.userId, row.used);
      }
    }

    // 合并 usage 数据到 subscriptionMap
    for (const uid of subscribedUserIds) {
      const sub = subscriptionMap.get(uid);
      if (sub) {
        (sub as Record<string, unknown>).tokensUsed = usageMap.get(uid) || 0;
      }
    }
  }

  return NextResponse.json({
    users: rows.map((r) => ({
      ...r,
      disabled: r.disabled === true,
      subscription: subscriptionMap.get(r.id)
        ? (() => {
          const sub = subscriptionMap.get(r.id)!;
          return {
            id: sub.id,
            planTitle: sub.planTitle,
            billingCycle: sub.billingCycle,
            status: sub.status,
            expiresAt: sub.expiresAt,
            tokensUsed: (sub as Record<string, unknown>).tokensUsed as number || 0,
            tokenLimit: sub.tokenLimit,
          };
        })()
        : null,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}
