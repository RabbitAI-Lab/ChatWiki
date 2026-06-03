import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { inviteCodes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const target = db.select().from(inviteCodes).where(eq(inviteCodes.id, id)).get();
    if (!target) {
      return NextResponse.json({ error: "Invite code not found" }, { status: 404 });
    }
    if (target.usedById) {
      return NextResponse.json(
        { error: "Cannot delete a used invite code" },
        { status: 400 }
      );
    }

    db.delete(inviteCodes).where(eq(inviteCodes.id, id)).run();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[auth] Admin delete invite code error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
