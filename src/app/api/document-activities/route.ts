import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documentActivities } from "@/db/schema";
import { eq, gte, desc, and } from "drizzle-orm";

// GET /api/document-activities?projectId=...&since=...&limit=20
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const since = searchParams.get("since");
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const conditions = [eq(documentActivities.projectId, projectId)];
  if (since) {
    conditions.push(gte(documentActivities.createdAt, since));
  }

  const activities = db
    .select()
    .from(documentActivities)
    .where(and(...conditions))
    .orderBy(desc(documentActivities.createdAt))
    .limit(limit)
    .all();

  return NextResponse.json({ activities });
}
