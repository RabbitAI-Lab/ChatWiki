import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq, like, or, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  const sp = req.nextUrl.searchParams;
  const search = (sp.get("search") || "").trim();
  const pageRaw = parseInt(sp.get("page") || "1", 10);
  const pageSizeRaw = parseInt(sp.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10);
  const status = (sp.get("status") || "all").trim(); // all | active | disabled | verified | unverified
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
      ? Math.min(pageSizeRaw, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const filters = [];
  if (search) {
    const term = `%${search}%`;
    filters.push(or(like(users.email, term), like(users.name, term)));
  }
  if (status === "active") {
    filters.push(eq(users.disabled, 0));
  } else if (status === "disabled") {
    filters.push(eq(users.disabled, 1));
  } else if (status === "verified") {
    filters.push(eq(users.emailVerified, 1));
  } else if (status === "unverified") {
    filters.push(eq(users.emailVerified, 0));
  }

  const where = filters.length === 0 ? undefined : filters.length === 1 ? filters[0] : and(...filters);

  const totalRow = db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(where)
    .get();
  const total = totalRow?.count ?? 0;

  const rows = db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      emailVerified: users.emailVerified,
      disabled: users.disabled,
      accountType: users.accountType,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(where)
    .orderBy(sql`${users.createdAt} DESC`)
    .limit(pageSize)
    .offset(offset)
    .all();

  return NextResponse.json({
    users: rows.map((r) => ({
      ...r,
      emailVerified: r.emailVerified === 1,
      disabled: r.disabled === 1,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}
