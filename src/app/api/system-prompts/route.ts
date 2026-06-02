import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { systemPrompts } from "@/db/schema";

export const dynamic = "force-dynamic";

// GET /api/system-prompts
export async function GET() {
  const all = db.select().from(systemPrompts).orderBy(systemPrompts.sortOrder).all();
  return NextResponse.json(all);
}

// POST /api/system-prompts
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, content, description, enabled, sortOrder } = body;

  if (!name || !content) {
    return NextResponse.json(
      { error: "name and content are required" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const result = db
    .insert(systemPrompts)
    .values({
      name,
      content,
      description: description ?? null,
      enabled: enabled ?? 1,
      sortOrder: sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return NextResponse.json({ id: result.lastInsertRowid, name });
}
