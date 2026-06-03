import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { passkeys } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";

const updateSchema = z.object({
  deviceName: z.string().max(100).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (parsed.data.deviceName !== undefined) {
    db.update(passkeys)
      .set({ deviceName: parsed.data.deviceName })
      .where(and(eq(passkeys.id, id), eq(passkeys.userId, authResult.id)))
      .run();
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  db.delete(passkeys)
    .where(and(eq(passkeys.id, id), eq(passkeys.userId, authResult.id)))
    .run();

  return NextResponse.json({ success: true });
}
