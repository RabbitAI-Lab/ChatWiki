import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/db";
import { tokenTopUps } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/admin/user-usage/[userId]/topups — 查询用户充值记录
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  const { userId } = await params;

  const topUpRecords = await db
    .select({
      id: tokenTopUps.id,
      tokens: tokenTopUps.tokens,
      reason: tokenTopUps.reason,
      note: tokenTopUps.note,
      expiresAt: tokenTopUps.expiresAt,
      createdBy: tokenTopUps.createdBy,
      createdAt: tokenTopUps.createdAt,
    })
    .from(tokenTopUps)
    .where(eq(tokenTopUps.userId, userId))
    .orderBy(desc(tokenTopUps.createdAt));

  return NextResponse.json({ topUps: topUpRecords });
}
