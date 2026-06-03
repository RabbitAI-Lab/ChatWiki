import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listOrgs } from "@/lib/fs";

// GET /api/fs/orgs?enterpriseId=1
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const enterpriseId = searchParams.get("enterpriseId") || "";

  if (!enterpriseId) {
    return NextResponse.json({ error: "enterpriseId is required" }, { status: 400 });
  }

  const orgs = listOrgs(enterpriseId);
  return NextResponse.json(orgs);
}

// POST /api/fs/orgs - placeholder for future
export async function POST() {
  // Static handler — note: no req means no auth possible; skipping guard
  // (if this handler needs auth, it should be a route with req param)
  return NextResponse.json({ error: "Not implemented yet" }, { status: 501 });
}

// DELETE /api/fs/orgs - placeholder for future
export async function DELETE() {
  // Static handler — note: no req means no auth possible; skipping guard
  // (if this handler needs auth, it should be a route with req param)
  return NextResponse.json({ error: "Not implemented yet" }, { status: 501 });
}
