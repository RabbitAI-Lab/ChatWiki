import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { orders, refunds } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getRefundDeadlineDays } from "@/lib/payment/config";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;
  const { id: orderId } = await params;

  try {
    const body = await req.json();
    const { reason } = body as { reason?: string };

    // 查找订单
    const [order] = await db.select().from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.userId, user.id)));

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status !== "paid") {
      return NextResponse.json({ error: "Only paid orders can be refunded" }, { status: 400 });
    }

    // 检查退款截止日期
    const deadlineDays = await getRefundDeadlineDays();
    if (order.paidAt) {
      const paidDate = new Date(order.paidAt);
      const deadline = new Date(paidDate);
      deadline.setDate(deadline.getDate() + deadlineDays);
      if (new Date() > deadline) {
        return NextResponse.json(
          { error: `Refund period expired (${deadlineDays} days after payment)` },
          { status: 400 }
        );
      }
    }

    // 检查是否已有待处理的退款
    const [existingRefund] = await db.select().from(refunds)
      .where(and(
        eq(refunds.orderId, orderId),
        eq(refunds.status, "pending"),
      ));

    if (existingRefund) {
      return NextResponse.json({ error: "A refund request is already pending" }, { status: 400 });
    }

    // 创建退款申请
    const now = new Date().toISOString();
    const refundId = uuidv4();

    await db.insert(refunds).values({
      id: refundId,
      orderId,
      userId: user.id,
      amount: order.amount,
      reason: reason || null,
      status: "pending",
      provider: order.provider,
      createdAt: now,
      updatedAt: now,
    });

    // 通知管理员
    try {
      const { createRefundRequestedNotifications } = await import("@/lib/payment/notification");
      await createRefundRequestedNotifications(refundId, orderId, user.id, {
        userName: user.name || user.email,
        userEmail: user.email,
        amount: (order.amount / 100).toFixed(2),
        currency: order.currency,
        reason: reason || "",
      });
    } catch (err) {
      console.error("[refund] Failed to create notifications:", err);
    }

    return NextResponse.json({ refundId, status: "pending" });
  } catch (error) {
    console.error("[refund] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
