import { NextRequest, NextResponse } from "next/server";
import { verifyToken, type AccessTokenPayload } from "./tokens";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  accountType: string;
  enterpriseId: string | null;
  isAdmin: boolean;
  role: "admin" | "user";
}

/**
 * Extract user from Authorization: Bearer <token> header.
 * Returns null if no valid token found.
 */
export async function getUserFromRequest(
  req: NextRequest
): Promise<AuthUser | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "access") {
    return null;
  }

  const userId = payload.sub;
  const row = db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    emailVerified: row.emailVerified === 1,
    accountType: row.accountType,
    enterpriseId: row.enterpriseId,
    role: row.role as "admin" | "user",
    isAdmin: row.role === "admin",
  };
}

/**
 * Require authentication. Returns user or 401 NextResponse.
 * Use at the top of API route handlers:
 *
 *   const authResult = await requireAuth(req);
 *   if (authResult instanceof NextResponse) return authResult;
 *   const user = authResult;
 */
export async function requireAuth(
  req: NextRequest
): Promise<AuthUser | NextResponse> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

/**
 * Optional authentication. Returns user if token is valid, null otherwise.
 * Does not throw or return error responses.
 */
export async function optionalAuth(
  req: NextRequest
): Promise<AuthUser | null> {
  return getUserFromRequest(req);
}

/**
 * Require admin authentication. Returns user or 401/403 NextResponse.
 */
export async function requireAdmin(
  req: NextRequest
): Promise<AuthUser | NextResponse> {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  if (!authResult.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return authResult;
}
