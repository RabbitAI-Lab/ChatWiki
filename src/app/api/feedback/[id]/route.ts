import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/db";
import { feedbacks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getApiT } from "@/lib/i18n-api";

const updateSchema = z.object({
  status: z.enum(["pending", "reviewed", "resolved"]),
});

/**
 * PATCH /api/feedback/[id] — 更新反馈状态（需 admin）
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;
  const t = await getApiT();

  try {
    const { id } = await params;
    const feedbackId = parseInt(id, 10);
    if (isNaN(feedbackId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const [updated] = await db
      .update(feedbacks)
      .set({
        status: parsed.data.status,
        updatedAt: now,
      })
      .where(eq(feedbacks.id, feedbackId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[feedback] PATCH error:", error);
    return NextResponse.json(
      { error: t("api.internalError") },
      { status: 500 },
    );
  }
}
