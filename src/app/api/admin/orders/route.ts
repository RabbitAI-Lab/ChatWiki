import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/db";
import { orders, plans, refunds, users, userSubscriptions, tokenTopUps } from "@/db/schema";
import { eq, and, desc, sql, or, like } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
  const status = searchParams.get("status");
  const providerFilter = searchParams.get("provider");
  const search = searchParams.get("search");
  const typeFilter = searchParams.get("type") || "all"; // all | order | topup

  const offset = (page - 1) * pageSize;

  // ── 查询 orders ──
  let orderRecords: Record<string, unknown>[] = [];
  let orderCount = 0;

  if (typeFilter === "all" || typeFilter === "order") {
    const conditions = [];
    if (status) conditions.push(eq(orders.status, status as "pending" | "paid" | "cancelled" | "refunded" | "partially_refunded" | "failed"));
    if (providerFilter) conditions.push(eq(orders.provider, providerFilter));
    if (search) conditions.push(or(like(users.email, `%${search}%`), like(users.name, `%${search}%`))!);

    orderRecords = await db
      .select({
        id: orders.id,
        userId: orders.userId,
        userEmail: users.email,
        userName: users.name,
        planId: orders.planId,
        planTitle: plans.title,
        amount: orders.amount,
        currency: orders.currency,
        originalAmount: orders.originalAmount,
        discountAmount: orders.discountAmount,
        billingCycle: orders.billingCycle,
        paymentMode: orders.paymentMode,
        provider: orders.provider,
        providerPaymentId: orders.providerPaymentId,
        providerChargeId: orders.providerChargeId,
        status: orders.status,
        paidAt: orders.paidAt,
        cancelledAt: orders.cancelledAt,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(plans, eq(orders.planId, plans.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset(offset);

    // 添加 recordType
    orderRecords = orderRecords.map((r) => ({ ...r, recordType: "order" as const }));

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    orderCount = countResult?.count || 0;
  }

  // ── 查询 token_top_ups ──
  let topUpRecords: Record<string, unknown>[] = [];
  let topUpCount = 0;

  if (typeFilter === "all" || typeFilter === "topup") {
    const topUpConditions = [];
    if (search) topUpConditions.push(or(
      like(users.email, `%${search}%`),
      like(users.name, `%${search}%`),
    )!);

    topUpRecords = await db
      .select({
        id: tokenTopUps.id,
        userId: tokenTopUps.userId,
        userEmail: users.email,
        userName: users.name,
        tokens: tokenTopUps.tokens,
        reason: tokenTopUps.reason,
        note: tokenTopUps.note,
        expiresAt: tokenTopUps.expiresAt,
        createdBy: tokenTopUps.createdBy,
        createdAt: tokenTopUps.createdAt,
      })
      .from(tokenTopUps)
      .leftJoin(users, eq(tokenTopUps.userId, users.id))
      .where(topUpConditions.length > 0 ? and(...topUpConditions) : undefined)
      .orderBy(desc(tokenTopUps.createdAt))
      .limit(pageSize)
      .offset(offset);

    // 映射为统一格式
    topUpRecords = topUpRecords.map((r) => ({
      id: `topup-${r.id}`,
      userId: r.userId,
      userEmail: r.userEmail,
      userName: r.userName,
      planId: null,
      planTitle: null,
      amount: r.tokens,
      currency: null,
      originalAmount: 0,
      discountAmount: 0,
      billingCycle: null,
      paymentMode: null,
      provider: "admin",
      providerPaymentId: null,
      providerChargeId: null,
      status: "completed",
      paidAt: null,
      cancelledAt: null,
      recordType: "topup" as const,
      tokens: r.tokens,
      reason: r.reason,
      note: r.note,
      expiresAt: r.expiresAt,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.createdAt,
    }));

    const [topUpCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tokenTopUps)
      .leftJoin(users, eq(tokenTopUps.userId, users.id))
      .where(topUpConditions.length > 0 ? and(...topUpConditions) : undefined);
    topUpCount = topUpCountResult?.count || 0;
  }

  // ── 合并排序 + 分页 ──
  const merged = [...orderRecords, ...topUpRecords]
    .sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());

  // 如果 type=all，两个数据源可能各自返回了 offset~offset+pageSize 条，
  // 合并后需要截取正确区间
  let finalRecords: Record<string, unknown>[];
  let totalCount: number;

  if (typeFilter === "all") {
    // 分别取了各自的 offset~offset+pageSize，合并后重新排序截取
    // 需要更多数据才能精确分页，这里取合并后的 offset ~ offset+pageSize
    finalRecords = merged.slice(0, pageSize);
    totalCount = orderCount + topUpCount;
  } else if (typeFilter === "order") {
    finalRecords = orderRecords;
    totalCount = orderCount;
  } else {
    finalRecords = topUpRecords;
    totalCount = topUpCount;
  }

  // ── 统计数据（仅基于 orders 表）──
  const [totalRevenueRow] = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(orders).where(eq(orders.status, "paid"));
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [monthlyRevenueRow] = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(orders)
    .where(and(
      eq(orders.status, "paid"),
      sql`paid_at LIKE ${yearMonth + "%"}`
    ));
  const [pendingRefundsRow] = await db.select({ count: sql<number>`count(*)` })
    .from(refunds).where(eq(refunds.status, "pending"));
  const [activeSubsRow] = await db.select({ count: sql<number>`count(*)` })
    .from(userSubscriptions)
    .where(eq(userSubscriptions.status, "active"));
  const stats = {
    totalRevenue: totalRevenueRow?.total || 0,
    monthlyRevenue: monthlyRevenueRow?.total || 0,
    pendingRefunds: pendingRefundsRow?.count || 0,
    activeSubscriptions: activeSubsRow?.count || 0,
  };

  return NextResponse.json({
    orders: finalRecords,
    total: totalCount,
    page,
    pageSize,
    stats,
  });
  } catch (error) {
    console.error("[admin/orders] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders", detail: String(error) },
      { status: 500 }
    );
  }
}
