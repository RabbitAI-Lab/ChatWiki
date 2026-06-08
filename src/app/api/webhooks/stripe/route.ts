import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, userSubscriptions, users, plans } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getProvider } from "@/lib/payment";
import { getProviderConfig } from "@/lib/payment/config";
import type { StandardWebhookEvent } from "@/lib/payment/types";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }

    // 获取 Stripe Provider
    const config = await getProviderConfig("stripe");
    if (!config) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 400 });
    }

    const provider = getProvider("stripe");
    const event = await provider.verifyAndParseWebhook(body, signature);

    console.log(`[webhook/stripe] Event: ${event.type}, eventId: ${event.providerEventId}`);

    switch (event.type) {
      case "checkout_completed": {
        await handleCheckoutCompleted(event);
        break;
      }
      case "subscription_renewed": {
        await handleSubscriptionRenewed(event);
        break;
      }
      case "subscription_cancelled": {
        await handleSubscriptionCancelled(event);
        break;
      }
      case "payment_failed": {
        await handlePaymentFailed(event);
        break;
      }
      case "refund_completed": {
        await handleRefundCompleted(event);
        break;
      }
      default:
        console.log(`[webhook/stripe] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhook/stripe] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 400 }
    );
  }
}

async function handleCheckoutCompleted(event: StandardWebhookEvent) {
  if (!event.orderId) return;

  // 幂等检查
  const [order] = await db.select().from(orders).where(eq(orders.id, event.orderId));
  if (!order || order.status === "paid") return;

  const now = new Date().toISOString();

  // 1. 更新 Order
  await db.update(orders)
    .set({
      status: "paid",
      paidAt: now,
      providerPaymentId: event.providerPaymentId || order.providerPaymentId,
      providerChargeId: event.providerChargeId || order.providerChargeId,
      providerInvoiceId: event.providerInvoiceId || order.providerInvoiceId,
      updatedAt: now,
    })
    .where(eq(orders.id, event.orderId));

  // 2. 更新用户 providerCustomerIds
  if (event.userId && event.providerCustomerId) {
    const [user] = await db.select().from(users).where(eq(users.id, event.userId));
    if (user) {
      const customerIds = JSON.parse(user.providerCustomerIds || "{}");
      customerIds["stripe"] = event.providerCustomerId;
      await db.update(users)
        .set({ providerCustomerIds: JSON.stringify(customerIds) })
        .where(eq(users.id, event.userId));
    }
  }

  // 3. 创建或更新 Subscription
  if (event.userId && event.planId) {
    const billingCycle = event.billingCycle || "monthly";
    const paymentMode = order.paymentMode;
    const startDate = new Date();
    const endDate = new Date(startDate);
    if (billingCycle === "monthly") {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // 检查是否已有活跃订阅
    const [existingSub] = await db.select().from(userSubscriptions)
      .where(and(
        eq(userSubscriptions.userId, event.userId),
        eq(userSubscriptions.status, "active"),
      ));

    if (existingSub) {
      // 升级/续费：更新
      await db.update(userSubscriptions)
        .set({
          planId: event.planId,
          billingCycle,
          expiresAt: endDate.toISOString(),
          startedAt: startDate.toISOString(),
          provider: "stripe",
          providerSubscriptionId: event.providerSubscriptionId || existingSub.providerSubscriptionId,
          providerCustomerId: event.providerCustomerId || existingSub.providerCustomerId,
          paymentMode,
          updatedAt: now,
        })
        .where(eq(userSubscriptions.id, existingSub.id));
    } else {
      // 新建订阅
      await db.insert(userSubscriptions).values({
        id: uuidv4(),
        userId: event.userId,
        planId: event.planId,
        billingCycle,
        status: "active",
        startedAt: startDate.toISOString(),
        expiresAt: endDate.toISOString(),
        provider: "stripe",
        providerSubscriptionId: event.providerSubscriptionId,
        providerCustomerId: event.providerCustomerId,
        paymentMode,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 4. 创建通知
    try {
      const { createOrderPaidNotifications, cancelPendingReminders } = await import("@/lib/payment/notification");
      await cancelPendingReminders(event.orderId);

      const [plan] = await db.select().from(plans)
        .where(eq(plans.id, event.planId!));

      await createOrderPaidNotifications(event.orderId, event.userId, {
        planTitle: plan?.title || "",
        amount: (order.amount / 100).toFixed(2),
        currency: order.currency,
        billingCycle,
        expiresAt: endDate.toISOString(),
        paymentMode,
      }, event.providerSubscriptionId, endDate.toISOString());
    } catch (err) {
      console.error("[webhook] Failed to create paid notifications:", err);
    }
  }
}

async function handleSubscriptionRenewed(event: StandardWebhookEvent) {
  if (!event.providerSubscriptionId) return;

  const [sub] = await db.select().from(userSubscriptions)
    .where(eq(userSubscriptions.providerSubscriptionId, event.providerSubscriptionId));
  if (!sub) return;

  const now = new Date();
  const endDate = new Date(now);
  if (sub.billingCycle === "monthly") {
    endDate.setMonth(endDate.getMonth() + 1);
  } else {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }

  await db.update(userSubscriptions)
    .set({
      expiresAt: endDate.toISOString(),
      updatedAt: now.toISOString(),
    })
    .where(eq(userSubscriptions.id, sub.id));

  // 创建续费成功通知 + 下一周期预告
  try {
    const { createSubscriptionRenewedNotifications } = await import("@/lib/payment/notification");
    await createSubscriptionRenewedNotifications(
      sub.id, sub.userId, {
        planTitle: "",
        newExpiresAt: endDate.toISOString(),
      }, endDate.toISOString()
    );
  } catch (err) {
    console.error("[webhook] Failed to create renewal notifications:", err);
  }
}

async function handleSubscriptionCancelled(event: StandardWebhookEvent) {
  if (!event.providerSubscriptionId) return;

  await db.update(userSubscriptions)
    .set({
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(userSubscriptions.providerSubscriptionId, event.providerSubscriptionId));

  // 取消续费预告任务
  try {
    const { cancelRenewalReminders } = await import("@/lib/payment/notification");
    const [sub] = await db.select().from(userSubscriptions)
      .where(eq(userSubscriptions.providerSubscriptionId, event.providerSubscriptionId));
    if (sub) {
      await cancelRenewalReminders(sub.id);
    }
  } catch (err) {
    console.error("[webhook] Failed to cancel renewal reminders:", err);
  }
}

async function handlePaymentFailed(event: StandardWebhookEvent) {
  // 通知用户支付失败
  if (event.providerCustomerId) {
    const [_user] = await db.select().from(users).where(eq(users.id, event.providerCustomerId!));
    // 如果能找到用户，创建通知
    // （简化：通过 providerCustomerId 查找可能不精确，依赖 metadata 中的 userId）
  }
  console.log("[webhook] Payment failed event received:", event.providerEventId);
}

async function handleRefundCompleted(event: StandardWebhookEvent) {
  if (!event.providerRefundId) return;

  // 查找对应 refund 记录
  const { refunds } = await import("@/db/schema");
  const [refund] = await db.select().from(refunds)
    .where(eq(refunds.providerRefundId, event.providerRefundId));

  if (refund && refund.status !== "completed") {
    const now = new Date().toISOString();
    await db.update(refunds)
      .set({ status: "completed", updatedAt: now })
      .where(eq(refunds.id, refund.id));

    // 更新 order 状态
    const [order] = await db.select().from(orders).where(eq(orders.id, refund.orderId));
    if (order) {
      const allRefunds = await db.select().from(refunds)
        .where(and(eq(refunds.orderId, order.id), eq(refunds.status, "completed")));
      const totalRefunded = allRefunds.reduce((sum, r) => sum + r.amount, 0);

      const newStatus = totalRefunded >= order.amount ? "refunded" : "partially_refunded";
      await db.update(orders)
        .set({ status: newStatus, updatedAt: now })
        .where(eq(orders.id, order.id));
    }
  }
}
