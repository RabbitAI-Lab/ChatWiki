import Stripe from "stripe";
import type {
  PaymentProvider,
  CheckoutParams,
  CheckoutResult,
  PortalParams,
  PortalResult,
  StandardWebhookEvent,
  RefundParams,
  RefundResult,
  ProviderConfigField,
  ProviderConfig,
} from "../types";
import { getProviderConfig } from "../config";

export const STRIPE_CONFIG_SCHEMA: ProviderConfigField[] = [
  { key: "secretKey", label: "Secret Key", type: "password", required: true, placeholder: "sk_live_..." },
  { key: "webhookSecret", label: "Webhook Secret", type: "password", required: true, placeholder: "whsec_..." },
  { key: "testMode", label: "Test Mode", type: "switch", defaultValue: true },
];

export class StripeProvider implements PaymentProvider {
  readonly name = "stripe";
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  private getStripeClient(): Stripe {
    const secretKey = (this.config.secretKey as string) || process.env.STRIPE_SECRET_KEY || "";
    return new Stripe(secretKey, { apiVersion: "2026-05-27.dahlia" });
  }

  getConfigSchema(): ProviderConfigField[] {
    return STRIPE_CONFIG_SCHEMA;
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const stripe = this.getStripeClient();
    const providerConfig = params.providerConfig as {
      productId?: string;
      monthlyPriceId?: string;
      yearlyPriceId?: string;
    };

    const priceId = params.billingCycle === "monthly"
      ? providerConfig.monthlyPriceId
      : providerConfig.yearlyPriceId;

    if (!priceId) {
      throw new Error(`Stripe price ID not configured for ${params.billingCycle} billing cycle`);
    }

    // Create or retrieve customer
    let customerId = params.providerConfig.customerId as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: params.userEmail,
        name: params.userName || undefined,
        metadata: { userId: params.userId },
      });
      customerId = customer.id;
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: params.billingMode === "subscription" ? "subscription" : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        orderId: params.orderId,
        userId: params.userId,
        planId: String(params.planId),
        billingCycle: params.billingCycle,
        paymentMode: params.billingMode,
      },
      ...(params.billingMode === "subscription" && {
        subscription_data: {
          metadata: {
            orderId: params.orderId,
            userId: params.userId,
            planId: String(params.planId),
            billingCycle: params.billingCycle,
          },
        },
      }),
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return {
      url: session.url || "",
      providerSessionId: session.id,
      providerCustomerId: customerId,
    };
  }

  async createPortalSession(params: PortalParams): Promise<PortalResult> {
    const stripe = this.getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: params.providerCustomerId,
      return_url: params.returnUrl,
    });
    return { url: session.url };
  }

  async verifyAndParseWebhook(body: string | Buffer, signature: string): Promise<StandardWebhookEvent> {
    const stripe = this.getStripeClient();
    const webhookSecret = (this.config.webhookSecret as string) || process.env.STRIPE_WEBHOOK_SECRET || "";

    const event = stripe.webhooks.constructEvent(
      typeof body === "string" ? Buffer.from(body) : body,
      signature,
      webhookSecret,
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        return {
          type: "checkout_completed",
          providerEventId: event.id,
          orderId: session.metadata?.orderId,
          userId: session.metadata?.userId,
          planId: session.metadata?.planId ? parseInt(session.metadata.planId, 10) : undefined,
          billingCycle: session.metadata?.billingCycle as "monthly" | "yearly" | undefined,
          providerPaymentId: session.payment_intent as string | undefined,
          providerSubscriptionId: session.subscription as string | undefined,
          providerCustomerId: session.customer as string | undefined,
          raw: event,
        };
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const eventType = event.type === "customer.subscription.created"
          ? "subscription_created"
          : "subscription_renewed";
        return {
          type: eventType,
          providerEventId: event.id,
          userId: sub.metadata?.userId,
          planId: sub.metadata?.planId ? parseInt(sub.metadata.planId, 10) : undefined,
          billingCycle: sub.metadata?.billingCycle as "monthly" | "yearly" | undefined,
          providerSubscriptionId: sub.id,
          providerCustomerId: sub.customer as string,
          raw: event,
        };
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        return {
          type: "subscription_cancelled",
          providerEventId: event.id,
          userId: sub.metadata?.userId,
          providerSubscriptionId: sub.id,
          providerCustomerId: sub.customer as string,
          raw: event,
        };
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        return {
          type: "payment_failed",
          providerEventId: event.id,
          providerCustomerId: invoice.customer as string | undefined,
          providerInvoiceId: invoice.id,
          amount: invoice.amount_due ?? undefined,
          currency: invoice.currency?.toUpperCase(),
          raw: event,
        };
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const refundObj = charge.refunds?.data[0];
        return {
          type: "refund_completed",
          providerEventId: event.id,
          providerPaymentId: charge.payment_intent as string | undefined,
          providerChargeId: charge.id,
          providerRefundId: refundObj?.id,
          amount: refundObj?.amount ?? undefined,
          currency: charge.currency?.toUpperCase(),
          raw: event,
        };
      }
      default:
        return {
          type: "checkout_completed", // fallback
          providerEventId: event.id,
          raw: event,
        };
    }
  }

  async createRefund(params: RefundParams): Promise<RefundResult> {
    const stripe = this.getStripeClient();
    const refund = await stripe.refunds.create({
      payment_intent: params.providerPaymentId,
      amount: params.amount,
      reason: params.reason === "duplicate" ? "duplicate" :
              params.reason === "fraudulent" ? "fraudulent" :
              "requested_by_customer",
    });
    return {
      providerRefundId: refund.id,
      status: refund.status || "pending",
      amount: refund.amount,
    };
  }

  async cancelSubscription(providerSubscriptionId: string): Promise<void> {
    const stripe = this.getStripeClient();
    await stripe.subscriptions.cancel(providerSubscriptionId);
  }
}

// ── Dynamic config reload ──
// Provider 实例在创建时缓存配置。后台修改配置后需重新注册。
// 这在 index.ts 的 initProviders() 中处理。

export async function createStripeProviderFromConfig(): Promise<StripeProvider | null> {
  const config = await getProviderConfig("stripe");
  if (!config) return null;
  return new StripeProvider(config);
}
