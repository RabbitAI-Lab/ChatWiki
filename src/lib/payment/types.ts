// ── Payment Provider Core Types ──

export interface PaymentProvider {
  readonly name: string; // "stripe" | "paypal" | "alipay" | ...

  /** 创建支付会话（返回跳转 URL） */
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;

  /** 创建客户门户会话（管理订阅） */
  createPortalSession?(params: PortalParams): Promise<PortalResult>;

  /** 验证 Webhook 签名并返回标准化事件 */
  verifyAndParseWebhook(body: string | Buffer, signature: string): Promise<StandardWebhookEvent>;

  /** 执行退款 */
  createRefund(params: RefundParams): Promise<RefundResult>;

  /** 取消订阅 */
  cancelSubscription?(providerSubscriptionId: string): Promise<void>;

  /** Provider 配置字段 schema（用于后台管理页面动态渲染） */
  getConfigSchema?(): ProviderConfigField[];
}

export interface CheckoutParams {
  userId: string;
  userEmail: string;
  userName: string | null;
  planId: number;
  planTitle: string;
  billingCycle: "monthly" | "yearly";
  billingMode: "subscription" | "one_time";
  orderId: string;
  currency: string;
  amount: number; // 分
  originalAmount: number; // 分
  providerConfig: Record<string, unknown>; // plans.providerPrices[providerName]
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  url: string;
  providerSessionId: string;
  providerCustomerId?: string;
}

export interface PortalParams {
  providerCustomerId: string;
  returnUrl: string;
}

export interface PortalResult {
  url: string;
}

export type WebhookEventType =
  | "checkout_completed"
  | "subscription_created"
  | "subscription_renewed"
  | "subscription_cancelled"
  | "payment_failed"
  | "refund_completed";

export interface StandardWebhookEvent {
  type: WebhookEventType;
  providerEventId: string;
  orderId?: string;
  userId?: string;
  planId?: number;
  billingCycle?: "monthly" | "yearly";
  providerPaymentId?: string;
  providerChargeId?: string;
  providerSubscriptionId?: string;
  providerCustomerId?: string;
  providerInvoiceId?: string;
  amount?: number;
  currency?: string;
  refundId?: string;
  providerRefundId?: string;
  raw: unknown;
}

export interface RefundParams {
  providerPaymentId: string;
  amount: number; // 退款金额(分)
  reason?: string;
}

export interface RefundResult {
  providerRefundId: string;
  status: string;
  amount: number;
}

// ── Provider Config Schema (后台管理页面) ──

export interface ProviderConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "switch" | "number";
  required?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  description?: string;
}

export interface ProviderConfig {
  enabled: boolean;
  [key: string]: unknown;
}
