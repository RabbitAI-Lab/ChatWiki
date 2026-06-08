import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users, inviteCodes, apiKeys } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { generateTokenPair } from "@/lib/auth/tokens";
import { isInitialized, setSetting } from "@/lib/auth/settings";
import crypto from "crypto";
import { getApiT } from "@/lib/i18n-api";

const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  const t = await getApiT();
  try {
    // 检查是否已初始化
    if (await isInitialized()) {
      return NextResponse.json(
        { error: t('api.auth.systemAlreadyInitialized') },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = setupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    // 创建管理员用户
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);

    await db.insert(users)
      .values({
        id: userId,
        email,
        passwordHash,
        name: "Admin",
        emailVerified: true, // 管理员无需验证
        accountType: "personal",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      });

    // 设置管理员 ID
    await setSetting("admin_user_id", userId);

    // 设置默认系统设置
    await setSetting("open_registration", "true");
    await setSetting("require_invite_code", "false");
    await setSetting("require_email_verification", "false");

    // 生成初始邀请码
    const initialCode = crypto.randomBytes(4).toString("hex");
    await db.insert(inviteCodes)
      .values({
        id: crypto.randomUUID(),
        code: initialCode,
        createdById: userId,
        createdAt: now,
      });

    // 创建系统 API Key（用于 MCP）
    const apiKeyValue = `atm_${crypto.randomUUID().replace(/-/g, "")}`;
    await db.insert(apiKeys)
      .values({
        id: crypto.randomUUID(),
        name: "System Key (MCP)",
        keyField: apiKeyValue,
        prefix: apiKeyValue.slice(0, 8),
        userId,
        isSystem: true,
        createdAt: now,
      });

    // 签发 token
    const tokens = await generateTokenPair(userId, email);

    const response = NextResponse.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: userId,
        email,
        name: "Admin",
        emailVerified: true,
        accountType: "personal",
        isAdmin: true,
      },
      inviteCode: initialCode,
    });

    response.cookies.set("access_token", tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[auth] Setup error:", error);
    return NextResponse.json(
      { error: t('api.internalError') },
      { status: 500 }
    );
  }
}
