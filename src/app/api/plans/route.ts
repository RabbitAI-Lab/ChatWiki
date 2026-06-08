import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { getApiT } from "@/lib/i18n-api";
import { isProviderAvailable } from "@/lib/payment";

export const dynamic = "force-dynamic";

// GET /api/plans
export async function GET() {
  const all = await db.select().from(plans).orderBy(plans.sortOrder);
  const paymentAvailable = isProviderAvailable("stripe");
  return NextResponse.json({ plans: all, paymentAvailable });
}

// POST /api/plans
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { title, description, defaultCurrency, prices, discountType, discountValue, features, enabled, sortOrder, tokenLimitMonthly, tokenLimitYearly, providerPrices, billingMode } = body;

  if (!title) {
    return NextResponse.json(
      { error: t('api.plans.titleRequired') },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const [inserted] = await db
    .insert(plans)
    .values({
      title,
      description: description ?? null,
      defaultCurrency: defaultCurrency ?? "CNY",
      prices: typeof prices === "string" ? prices : JSON.stringify(prices ?? []),
      discountType: discountType ?? "none",
      discountValue: discountValue ?? 0,
      features: typeof features === "string" ? features : JSON.stringify(features ?? []),
      enabled: enabled ?? true,
      sortOrder: sortOrder ?? 0,
      tokenLimitMonthly: tokenLimitMonthly ?? 0,
      tokenLimitYearly: tokenLimitYearly ?? 0,
      providerPrices: typeof providerPrices === "string" ? providerPrices : JSON.stringify(providerPrices ?? "{}"),
      billingMode: billingMode ?? "subscription",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return NextResponse.json({ id: inserted.id, title });
}
