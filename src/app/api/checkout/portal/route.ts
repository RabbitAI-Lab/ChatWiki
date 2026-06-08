import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { userSubscriptions } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getProvider, isProviderAvailable } from "@/lib/payment";
import { getAppUrl } from "@/lib/auth/env";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  try {
    const body = await req.json();
    const { provider = "stripe" } = body as { provider?: string };

    if (!isProviderAvailable(provider)) {
      return NextResponse.json({ error: "Payment provider not configured" }, { status: 400 });
    }

    // 获取用户当前活跃订阅
    const [subscription] = await db
      .select()
      .from(userSubscriptions)
      .where(and(
        eq(userSubscriptions.userId, user.id),
        eq(userSubscriptions.status, "active"),
      ))
      .orderBy(desc(userSubscriptions.createdAt));

    if (!subscription) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
    }
    if (!subscription.providerCustomerId) {
      return NextResponse.json({ error: "Subscription has no provider customer ID" }, { status: 400 });
    }

    const paymentProvider = getProvider(provider);
    if (!paymentProvider.createPortalSession) {
      return NextResponse.json({ error: "Portal not supported by this provider" }, { status: 400 });
    }

    const appUrl = getAppUrl();
    const result = await paymentProvider.createPortalSession({
      providerCustomerId: subscription.providerCustomerId,
      returnUrl: `${appUrl}/billing`,
    });

    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error("[portal] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
