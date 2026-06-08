import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { passkeys } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const list = await db
    .select({
      id: passkeys.id,
      deviceName: passkeys.deviceName,
      createdAt: passkeys.createdAt,
      lastUsedAt: passkeys.lastUsedAt,
    })
    .from(passkeys)
    .where(eq(passkeys.userId, authResult.id));

  return NextResponse.json({ passkeys: list });
}
