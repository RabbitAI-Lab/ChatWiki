import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth/password";
import { generateTokenPair } from "@/lib/auth/tokens";
import { isEmailVerificationRequired, isAdmin } from "@/lib/auth/settings";
import { getApiT } from "@/lib/i18n-api";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const t = await getApiT();
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
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (!user) {
      return NextResponse.json(
        { error: t('api.auth.invalidCredentials') },
        { status: 401 }
      );
    }

    // 验证密码
    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json(
        { error: t('api.auth.invalidCredentials') },
        { status: 401 }
      );
    }

    // 检查账号是否被禁用
    if (user.disabled === true) {
      return NextResponse.json(
        { error: t('api.auth.accountDisabled') },
        { status: 403 }
      );
    }

    // 检查邮箱验证要求
    if (await isEmailVerificationRequired() && user.emailVerified !== true) {
      return NextResponse.json(
        {
          error: t('api.auth.emailVerificationRequired'),
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
        emailVerified: user.emailVerified === true,
        accountType: user.accountType,
        isAdmin: await isAdmin(user.id),
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
      { error: t('api.internalError') },
      { status: 500 }
    );
  }
}
