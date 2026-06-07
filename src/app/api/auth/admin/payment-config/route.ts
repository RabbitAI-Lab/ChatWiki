import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { getSetting, setSetting } from "@/lib/auth/settings";
import { STRIPE_CONFIG_SCHEMA } from "@/lib/payment/providers/stripe";
import type { ProviderConfigField } from "@/lib/payment/types";

const KNOWN_PROVIDERS: Array<{ name: string; fields: ProviderConfigField[] }> = [
  { name: "stripe", fields: STRIPE_CONFIG_SCHEMA },
];

const SENSITIVE_FIELDS = new Set(["secretKey", "webhookSecret", "clientSecret", "apiKey"]);

const GENERAL_CONFIG_FIELDS = [
  { key: "checkout_timeout_hours", label: "Checkout Timeout (hours)", type: "number", defaultValue: "24" },
  { key: "refund_deadline_days", label: "Refund Deadline (days)", type: "number", defaultValue: "30" },
  { key: "renewal_reminder_days", label: "Renewal Reminder (days before)", type: "number", defaultValue: "5" },
  { key: "pending_reminder_interval_hours", label: "Reminder Interval (hours)", type: "number", defaultValue: "6" },
  { key: "pending_reminder_max_count", label: "Max Reminders", type: "number", defaultValue: "3" },
  { key: "refund_admin_emails", label: "Refund Admin Emails", type: "text", defaultValue: "" },
];

// GET: 返回所有渠道配置状态
export async function GET() {
  const providers = KNOWN_PROVIDERS.map((p) => {
    const enabled = getSetting(`payment_provider_${p.name}_enabled`) === "true";
    const configValues: Record<string, unknown> = {};
    for (const field of p.fields) {
      const val = getSetting(`payment_provider_${p.name}_${field.key}`);
      if (SENSITIVE_FIELDS.has(field.key)) {
        configValues[field.key] = val ? "••••••••" : "";
        (configValues as Record<string, unknown>)[`${field.key}HasValue`] = !!val;
      } else if (field.type === "switch") {
        configValues[field.key] = val === "true";
      } else {
        configValues[field.key] = val || "";
      }
    }
    return {
      name: p.name,
      enabled,
      fields: p.fields,
      values: configValues,
      webhookUrl: p.name === "stripe"
        ? `${getSetting("site_url") || process.env.NEXT_PUBLIC_APP_URL || ""}/api/webhooks/stripe`
        : undefined,
    };
  });

  const generalConfig: Record<string, string> = {};
  for (const field of GENERAL_CONFIG_FIELDS) {
    generalConfig[field.key] = getSetting(`payment_${field.key}`) || field.defaultValue;
  }

  return NextResponse.json({ providers, generalConfig, generalFields: GENERAL_CONFIG_FIELDS });
}

// PATCH: 保存渠道配置
export async function PATCH(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json();
  const { provider, config, general } = body as {
    provider?: string;
    config?: Record<string, unknown>;
    general?: Record<string, string>;
  };

  if (provider && config) {
    // 保存渠道配置
    const knownProvider = KNOWN_PROVIDERS.find((p) => p.name === provider);
    if (!knownProvider) {
      return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    // 启用/禁用
    setSetting(`payment_provider_${provider}_enabled`, config.enabled ? "true" : "false");

    // 保存各字段
    for (const field of knownProvider.fields) {
      const val = config[field.key];
      if (val === undefined) continue;

      // 敏感字段：空字符串表示保持不变
      if (SENSITIVE_FIELDS.has(field.key) && val === "") continue;

      const strVal = field.type === "switch" ? (val ? "true" : "false") : String(val);
      setSetting(`payment_provider_${provider}_${field.key}`, strVal);
    }

    // 重新注册 provider
    try {
      const { initProviders } = await import("@/lib/payment");
      initProviders();
    } catch (err) {
      console.error("[payment-config] Failed to re-init providers:", err);
    }
  }

  if (general) {
    // 保存通用配置
    for (const [key, value] of Object.entries(general)) {
      setSetting(`payment_${key}`, value);
    }
  }

  return NextResponse.json({ success: true });
}

// POST: 测试连接
export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  const { provider } = await req.json() as { provider: string };

  if (provider === "stripe") {
    try {
      const Stripe = (await import("stripe")).default;
      const secretKey = getSetting("payment_provider_stripe_secretKey") || process.env.STRIPE_SECRET_KEY || "";
      if (!secretKey) {
        return NextResponse.json({ success: false, message: "Stripe Secret Key not configured" });
      }
      const stripe = new Stripe(secretKey, { apiVersion: "2026-05-27.dahlia" });
      await stripe.products.list({ limit: 1 });
      return NextResponse.json({ success: true, message: "Successfully connected to Stripe" });
    } catch (error) {
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      });
    }
  }

  return NextResponse.json({ success: false, message: `Test not supported for ${provider}` });
}
