import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { documentActivities, users } from "@/db/schema";
import { eq, gte, desc, and } from "drizzle-orm";
import { getApiT } from "@/lib/i18n-api";

// GET /api/document-activities?projectId=...&since=...&limit=20
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const since = searchParams.get("since");
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  if (!projectId) {
    return NextResponse.json({ error: t('api.projectIdRequired') }, { status: 400 });
  }

  const conditions = [eq(documentActivities.projectId, projectId)];
  if (since) {
    conditions.push(gte(documentActivities.createdAt, since));
  }

  const activities = db
    .select({
      id: documentActivities.id,
      projectId: documentActivities.projectId,
      documentPath: documentActivities.documentPath,
      documentTitle: documentActivities.documentTitle,
      action: documentActivities.action,
      oldTitle: documentActivities.oldTitle,
      userId: documentActivities.userId,
      userName: users.name,
      createdAt: documentActivities.createdAt,
    })
    .from(documentActivities)
    .leftJoin(users, eq(documentActivities.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(documentActivities.createdAt))
    .limit(limit)
    .all();

  return NextResponse.json({ activities });
}
