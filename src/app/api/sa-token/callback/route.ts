import { NextRequest, NextResponse } from "next/server";
import { handleCallback } from "@/lib/auth/sa-token";

export async function GET(req: NextRequest) {
  const ticket = req.nextUrl.searchParams.get("ticket");

  if (!ticket) {
    return NextResponse.json({ error: "Missing ticket parameter" }, { status: 400 });
  }

  const result = await handleCallback(ticket);

  if (!result) {
    return NextResponse.json(
      { error: "SSO authentication failed" },
      { status: 401 }
    );
  }

  const response = NextResponse.redirect(new URL("/", req.url));

  response.cookies.set("access_token", result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  // 同时返回 JSON 给前端使用
  return NextResponse.json({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  });
}
