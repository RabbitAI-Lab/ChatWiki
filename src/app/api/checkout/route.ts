import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { plans, orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getProvider, isProviderAvailable } from "@/lib/payment";
import { getProviderConfig } from "@/lib/payment/config";
import { getAppUrl } from "@/lib/auth/env";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  try {
    const body = await req.json();
    const { planId, billingCycle, provider = "stripe" } = body as {
      planId: number;
      billingCycle: "monthly" | "yearly";
      provider?: string;
    };

    if (!planId || !billingCycle) {
      return NextResponse.json({ error: "Missing required fields: planId, billingCycle" }, { status: 400 });
    }

    // 1. 验证渠道已启用
    const providerConfig = getProviderConfig(provider);
    if (!providerConfig) {
      return NextResponse.json({ error: `Payment provider "${provider}" is not enabled` }, { status: 400 });
    }

    if (!isProviderAvailable(provider)) {
      return NextResponse.json({ error: `Payment provider "${provider}" is not available` }, { status: 400 });
    }

    // 2. 查 plan
    const plan = db.select().from(plans).where(eq(plans.id, planId)).get();
    if (!plan || !plan.enabled) {
      return NextResponse.json({ error: "Plan not found or disabled" }, { status: 404 });
    }

    // 3. 获取 provider 价格配置
    const providerPrices = JSON.parse(plan.providerPrices || "{}");
    const providerPriceConfig = providerPrices[provider];
    if (!providerPriceConfig) {
      return NextResponse.json({ error: `Plan not configured for provider "${provider}"` }, { status: 400 });
    }

    // 4. 计算金额
    const prices = JSON.parse(plan.prices || "[]");
    const priceEntry = prices.find((p: { currency: string }) => p.currency === plan.defaultCurrency) || prices[0];
    if (!priceEntry) {
      return NextResponse.json({ error: "No pricing found for this plan" }, { status: 400 });
    }

    const originalAmount = billingCycle === "monthly"
      ? (priceEntry.monthlyPrice || 0) * 100
      : (priceEntry.yearlyPrice || 0) * 100;

    let discountAmount = 0;
    let amount = originalAmount;
    if (plan.discountType === "percentage" && plan.discountValue > 0) {
      discountAmount = Math.round(originalAmount * (1 - plan.discountValue / 1000));
      amount = originalAmount - discountAmount;
    } else if (plan.discountType === "fixed" && plan.discountValue > 0) {
      discountAmount = plan.discountValue;
      amount = Math.max(0, originalAmount - discountAmount);
    }

    // 5. 创建 Order
    const orderId = uuidv4();
    const now = new Date().toISOString();
    const appUrl = getAppUrl();
    const billingMode = (plan.billingMode as "subscription" | "one_time") || "subscription";

    db.insert(orders).values({
      id: orderId,
      userId: user.id,
      planId: plan.id,
      amount,
      currency: plan.defaultCurrency,
      originalAmount,
      discountAmount,
      billingCycle,
      paymentMode: billingMode,
      provider,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    }).run();

    // 6. 调用 Provider 创建 Checkout Session
    const paymentProvider = getProvider(provider);
    const result = await paymentProvider.createCheckout({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      planId: plan.id,
      planTitle: plan.title,
      billingCycle,
      billingMode,
      orderId,
      currency: plan.defaultCurrency,
      amount,
      originalAmount,
      providerConfig: providerPriceConfig,
      successUrl: `${appUrl}/billing?checkout=success&order=${orderId}`,
      cancelUrl: `${appUrl}/billing?checkout=cancelled&order=${orderId}`,
    });

    // 7. 创建通知任务（待支付通知）
    try {
      const { createOrderPendingNotifications } = await import("@/lib/payment/notification");
      await createOrderPendingNotifications(orderId, user.id, user.email, {
        planTitle: plan.title,
        amount: (amount / 100).toFixed(2),
        currency: plan.defaultCurrency,
        billingCycle,
        checkoutUrl: result.url,
      });
    } catch (err) {
      console.error("[checkout] Failed to create notifications:", err);
    }

    return NextResponse.json({ url: result.url, orderId });
  } catch (error) {
    console.error("[checkout] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
