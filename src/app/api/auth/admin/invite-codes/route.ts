import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { inviteCodes, users } from "@/db/schema";
import { eq, like, or, sql, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  const sp = req.nextUrl.searchParams;
  const search = (sp.get("search") || "").trim();
  const status = (sp.get("status") || "all").trim(); // all | used | unused
  const pageRaw = parseInt(sp.get("page") || "1", 10);
  const pageSizeRaw = parseInt(sp.get("pageSize") || "20", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(pageSizeRaw, 100) : 20;
  const offset = (page - 1) * pageSize;

  const filters = [];
  if (status === "used") {
    filters.push(sql`${inviteCodes.usedById} IS NOT NULL`);
  } else if (status === "unused") {
    filters.push(sql`${inviteCodes.usedById} IS NULL`);
  }
  if (search) {
    const term = `%${search}%`;
    filters.push(or(like(inviteCodes.code, term)));
  }
  const where = filters.length === 0 ? undefined : filters.length === 1 ? filters[0] : sql.join(filters, sql` AND `);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(inviteCodes)
    .where(where as unknown as undefined);
  const total = totalRow?.count ?? 0;

  const rows = await db
    .select({
      id: inviteCodes.id,
      code: inviteCodes.code,
      createdById: inviteCodes.createdById,
      usedById: inviteCodes.usedById,
      usedAt: inviteCodes.usedAt,
      createdAt: inviteCodes.createdAt,
      creatorEmail: users.email,
      creatorName: users.name,
    })
    .from(inviteCodes)
    .leftJoin(users, eq(inviteCodes.createdById, users.id))
    .where(where as unknown as undefined)
    .orderBy(desc(inviteCodes.createdAt))
    .limit(pageSize)
    .offset(offset);

  return NextResponse.json({
    codes: rows.map((r) => ({
      id: r.id,
      code: r.code,
      creator: r.creatorEmail
        ? { id: r.createdById, email: r.creatorEmail, name: r.creatorName }
        : null,
      used: !!r.usedById,
      usedById: r.usedById,
      usedAt: r.usedAt,
      createdAt: r.createdAt,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}
