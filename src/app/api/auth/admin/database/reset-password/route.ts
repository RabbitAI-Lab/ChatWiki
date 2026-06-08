import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;
  const t = await getApiT();

  try {
    const body = await req.json();
    const { userId, newPassword } = body;

    if (!userId || !newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json(
        { error: t('api.auth.database.invalidResetParams') },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);

    const [updated] = await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: t('api.auth.database.userNotFound') },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[database] reset password error:", error);
    return NextResponse.json(
      { error: t('api.internalError') },
      { status: 500 }
    );
  }
}
