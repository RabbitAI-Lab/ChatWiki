import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/db";
import { users, userSubscriptions, plans, tokenTopUps } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { createTokenTopUpNotification } from "@/lib/payment/notification";

export const dynamic = "force-dynamic";

const topUpSchema = z.object({
  tokens: z.number().int().min(1000),
  reason: z.enum(["system_gift", "promotion", "compensation", "manual"]).default("manual"),
  note: z.string().max(500).optional(),
});

// POST /api/admin/user-usage/[userId]/topup — 管理员为用户充值 token
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  const { userId } = await params;

  // 验证用户存在
  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId));

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 验证请求体
  const body = await req.json();
  const parsed = topUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { tokens, reason, note } = parsed.data;

  // 查询用户活跃订阅，获取过期时间
  const [subscription] = await db
    .select({
      expiresAt: userSubscriptions.expiresAt,
    })
    .from(userSubscriptions)
    .innerJoin(plans, eq(userSubscriptions.planId, plans.id))
    .where(and(
      eq(userSubscriptions.userId, userId),
      eq(userSubscriptions.status, "active"),
    ))
    .limit(1);

  // 确定充值记录过期时间：有订阅则与订阅到期时间一致，无订阅则 30 天后
  const now = new Date();
  let expiresAt: string;
  if (subscription) {
    expiresAt = subscription.expiresAt;
  } else {
    const exp = new Date(now);
    exp.setDate(exp.getDate() + 30);
    expiresAt = exp.toISOString();
  }

  // 插入充值记录
  const [topUp] = await db
    .insert(tokenTopUps)
    .values({
      userId,
      tokens,
      reason,
      note: note || null,
      expiresAt,
      createdBy: authResult.id,
      createdAt: now.toISOString(),
    })
    .returning();

  // 异步发送充值通知（不阻塞响应）
  createTokenTopUpNotification(userId, {
    tokens: topUp.tokens,
    reason: topUp.reason,
    note: topUp.note,
    expiresAt: topUp.expiresAt,
  }).catch((err) => {
    console.error("[topup] Failed to create notification:", err);
  });

  return NextResponse.json(
    {
      success: true,
      topUp: {
        id: topUp.id,
        tokens: topUp.tokens,
        reason: topUp.reason,
        note: topUp.note,
        expiresAt: topUp.expiresAt,
        createdAt: topUp.createdAt,
      },
    },
    { status: 201 },
  );
}
