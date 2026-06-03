import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyToken, generateTokenPair } from "@/lib/auth/tokens";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/auth/settings";

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = refreshSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Refresh token is required" },
        { status: 400 }
      );
    }

    const { refreshToken } = parsed.data;

    // 验证 refresh token
    const payload = await verifyToken(refreshToken);
    if (!payload || payload.type !== "refresh") {
      return NextResponse.json(
        { error: "Invalid refresh token" },
        { status: 401 }
      );
    }

    // 确认用户仍存在
    const user = db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .get();

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 401 }
      );
    }

    // 签发新 token 对
    const tokens = await generateTokenPair(user.id, user.email);

    const response = NextResponse.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified === 1,
        accountType: user.accountType,
        isAdmin: isAdmin(user.id),
      },
    });

    // 更新 HttpOnly cookie
    response.cookies.set("access_token", tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[auth] Refresh error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
