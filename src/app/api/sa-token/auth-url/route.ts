import { NextRequest, NextResponse } from "next/server";
import { isSaTokenEnabled, getAuthUrl } from "@/lib/auth/sa-token";
import { getAppUrl } from "@/lib/auth/env";

export async function GET(req: NextRequest) {
  if (!isSaTokenEnabled()) {
    return NextResponse.json({ error: "SSO not enabled" }, { status: 400 });
  }

  const callbackUrl = `${getAppUrl()}/login`;
  const authUrl = getAuthUrl(callbackUrl);

  return NextResponse.json({ url: authUrl });
}
