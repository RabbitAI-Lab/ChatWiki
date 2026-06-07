import { registerProvider } from "./registry";
import { getProviderConfig } from "./config";
import { StripeProvider, STRIPE_CONFIG_SCHEMA } from "./providers/stripe";
import type { ProviderConfigField } from "./types";

/**
 * 初始化并注册所有已启用的支付提供商。
 * 在服务启动时调用一次；后台修改配置后可再次调用刷新。
 */
export function initProviders(): void {
  const knownProviders = ["stripe" /* , "paypal", "alipay" */];

  for (const name of knownProviders) {
    try {
      const config = getProviderConfig(name);
      if (!config) continue;

      switch (name) {
        case "stripe":
          registerProvider(new StripeProvider(config));
          console.log(`[payment] Registered provider: ${name}`);
          break;
        // case "paypal": registerProvider(new PayPalProvider(config)); break;
      }
    } catch (err) {
      console.error(`[payment] Failed to register provider "${name}":`, err);
    }
  }
}

export { getProvider, getAvailableProviders, isProviderAvailable } from "./registry";
export type * from "./types";

/**
 * 获取所有已知 provider 的配置 schema（用于后台管理页面）。
 */
export function getKnownProviderSchemas(): Array<{
  name: string;
  fields: ProviderConfigField[];
}> {
  const schemas: Array<{ name: string; fields: ProviderConfigField[] }> = [];
  // Stripe
  schemas.push({ name: "stripe", fields: STRIPE_CONFIG_SCHEMA });
  // 后续添加:
  // schemas.push({ name: "paypal", fields: PAYPAL_CONFIG_SCHEMA });
  return schemas;
}
