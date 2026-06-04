import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { eq } from "drizzle-orm";

// PATCH /api/plans/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await req.json();

  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (body.title !== undefined) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.defaultCurrency !== undefined) updateData.defaultCurrency = body.defaultCurrency;
  if (body.prices !== undefined) {
    updateData.prices = typeof body.prices === "string"
      ? body.prices
      : JSON.stringify(body.prices);
  }
  if (body.discountType !== undefined) updateData.discountType = body.discountType;
  if (body.discountValue !== undefined) updateData.discountValue = body.discountValue;
  if (body.features !== undefined) {
    updateData.features = typeof body.features === "string"
      ? body.features
      : JSON.stringify(body.features);
  }
  if (body.enabled !== undefined) updateData.enabled = body.enabled;
  if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

  db.update(plans)
    .set(updateData)
    .where(eq(plans.id, parseInt(id)))
    .run();

  return NextResponse.json({ success: true });
}

// DELETE /api/plans/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  db.delete(plans)
    .where(eq(plans.id, parseInt(id)))
    .run();
  return NextResponse.json({ success: true });
}
