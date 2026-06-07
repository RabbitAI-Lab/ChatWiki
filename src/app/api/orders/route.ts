import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { orders, plans, refunds } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
  const status = searchParams.get("status");

  const conditions = [eq(orders.userId, user.id)];
  if (status) {
    conditions.push(eq(orders.status, status as "pending" | "paid" | "cancelled" | "refunded" | "partially_refunded" | "failed"));
  }

  const offset = (page - 1) * pageSize;

  const orderList = db
    .select({
      id: orders.id,
      planId: orders.planId,
      planTitle: plans.title,
      amount: orders.amount,
      currency: orders.currency,
      originalAmount: orders.originalAmount,
      discountAmount: orders.discountAmount,
      billingCycle: orders.billingCycle,
      paymentMode: orders.paymentMode,
      provider: orders.provider,
      status: orders.status,
      paidAt: orders.paidAt,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(plans, eq(orders.planId, plans.id))
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(pageSize)
    .offset(offset)
    .all();

  // 获取每个订单的退款记录
  const ordersWithRefunds = orderList.map((order) => {
    const refundList = db
      .select()
      .from(refunds)
      .where(eq(refunds.orderId, order.id))
      .all();
    return { ...order, refunds: refundList };
  });

  // 总数
  const countResult = db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(and(...conditions))
    .get();

  return NextResponse.json({
    orders: ordersWithRefunds,
    total: countResult?.count || 0,
    page,
    pageSize,
  });
}
