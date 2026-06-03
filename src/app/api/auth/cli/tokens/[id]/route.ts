import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cliTokens } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  db.delete(cliTokens)
    .where(and(eq(cliTokens.id, id), eq(cliTokens.userId, authResult.id)))
    .run();

  return NextResponse.json({ success: true });
}
