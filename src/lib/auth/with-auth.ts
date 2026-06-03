/**
 * Helper to add authentication to API route handlers.
 *
 * Usage in a route.ts file:
 *
 *   import { withAuth } from "@/lib/auth/with-auth";
 *
 *   export const GET = withAuth(async (req, user) => {
 *     // user is authenticated, proceed with original logic
 *     return NextResponse.json({ data: "..." });
 *   });
 *
 * For admin-only routes:
 *   export const GET = withAuth(async (req, user) => { ... }, { requireAdmin: true });
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireAdmin } from "@/lib/auth/session";
import type { AuthUser } from "./session";

type HandlerFn = (
  req: NextRequest,
  user: AuthUser,
  ctx?: unknown
) => Promise<NextResponse> | NextResponse;

interface WithAuthOptions {
  requireAdmin?: boolean;
}

export function withAuth(handler: HandlerFn, options?: WithAuthOptions) {
  return async (req: NextRequest, ctx?: unknown): Promise<NextResponse> => {
    const authResult = options?.requireAdmin
      ? await requireAdmin(req)
      : await requireAuth(req);

    if (authResult instanceof NextResponse) {
      return authResult; // 401 or 403
    }

    return handler(req, authResult, ctx);
  };
}
