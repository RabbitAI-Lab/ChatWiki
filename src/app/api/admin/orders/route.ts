import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/db";
import { orders, plans, refunds, users } from "@/db/schema";
import { eq, and, desc, sql, or, like } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
  const status = searchParams.get("status");
  const providerFilter = searchParams.get("provider");
  const search = searchParams.get("search");

  const conditions = [];
  if (status) conditions.push(eq(orders.status, status as "pending" | "paid" | "cancelled" | "refunded" | "partially_refunded" | "failed"));
  if (providerFilter) conditions.push(eq(orders.provider, providerFilter));
  if (search) conditions.push(or(like(users.email, `%${search}%`), like(users.name, `%${search}%`))!);

  const offset = (page - 1) * pageSize;

  const orderList = db
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
    .offset(offset)
    .all();

  // 统计数据
  const stats = {
    totalRevenue: db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(orders).where(eq(orders.status, "paid")).get()?.total || 0,
    monthlyRevenue: db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(orders)
      .where(and(
        eq(orders.status, "paid"),
        sql`strftime('%Y-%m', paid_at) = strftime('%Y-%m', 'now')`
      ))
      .get()?.total || 0,
    pendingRefunds: db.select({ count: sql<number>`count(*)` })
      .from(refunds).where(eq(refunds.status, "pending")).get()?.count || 0,
    activeSubscriptions: db.select({ count: sql<number>`count(*)` })
      .from((await import("@/db/schema")).userSubscriptions)
      .where(eq((await import("@/db/schema")).userSubscriptions.status, "active"))
      .get()?.count || 0,
  };

  const countResult = db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .get();

  return NextResponse.json({
    orders: orderList,
    total: countResult?.count || 0,
    page,
    pageSize,
    stats,
  });
}
