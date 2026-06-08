import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { inviteCodes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/auth/session";
import crypto from "crypto";
import { getApiT } from "@/lib/i18n-api";

const MAX_CODES_PER_USER = 5;

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult as AuthUser;

  const codes = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.createdById, user.id));

  return NextResponse.json({
    codes: codes.map((c) => ({
      id: c.id,
      code: c.code,
      used: !!c.usedById,
      usedAt: c.usedAt,
      createdAt: c.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult as AuthUser;

  // 检查数量限制
  const existing = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.createdById, user.id));

  if (existing.length >= MAX_CODES_PER_USER) {
    const t = await getApiT();
    return NextResponse.json(
      { error: t('api.auth.maxInviteCodes', { count: MAX_CODES_PER_USER }) },
      { status: 400 }
    );
  }

  const code = crypto.randomBytes(4).toString("hex");
  const now = new Date().toISOString();

  await db.insert(inviteCodes)
    .values({
      id: crypto.randomUUID(),
      code,
      createdById: user.id,
      createdAt: now,
    });

  return NextResponse.json({ code }, { status: 201 });
}
