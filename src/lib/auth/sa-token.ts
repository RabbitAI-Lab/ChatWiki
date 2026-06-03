import { getSetting } from "./settings";
import { generateTokenPair } from "./tokens";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

interface SaTokenConfig {
  enabled: boolean;
  endpoint: string;
  secretkey: string;
  timeout: number;
}

export function getSaTokenConfig(): SaTokenConfig {
  return {
    enabled: getSetting("satoken_enabled") === "true",
    endpoint: getSetting("satoken_endpoint") || "",
    secretkey: getSetting("satoken_secretkey") || "",
    timeout: parseInt(getSetting("satoken_timeout") || "86400", 10),
  };
}

export function isSaTokenEnabled(): boolean {
  const config = getSaTokenConfig();
  return config.enabled && !!config.endpoint && !!config.secretkey;
}

export function getAuthUrl(callbackUrl: string): string {
  const config = getSaTokenConfig();
  return `${config.endpoint}/sso/auth?redirect=${encodeURIComponent(callbackUrl)}`;
}

export async function checkTicket(ticket: string): Promise<{
  success: boolean;
  loginId?: string;
  error?: string;
}> {
  const config = getSaTokenConfig();
  const url = `${config.endpoint}/sso/checkTicket?ticket=${encodeURIComponent(ticket)}&secretkey=${encodeURIComponent(config.secretkey)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.code === 200 || data.code === "200") {
      return {
        success: true,
        loginId: String(data.data?.loginId || data.data?.loginid || data.loginId || ""),
      };
    }

    return {
      success: false,
      error: data.msg || data.message || "Ticket validation failed",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export async function handleCallback(ticket: string): Promise<{
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
    accountType: string;
    isAdmin: boolean;
  };
} | null> {
  // 验证 ticket
  const result = await checkTicket(ticket);
  if (!result.success || !result.loginId) {
    console.error("[sa-token] Ticket validation failed:", result.error);
    return null;
  }

  const loginId = result.loginId;
  const { isAdmin } = await import("./settings");

  // 查找或创建用户
  let user = db
    .select()
    .from(users)
    .where(eq(users.satokenLoginId, loginId))
    .get();

  if (!user) {
    // 自动创建用户
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const email = `${loginId}@sso.local`;

    db.insert(users)
      .values({
        id: userId,
        email,
        passwordHash: "", // SSO 用户无密码
        name: loginId,
        emailVerified: 1,
        accountType: "personal",
        satokenLoginId: loginId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    user = db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();
  }

  if (!user) return null;

  // 签发 JWT
  const tokens = await generateTokenPair(user.id, user.email);

  return {
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
  };
}

export async function saTokenLogout(loginId: string): Promise<void> {
  const config = getSaTokenConfig();
  if (!config.enabled || !config.endpoint) return;

  try {
    const url = `${config.endpoint}/sso/logout?loginId=${encodeURIComponent(loginId)}&secretkey=${encodeURIComponent(config.secretkey)}`;
    await fetch(url);
  } catch (error) {
    console.error("[sa-token] Logout notification failed:", error);
  }
}
