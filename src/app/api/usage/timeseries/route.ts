import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { tokenUsageLogs } from "@/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/usage/timeseries?range=1h|6h|24h|7d|30d
// 返回 TPM/RPM 时间序列数据
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const range = req.nextUrl.searchParams.get("range") || "24h";

  // 根据范围确定时间起点和分桶粒度
  const now = new Date();
  let since: Date;
  let bucketMinutes: number;

  switch (range) {
    case "1h":
      since = new Date(now.getTime() - 60 * 60 * 1000);
      bucketMinutes = 5;
      break;
    case "6h":
      since = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      bucketMinutes = 30;
      break;
    case "7d":
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      bucketMinutes = 60 * 24; // 按天
      break;
    case "30d":
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      bucketMinutes = 60 * 24; // 按天
      break;
    default: // 24h
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      bucketMinutes = 60; // 按小时
      break;
  }

  const sinceStr = since.toISOString();

  // 使用 SQLite strftime 分桶
  // bucketMinutes 换算为秒用于分桶
  const bucketSeconds = bucketMinutes * 60;
  const bucketExpr = bucketMinutes >= 60 * 24
    ? `strftime('%Y-%m-%d', created_at)`  // 按天
    : bucketMinutes >= 60
      ? `strftime('%Y-%m-%dT%H:00', created_at)` // 按小时
      : `datetime((strftime('%s', created_at) / ${bucketSeconds}) * ${bucketSeconds}, 'unixepoch')`; // 按N分钟

  const rows = db
    .select({
      bucket: sql<string>`${sql.raw(bucketExpr)} as bucket`,
      tokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalTokens}), 0)`,
      requests: sql<number>`COUNT(*)`,
    })
    .from(tokenUsageLogs)
    .where(and(
      eq(tokenUsageLogs.userId, auth.id),
      gte(tokenUsageLogs.createdAt, sinceStr),
    ))
    .groupBy(sql.raw(bucketExpr))
    .orderBy(sql.raw(bucketExpr))
    .all();

  return NextResponse.json({
    range,
    granularity: bucketMinutes >= 60 * 24 ? "1d" : bucketMinutes >= 60 ? "1h" : `${bucketMinutes}m`,
    data: rows.map((r) => ({
      bucket: r.bucket,
      tokens: r.tokens,
      requests: r.requests,
    })),
  });
}
