import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/db";
import { refunds, orders, users, plans } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
  const status = searchParams.get("status");

  const conditions = [];
  if (status) conditions.push(eq(refunds.status, status as "pending" | "approved" | "rejected" | "processing" | "completed" | "failed"));

  const offset = (page - 1) * pageSize;

  const refundList = await db
    .select({
      id: refunds.id,
      orderId: refunds.orderId,
      userId: refunds.userId,
      userEmail: users.email,
      userName: users.name,
      amount: refunds.amount,
      reason: refunds.reason,
      status: refunds.status,
      reviewedBy: refunds.reviewedBy,
      reviewedAt: refunds.reviewedAt,
      reviewNote: refunds.reviewNote,
      provider: refunds.provider,
      providerRefundId: refunds.providerRefundId,
      orderAmount: orders.amount,
      orderCurrency: orders.currency,
      planTitle: plans.title,
      createdAt: refunds.createdAt,
      updatedAt: refunds.updatedAt,
    })
    .from(refunds)
    .leftJoin(orders, eq(refunds.orderId, orders.id))
    .leftJoin(users, eq(refunds.userId, users.id))
    .leftJoin(plans, eq(orders.planId, plans.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(refunds.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(refunds)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return NextResponse.json({
    refunds: refundList,
    total: countResult?.count || 0,
    page,
    pageSize,
  });
}
