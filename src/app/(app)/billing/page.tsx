"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/useAuth";
import {
  Card,
  Button,
  Tag,
  Spin,
  Empty,
  Typography,
  Segmented,
  App,
  Progress,
  Statistic,
  Tooltip,
  Tabs,
  Table,
  Input,
  Space,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  CrownOutlined,
  RocketOutlined,
  DashboardOutlined,
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

// ── Types ──

interface PlanFeature {
  name: string;
  included: boolean;
}

interface PlanPrice {
  currency: string;
  monthlyPrice: string;
  yearlyPrice: string;
}

interface Plan {
  id: number;
  title: string;
  description: string | null;
  defaultCurrency: string;
  prices: string; // JSON
  discountType: "none" | "percentage" | "fixed";
  discountValue: number;
  features: string; // JSON
  enabled: boolean;
  sortOrder: number;
  providerPrices?: string | null;
  billingMode?: string | null;
}

interface Subscription {
  id: string;
  planId: number;
  billingCycle: "monthly" | "yearly";
  status: string;
  startedAt: string;
  expiresAt: string;
  provider: string | null;
  providerCustomerId: string | null;
  planTitle: string;
  planDescription: string | null;
  planPrices: string;
  planFeatures: string;
  planDefaultCurrency: string;
  planSortOrder: number;
}

interface UsageSummary {
  subscription: {
    planId: number;
    planTitle: string;
    billingCycle: string;
    startedAt: string;
    expiresAt: string;
  } | null;
  quota: {
    limit: number;
    used: number;
    remaining: number;
    percentage: number;
    periodStart: string;
    unlimited: boolean;
  } | null;
  breakdown: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  };
  requestCount: number;
}

interface OrderRecord {
  id: string;
  planId: number;
  planTitle: string | null;
  amount: number;
  currency: string;
  billingCycle: string;
  paymentMode: string;
  provider: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  refunds: { id: string; amount: number; status: string; reason: string | null }[];
}

// ── Constants ──

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: "¥",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
};

const CYCLE_LABELS: Record<string, string> = {
  monthly: "/mo",
  yearly: "/yr",
};

// ── Helpers ──

function parseJSON<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function getDisplayPrice(
  plan: Plan,
  cycle: "monthly" | "yearly",
): { symbol: string; price: string; originalPrice?: string } {
  const prices = parseJSON<PlanPrice[]>(plan.prices, []);
  const priceObj = prices.find((p) => p.currency === plan.defaultCurrency) || prices[0];
  if (!priceObj) return { symbol: CURRENCY_SYMBOLS[plan.defaultCurrency] || "", price: "0" };

  const rawPrice = parseFloat(
    cycle === "monthly" ? priceObj.monthlyPrice : priceObj.yearlyPrice,
  );
  const symbol = CURRENCY_SYMBOLS[plan.defaultCurrency] || "";

  if (plan.discountType === "percentage" && plan.discountValue > 0) {
    const discounted = rawPrice * plan.discountValue / 100;
    return { symbol, price: discounted.toFixed(2), originalPrice: rawPrice.toFixed(2) };
  }
  if (plan.discountType === "fixed" && plan.discountValue > 0) {
    const discounted = rawPrice - plan.discountValue / 100;
    return { symbol, price: discounted.toFixed(2), originalPrice: rawPrice.toFixed(2) };
  }

  return { symbol, price: rawPrice.toFixed(2) };
}

function getYearlySaving(plan: Plan): string | null {
  const prices = parseJSON<PlanPrice[]>(plan.prices, []);
  const priceObj = prices.find((p) => p.currency === plan.defaultCurrency) || prices[0];
  if (!priceObj) return null;

  const monthly = parseFloat(priceObj.monthlyPrice);
  const yearly = parseFloat(priceObj.yearlyPrice);
  if (!monthly || !yearly || monthly <= 0) return null;

  const yearlyEquiv = monthly * 12;
  const saving = yearlyEquiv - yearly;
  if (saving <= 0) return null;

  const symbol = CURRENCY_SYMBOLS[plan.defaultCurrency] || "";
  return `${symbol}${saving.toFixed(0)}`;
}

// ── Component ──

export default function BillingPage() {
  const { user, authFetch } = useAuth();
  const { message, modal } = App.useApp();
  const t = useTranslations('billingPage');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [paymentAvailable, setPaymentAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<number | null>(null);
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [activeTab, setActiveTab] = useState("plans");
  const [orderHistory, setOrderHistory] = useState<{ orders: OrderRecord[]; total: number; page: number; pageSize: number }>({ orders: [], total: 0, page: 1, pageSize: 10 });
  const [orderLoading, setOrderLoading] = useState(false);

  // loadData is for button handlers (onOk refresh after subscribe).
  // Initial data fetch is done inline in useEffect below.
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [plansRes, subRes, usageRes] = await Promise.all([
        authFetch("/api/plans"),
        authFetch("/api/subscriptions"),
        authFetch("/api/usage/summary"),
      ]);
      if (plansRes.ok) {
        const plansResult = await plansRes.json();
        const plansData: Plan[] = plansResult.plans || plansResult;
        setPaymentAvailable(!!plansResult.paymentAvailable);
        setPlans(plansData.filter((p) => p.enabled === true));
      }
      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData.subscription);
      }
      if (usageRes.ok) {
        const usageData: UsageSummary = await usageRes.json();
        setUsageSummary(usageData);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user, authFetch]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      authFetch("/api/plans"),
      authFetch("/api/subscriptions"),
      authFetch("/api/usage/summary"),
    ]).then(([plansRes, subRes, usageRes]) => {
      if (cancelled) return;
      if (plansRes.ok) {
        plansRes.json().then((plansResult: { plans?: Plan[]; paymentAvailable?: boolean } | Plan[]) => {
          const plansData: Plan[] = (plansResult as { plans: Plan[] }).plans || plansResult as Plan[];
          if (!cancelled) {
            setPaymentAvailable(!!(plansResult as { paymentAvailable?: boolean }).paymentAvailable);
            setPlans(plansData.filter((p) => p.enabled === true));
          }
        });
      }
      if (subRes.ok) {
        subRes.json().then((subData) => {
          if (!cancelled) setSubscription(subData.subscription);
        });
      }
      if (usageRes.ok) {
        usageRes.json().then((usageData: UsageSummary) => {
          if (!cancelled) setUsageSummary(usageData);
        });
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user, authFetch]);

  const loadOrders = useCallback(async (p = 1) => {
    if (!user) return;
    setOrderLoading(true);
    try {
      const res = await authFetch(`/api/orders?page=${p}&pageSize=${orderHistory.pageSize}`);
      if (res.ok) {
        const data = await res.json();
        setOrderHistory(data);
      }
    } catch {
      // ignore
    } finally {
      setOrderLoading(false);
    }
  }, [user, authFetch, orderHistory.pageSize]);

  useEffect(() => { if (user && activeTab === "history") Promise.resolve().then(() => loadOrders(1)); }, [user, activeTab, loadOrders]);

  const handleSubscribe = async (plan: Plan) => {
    setSubscribing(plan.id);
    try {
      // 判断是否走 Stripe 支付
      let hasStripeConfig = false;
      try {
        const pp = JSON.parse(plan.providerPrices || "{}");
        hasStripeConfig = !!(pp.stripe?.monthlyPriceId || pp.stripe?.yearlyPriceId);
      } catch {}

      if (hasStripeConfig && paymentAvailable) {
        // 走 Stripe Checkout
        const res = await authFetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: plan.id, billingCycle }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            window.location.assign(data.url);
            return;
          }
        } else {
          const data = await res.json();
          message.error(data.error || t('failedToSubscribe'));
        }
      } else {
        // 回退：直接订阅
        const res = await authFetch("/api/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: plan.id, billingCycle }),
        });
        if (res.ok) {
          message.success("Subscription successful");
          loadData();
        } else {
          const data = await res.json();
          message.error(data.error || t('failedToSubscribe'));
        }
      }
    } catch {
      message.error(t('failedToSubscribe'));
    } finally {
      setSubscribing(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const res = await authFetch("/api/checkout/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.assign(data.url);
      } else {
        message.error(data.error || "Failed to open subscription management");
      }
    } catch {
      message.error("Failed to open subscription management");
    }
  };

  const handleRefundRequest = (orderId: string) => {
    modal.confirm({
      title: "Request Refund",
      content: (
        <div>
          <p className="mb-2">Please describe the reason for your refund request:</p>
          <Input.TextArea id="refund-reason-input" rows={3} placeholder="Reason..." />
        </div>
      ),
      okText: "Submit",
      onOk: async () => {
        const reasonEl = document.getElementById("refund-reason-input") as HTMLTextAreaElement;
        const reason = reasonEl?.value || "";
        try {
          const res = await authFetch(`/api/orders/${orderId}/refund`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
          });
          if (res.ok) {
            message.success("Refund request submitted");
            loadOrders(orderHistory.page);
          } else {
            const data = await res.json();
            message.error(data.error || "Failed to submit");
          }
        } catch {
          message.error("Failed to submit");
        }
      },
    });
  };

  const STATUS_COLORS: Record<string, string> = {
    pending: "orange", paid: "green", cancelled: "default", refunded: "red", partially_refunded: "volcano", failed: "red",
  };

  if (!user) return null;
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spin size="large" />
      </div>
    );
  }

  const isCurrentPlan = (plan: Plan) =>
    subscription?.planId === plan.id && subscription?.billingCycle === billingCycle;

  const canUpgrade = (plan: Plan) => {
    if (!subscription) return true;
    // 用卡片在列表中的位置判断等级，位置越后等级越高
    const currentIndex = plans.findIndex((p) => p.id === subscription.planId);
    const targetIndex = plans.findIndex((p) => p.id === plan.id);
    return targetIndex > currentIndex;
  };

  const getButtonConfig = (plan: Plan) => {
    if (isCurrentPlan(plan)) {
      return { text: t('currentPlan'), disabled: true, type: "default" as const };
    }
    if (subscription) {
      if (!canUpgrade(plan)) {
        return { text: t('includedInPlan'), disabled: true, type: "default" as const };
      }
      return { text: t('upgrade'), disabled: false, type: "primary" as const };
    }
    return { text: t('subscribe'), disabled: false, type: "primary" as const };
  };

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('subtitle')}
        </p>
      </div>

      {/* Current Subscription Banner */}
      {subscription && (
        <div className="mb-14">
          <Card
            className="shadow-sm border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20"
            size="small"
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <CrownOutlined className="text-blue-500 text-xl" />
                <div>
                  <div className="flex items-center gap-2">
                    <Text strong className="text-gray-900 dark:text-gray-100">
                      {subscription.planTitle}
                    </Text>
                    <Tag color="green">{t('active')}</Tag>
                    <Tag>{subscription.billingCycle === "monthly" ? t('monthly') : t('yearly')}</Tag>
                  </div>
                  <Text type="secondary" className="text-xs">
                    {t('expires', { date: new Date(subscription.expiresAt).toLocaleDateString() })}
                  </Text>
                </div>
              </div>
              <Button size="small" onClick={handleManageSubscription} disabled={!subscription?.providerCustomerId}>Manage Subscription</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Token Usage Overview */}
      {usageSummary?.quota && usageSummary.subscription && (() => {
        const quota = usageSummary.quota!;
        const sub = usageSummary.subscription!;
        return (
        <div className="mb-8">
          <Card
            className="shadow-sm"
            title={
              <div className="flex items-center gap-2">
                <DashboardOutlined className="text-blue-500" />
                <span className="text-gray-900 dark:text-gray-100">{t('tokenUsage')}</span>
                <Tag color="blue" className="text-xs">{sub.planTitle}</Tag>
              </div>
            }
          >
            <div className="space-y-4">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <Text type="secondary" className="text-sm">
                    {t('tokensUsed')}
                  </Text>
                  <Text className="text-sm text-gray-600 dark:text-gray-400">
                    {quota.unlimited
                      ? t('unlimited')
                      : t('tokensRemaining', { count: quota.remaining.toLocaleString() })}
                  </Text>
                </div>
                <Progress
                  percent={quota.unlimited ? Math.min(quota.used / 100000 * 100, 100) : quota.percentage}
                  strokeColor={quota.percentage > 90 ? "#ff4d4f" : quota.percentage > 70 ? "#faad14" : "#1677ff"}
                  format={() =>
                    quota.unlimited
                      ? `${quota.used.toLocaleString()} tokens`
                      : `${quota.used.toLocaleString()} / ${quota.limit.toLocaleString()}`
                  }
                />
              </div>

              {/* Breakdown Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <Tooltip title={t('inputTokens')}>
                  <Statistic
                    title={t('inputTokens')}
                    value={usageSummary.breakdown.inputTokens}
                    className="text-center"
                    styles={{ content: { fontSize: '16px' } }}
                  />
                </Tooltip>
                <Tooltip title={t('outputTokens')}>
                  <Statistic
                    title={t('outputTokens')}
                    value={usageSummary.breakdown.outputTokens}
                    className="text-center"
                    styles={{ content: { fontSize: '16px' } }}
                  />
                </Tooltip>
                <Tooltip title={t('cacheTokens')}>
                  <Statistic
                    title={t('cacheTokens')}
                    value={usageSummary.breakdown.cacheCreationTokens + usageSummary.breakdown.cacheReadTokens}
                    className="text-center"
                    styles={{ content: { fontSize: '16px' } }}
                  />
                </Tooltip>
                <Tooltip title={t('requestsCount')}>
                  <Statistic
                    title={t('requestsCount')}
                    value={usageSummary.requestCount}
                    className="text-center"
                    styles={{ content: { fontSize: '16px' } }}
                  />
                </Tooltip>
              </div>

              {/* Period info */}
              <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-zinc-700">
                <Text type="secondary" className="text-xs">
                  {t('period')}: {new Date(quota.periodStart).toLocaleDateString()} — {new Date(sub.expiresAt).toLocaleDateString()}
                </Text>
              </div>
            </div>
          </Card>
        </div>
        );
      })()}

      {/* Billing Cycle Toggle + Plans Grid + Payment History */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "plans",
            label: "Plans & Usage",
            children: (
              <>
                {/* Billing Cycle Toggle */}
                {plans.length > 0 && (
                  <div className="flex items-center gap-4 mb-6">
                    <Segmented
                      value={billingCycle}
                      onChange={(v) => setBillingCycle(v as "monthly" | "yearly")}
                      options={[
                        { label: t('monthly'), value: "monthly" },
                        { label: t('yearly'), value: "yearly" },
                      ]}
                    />
                    {billingCycle === "yearly" && plans.some((p) => getYearlySaving(p)) && (
                      <Tag color="blue" className="text-xs">
                        {t('saveYearly')}
                      </Tag>
                    )}
                  </div>
                )}

                {/* Plans Grid */}
                {plans.length === 0 ? (
                  <Empty description={t('noPlans')} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {plans.map((plan) => {
                      const { symbol, price, originalPrice } = getDisplayPrice(plan, billingCycle);
                      const features = parseJSON<PlanFeature[]>(plan.features, []);
                      const btnConfig = getButtonConfig(plan);
                      const isCurrent = isCurrentPlan(plan);
                      const saving = billingCycle === "yearly" ? getYearlySaving(plan) : null;

                      return (
                        <Card
                          key={plan.id}
                          className={`shadow-sm transition-all ${
                            isCurrent
                              ? "border-2 border-blue-500 dark:border-blue-400 relative"
                              : "hover:shadow-md"
                          }`}
                          styles={{ body: { padding: 0 } }}
                        >
                          {/* Current Plan Badge */}
                          {isCurrent && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                              <Tag color="blue" className="text-xs font-medium">
                                {t('currentPlan')}
                              </Tag>
                            </div>
                          )}

                          <div className="p-5">
                            {/* Plan Title & Description */}
                            <div className="mb-4">
                              <Title level={4} className="!mb-1 !text-gray-900 dark:!text-gray-100">
                                {plan.title}
                              </Title>
                              {plan.description && (
                                <Paragraph
                                  type="secondary"
                                  className="!mb-0 text-xs"
                                  ellipsis={{ rows: 2 }}
                                >
                                  {plan.description}
                                </Paragraph>
                              )}
                            </div>

                            {/* Price */}
                            <div className="mb-4">
                              <div className="flex items-baseline gap-1">
                                {originalPrice && (
                                  <Text delete type="secondary" className="text-base">
                                    {symbol}{originalPrice}
                                  </Text>
                                )}
                                <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                                  {symbol}{price}
                                </span>
                                <span className="text-sm text-gray-400">
                                  {CYCLE_LABELS[billingCycle]}
                                </span>
                              </div>
                              {saving && (
                                <Text type="success" className="text-xs">
                                  {t('savePerYear', { amount: saving })}
                                </Text>
                              )}
                            </div>

                            {/* Features */}
                            <div className="space-y-2 mb-5 min-h-[60px]">
                              {features.map((feat, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-sm">
                                  {feat.included ? (
                                    <CheckOutlined className="text-green-500 text-xs flex-shrink-0" />
                                  ) : (
                                    <CloseOutlined className="text-gray-300 dark:text-gray-600 text-xs flex-shrink-0" />
                                  )}
                                  <span className={feat.included ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-500"}>
                                    {feat.name}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Action Button */}
                            {isCurrent ? (
                              <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium cursor-default">
                                <CrownOutlined className="text-xs" />
                                {t('currentPlan')}
                              </div>
                            ) : (
                              <Button
                                type={btnConfig.type}
                                block
                                disabled={btnConfig.disabled}
                                loading={subscribing === plan.id}
                                icon={!btnConfig.disabled && <RocketOutlined />}
                                onClick={() => handleSubscribe(plan)}
                              >
                                {btnConfig.text}
                              </Button>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            ),
          },
          {
            key: "history",
            label: "Payment History",
            children: (
              <Table
                dataSource={orderHistory.orders}
                rowKey="id"
                loading={orderLoading}
                pagination={{
                  current: orderHistory.page,
                  pageSize: orderHistory.pageSize,
                  total: orderHistory.total,
                  onChange: (p) => loadOrders(p),
                }}
                columns={[
                  { title: "Order ID", dataIndex: "id", key: "id", width: 120, render: (id: string) => <span className="font-mono text-xs">{id.slice(0, 8)}...</span> },
                  { title: "Plan", dataIndex: "planTitle", key: "planTitle", width: 120 },
                  { title: "Amount", key: "amount", width: 100, render: (_: unknown, r: OrderRecord) => `${(r.amount / 100).toFixed(2)} ${r.currency}` },
                  { title: "Provider", dataIndex: "provider", key: "provider", width: 80, render: (p: string) => <Tag>{p}</Tag> },
                  { title: "Status", dataIndex: "status", key: "status", width: 120, render: (s: string) => <Tag color={STATUS_COLORS[s]}>{s}</Tag> },
                  { title: "Date", dataIndex: "createdAt", key: "createdAt", width: 120, render: (d: string) => new Date(d).toLocaleDateString() },
                  {
                    title: "Actions",
                    key: "actions",
                    width: 100,
                    render: (_: unknown, r: OrderRecord) => (
                      <Space size="small">
                        {r.status === "paid" && (
                          <Button size="small" onClick={() => handleRefundRequest(r.id)}>Refund</Button>
                        )}
                      </Space>
                    ),
                  },
                ]}
                scroll={{ x: 700 }}
                size="small"
              />
            ),
          },
        ]}
      />
    </div>
  );
}
