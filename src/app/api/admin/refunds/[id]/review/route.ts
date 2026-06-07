import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/db";
import { refunds, orders, userSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getProvider } from "@/lib/payment";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;
  const admin = authResult;
  const { id: refundId } = await params;

  try {
    const body = await req.json();
    const { action, amount: partialAmount, note } = body as {
      action: "approve" | "reject";
      amount?: number;
      note?: string;
    };

    const refund = db.select().from(refunds).where(eq(refunds.id, refundId)).get();
    if (!refund) {
      return NextResponse.json({ error: "Refund not found" }, { status: 404 });
    }

    if (refund.status !== "pending") {
      return NextResponse.json({ error: `Refund is already ${refund.status}` }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (action === "reject") {
      db.update(refunds)
        .set({
          status: "rejected",
          reviewedBy: admin.id,
          reviewedAt: now,
          reviewNote: note || null,
          updatedAt: now,
        })
        .where(eq(refunds.id, refundId))
        .run();

      // 通知用户退款被拒
      try {
        const { createRefundStatusNotification } = await import("@/lib/payment/notification");
        const order = db.select().from(orders).where(eq(orders.id, refund.orderId)).get();
        await createRefundStatusNotification(refund.userId, refund.orderId, "refund_rejected", {
          amount: (refund.amount / 100).toFixed(2),
          currency: order?.currency || "CNY",
          reason: note || "",
        });
      } catch (err) {
        console.error("[refund-review] Failed to send rejection notification:", err);
      }

      return NextResponse.json({ status: "rejected" });
    }

    if (action === "approve") {
      // 获取关联订单
      const order = db.select().from(orders).where(eq(orders.id, refund.orderId)).get();
      if (!order) {
        return NextResponse.json({ error: "Associated order not found" }, { status: 404 });
      }

      if (order.status !== "paid" && order.status !== "partially_refunded") {
        return NextResponse.json({ error: `Order status is ${order.status}, cannot refund` }, { status: 400 });
      }

      const refundAmount = partialAmount || refund.amount;

      // 金额校验
      if (refundAmount > order.amount) {
        return NextResponse.json({ error: "Refund amount exceeds order amount" }, { status: 400 });
      }

      // 更新退款状态为 processing
      db.update(refunds)
        .set({
          status: "processing",
          amount: refundAmount,
          reviewedBy: admin.id,
          reviewedAt: now,
          reviewNote: note || null,
          updatedAt: now,
        })
        .where(eq(refunds.id, refundId))
        .run();

      // 通过 Provider 执行退款
      try {
        const paymentProvider = getProvider(order.provider);
        const result = await paymentProvider.createRefund({
          providerPaymentId: order.providerPaymentId || "",
          amount: refundAmount,
          reason: note || undefined,
        });

        // 更新退款记录
        db.update(refunds)
          .set({
            status: "completed",
            providerRefundId: result.providerRefundId,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(refunds.id, refundId))
          .run();

        // 更新订单状态
        const newOrderStatus = refundAmount >= order.amount ? "refunded" : "partially_refunded";
        db.update(orders)
          .set({ status: newOrderStatus, updatedAt: new Date().toISOString() })
          .where(eq(orders.id, order.id))
          .run();

        // 全额退款时取消订阅
        if (newOrderStatus === "refunded" && order.subscriptionId) {
          db.update(userSubscriptions)
            .set({
              status: "cancelled",
              cancelledAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            .where(eq(userSubscriptions.id, order.subscriptionId!))
            .run();

          // 尝试在支付渠道取消订阅
          try {
            const sub = db.select().from(userSubscriptions)
              .where(eq(userSubscriptions.id, order.subscriptionId!))
              .get();
            if (sub?.providerSubscriptionId && paymentProvider.cancelSubscription) {
              await paymentProvider.cancelSubscription(sub.providerSubscriptionId);
            }
          } catch (cancelErr) {
            console.error("[refund-review] Failed to cancel subscription at provider:", cancelErr);
          }
        }

        // 通知用户退款通过
        try {
          const { createRefundStatusNotification } = await import("@/lib/payment/notification");
          await createRefundStatusNotification(refund.userId, refund.orderId, "refund_approved", {
            amount: (refundAmount / 100).toFixed(2),
            currency: order.currency,
          });
        } catch (err) {
          console.error("[refund-review] Failed to send approval notification:", err);
        }

        return NextResponse.json({ status: "completed", providerRefundId: result.providerRefundId });
      } catch (refundError) {
        console.error("[refund-review] Provider refund failed:", refundError);

        db.update(refunds)
          .set({ status: "failed", updatedAt: new Date().toISOString() })
          .where(eq(refunds.id, refundId))
          .run();

        return NextResponse.json(
          { error: `Refund failed: ${refundError instanceof Error ? refundError.message : "Unknown error"}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[refund-review] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
