import { getSetting } from "@/lib/auth/settings";
import type { ProviderConfig } from "./types";

const PROVIDER_CONFIG_PREFIX = "payment_provider_";

/**
 * 读取某个支付渠道的完整配置。
 * 未启用时返回 null。
 */
export async function getProviderConfig(providerName: string): Promise<ProviderConfig | null> {
  const enabled = await getSetting(`${PROVIDER_CONFIG_PREFIX}${providerName}_enabled`);
  if (enabled !== "true") return null;

  const config: ProviderConfig = { enabled: true };

  // 读取环境变量作为 fallback
  const envFallback: Record<string, Record<string, string>> = {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || "",
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    },
  };

  // 读取已知字段
  const knownFields: Record<string, string[]> = {
    stripe: ["secretKey", "webhookSecret", "testMode"],
    paypal: ["clientId", "clientSecret", "webhookId"],
  };

  const fields = knownFields[providerName] || [];
  for (const field of fields) {
    const dbKey = `${PROVIDER_CONFIG_PREFIX}${providerName}_${field}`;
    const dbVal = await getSetting(dbKey);
    if (dbVal !== null) {
      config[field] = dbVal;
    } else if (envFallback[providerName]?.[field]) {
      config[field] = envFallback[providerName][field];
    }
  }

  return config;
}

/**
 * 读取通用支付配置项。
 */
export async function getPaymentConfig(key: string, defaultValue: string): Promise<string> {
  return (await getSetting(`payment_${key}`)) || defaultValue;
}

/**
 * 获取退款管理员邮箱列表。
 */
export async function getRefundAdminEmails(): Promise<string[]> {
  const raw = (await getSetting("payment_refund_admin_emails")) || "";
  return raw.split(",").map(e => e.trim()).filter(Boolean);
}

/**
 * 获取 Checkout 超时时间（小时）。
 */
export async function getCheckoutTimeoutHours(): Promise<number> {
  return parseInt(await getPaymentConfig("checkout_timeout_hours", "24"), 10);
}

/**
 * 获取退款截止天数。
 */
export async function getRefundDeadlineDays(): Promise<number> {
  return parseInt(await getPaymentConfig("refund_deadline_days", "30"), 10);
}

/**
 * 获取续费预告提前天数。
 */
export async function getRenewalReminderDays(): Promise<number> {
  return parseInt(await getPaymentConfig("renewal_reminder_days", "5"), 10);
}

/**
 * 获取催付间隔（小时）。
 */
export async function getPendingReminderIntervalHours(): Promise<number> {
  return parseInt(await getPaymentConfig("pending_reminder_interval_hours", "6"), 10);
}

/**
 * 获取催付最大次数（不含首次即时通知）。
 */
export async function getPendingReminderMaxCount(): Promise<number> {
  return parseInt(await getPaymentConfig("pending_reminder_max_count", "3"), 10);
}
