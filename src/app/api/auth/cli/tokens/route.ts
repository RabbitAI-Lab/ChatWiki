import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cliTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const tokens = db
    .select({
      id: cliTokens.id,
      name: cliTokens.name,
      prefix: cliTokens.prefix,
      lastUsedAt: cliTokens.lastUsedAt,
      createdAt: cliTokens.createdAt,
    })
    .from(cliTokens)
    .where(eq(cliTokens.userId, authResult.id))
    .all();

  return NextResponse.json({ tokens });
}
