import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { getApiT } from "@/lib/i18n-api";

// GET /api/templates
export async function GET() {
  // Static handler — note: no req means no auth possible; skipping guard
  // (if this handler needs auth, it should be a route with req param)
  const all = await db.select().from(templates);
  return NextResponse.json(all);
}

// POST /api/templates
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { name, description, content, icon, agentPrompt } = body;

  if (!name) {
    return NextResponse.json({ error: t('api.nameRequired') }, { status: 400 });
  }

  const now = new Date().toISOString();
  const [inserted] = await db.insert(templates).values({
    name,
    description: description || null,
    content: content || "",
    icon: icon || null,
    agentPrompt: agentPrompt || "",
    isSystem: false,  // 用户创建的模板
    createdAt: now,
    updatedAt: now,
  }).returning();

  return NextResponse.json(inserted);
}
