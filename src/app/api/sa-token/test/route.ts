import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { isSaTokenEnabled, getSaTokenConfig } from "@/lib/auth/sa-token";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  if (!isSaTokenEnabled()) {
    return NextResponse.json({ success: false, message: "SSO not configured" });
  }

  try {
    const config = getSaTokenConfig();
    const res = await fetch(`${config.endpoint}/sso/isSso`, {
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      return NextResponse.json({ success: true, message: "SSO server reachable" });
    }

    return NextResponse.json({
      success: false,
      message: `SSO server returned ${res.status}`,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "Connection failed",
    });
  }
}
