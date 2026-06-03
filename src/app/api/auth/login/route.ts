import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth/password";
import { generateTokenPair } from "@/lib/auth/tokens";
import { isEmailVerificationRequired, isAdmin } from "@/lib/auth/settings";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    // 查找用户
    const user = db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // 验证密码
    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // 检查账号是否被禁用
    if (user.disabled === 1) {
      return NextResponse.json(
        { error: "Account has been disabled. Please contact the administrator." },
        { status: 403 }
      );
    }

    // 检查邮箱验证要求
    if (isEmailVerificationRequired() && user.emailVerified !== 1) {
      return NextResponse.json(
        {
          error: "Email verification required",
          needVerification: true,
        },
        { status: 403 }
      );
    }

    // 签发 token
    const { accessToken, refreshToken } = await generateTokenPair(
      user.id,
      user.email
    );

    // 构建响应
    const response = NextResponse.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified === 1,
        accountType: user.accountType,
        isAdmin: isAdmin(user.id),
      },
    });

    // 设置 HttpOnly cookie 用于 middleware 页面保护
    response.cookies.set("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24h
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[auth] Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
