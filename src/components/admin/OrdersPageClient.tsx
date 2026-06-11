"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Input,
  Select,
  App,
  Statistic,
  Row,
  Col,
  Form,
  InputNumber,
  Tooltip,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  FundOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/components/auth/useAuth";

interface OrderRecord {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  planId: number | null;
  planTitle: string | null;
  amount: number;
  currency: string | null;
  originalAmount: number;
  discountAmount: number;
  billingCycle: string | null;
  paymentMode: string | null;
  provider: string;
  providerPaymentId: string | null;
  providerChargeId: string | null;
  status: string;
  paidAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  // topup 专用字段
  recordType?: "order" | "topup";
  tokens?: number;
  reason?: string;
  note?: string;
  expiresAt?: string;
  createdBy?: string;
}

interface OrderStats {
  totalRevenue: number;
  monthlyRevenue: number;
  pendingRefunds: number;
  activeSubscriptions: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "orange",
  paid: "green",
  cancelled: "default",
  refunded: "red",
  partially_refunded: "volcano",
  failed: "red",
  completed: "green",
};

const STATUS_KEYS: Record<string, string> = {
  pending: "statusPending",
  paid: "statusPaid",
  cancelled: "statusCancelled",
  refunded: "statusRefunded",
  partially_refunded: "statusPartiallyRefunded",
  failed: "statusFailed",
  completed: "statusCompleted",
};

const REASON_KEYS: Record<string, string> = {
  system_gift: "reasonSystemGift",
  promotion: "reasonPromotion",
  compensation: "reasonCompensation",
  manual: "reasonManual",
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function OrdersPageClient() {
  const { authFetch } = useAuth();
  const { message, modal } = App.useApp();
  const t = useTranslations("admin.ordersPage");

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<OrderStats | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [providerFilter, setProviderFilter] = useState<string | undefined>();
  const [searchText, setSearchText] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        type: typeFilter,
      });
      if (statusFilter) params.set("status", statusFilter);
      if (providerFilter) params.set("provider", providerFilter);
      if (searchText) params.set("search", searchText);

      const res = await authFetch(`/api/admin/orders?${params}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setTotal(data.total || 0);
        setStats(data.stats || null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [authFetch, page, pageSize, typeFilter, statusFilter, providerFilter, searchText]);

  useEffect(() => { Promise.resolve().then(() => loadOrders()); }, [loadOrders]);

  const handleRefund = (order: OrderRecord) => {
    modal.confirm({
      title: t("refundTitle"),
      content: (
        <Form layout="vertical" id="refund-form">
          <Form.Item label={t("refundAmountLabel")}>
            <InputNumber id="refund-amount" min={1} max={order.amount} defaultValue={order.amount} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label={t("refundNoteLabel")}>
            <Input.TextArea id="refund-note" rows={3} placeholder={t("refundNotePlaceholder")} />
          </Form.Item>
        </Form>
      ),
      okText: t("refundApprove"),
      cancelText: t("refundCancel"),
      onOk: async () => {
        const amountEl = document.getElementById("refund-amount") as HTMLInputElement;
        const noteEl = document.getElementById("refund-note") as HTMLTextAreaElement;
        const amount = amountEl ? Number((amountEl as unknown as { value: string }).value || order.amount) : order.amount;
        const note = noteEl?.value || "";

        try {
          const refundsRes = await authFetch(`/api/admin/refunds?status=pending&pageSize=100`);
          if (refundsRes.ok) {
            const refundsData = await refundsRes.json();
            const pendingRefund = refundsData.refunds?.find((r: { orderId: string }) => r.orderId === order.id);
            if (pendingRefund) {
              const res = await authFetch(`/api/admin/refunds/${pendingRefund.id}/review`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "approve", amount, note }),
              });
              if (res.ok) {
                message.success(t("refundSuccess"));
                loadOrders();
              } else {
                const data = await res.json();
                message.error(data.error || t("refundApproveFailed"));
              }
            } else {
              message.warning(t("refundNoPending"));
            }
          }
        } catch {
          message.error(t("refundFailed"));
        }
      },
    });
  };

  const isTopUp = (r: OrderRecord) => r.recordType === "topup";

  const columns = [
    {
      title: t("columnId"),
      dataIndex: "id",
      key: "id",
      width: 120,
      render: (id: string, r: OrderRecord) => (
        <span className="font-mono text-xs">
          {isTopUp(r) ? `#${id.replace("topup-", "")}` : `${id.slice(0, 8)}...`}
        </span>
      ),
    },
    { title: t("columnUser"), dataIndex: "userEmail", key: "userEmail", width: 180 },
    {
      title: t("columnDescription"),
      key: "description",
      width: 140,
      render: (_: unknown, r: OrderRecord) => {
        if (isTopUp(r)) {
          return (
            <Space size={4}>
              <Tag color="purple">{t("tagTopUp")}</Tag>
              <span>{t(REASON_KEYS[r.reason || "manual"] as `${string}.${string}`) || r.reason}</span>
            </Space>
          );
        }
        return r.planTitle || "--";
      },
    },
    {
      title: t("columnAmount"),
      key: "amount",
      width: 110,
      render: (_: unknown, r: OrderRecord) => {
        if (isTopUp(r)) {
          return <span className="font-medium text-blue-600">{formatTokens(r.tokens || r.amount)}</span>;
        }
        return `${(r.amount / 100).toFixed(2)} ${r.currency || ""}`;
      },
    },
    {
      title: t("columnProvider"),
      dataIndex: "provider",
      key: "provider",
      width: 80,
      render: (p: string) => <Tag>{p === "admin" ? t("providerAdmin") : p}</Tag>,
    },
    {
      title: t("columnCycle"),
      dataIndex: "billingCycle",
      key: "billingCycle",
      width: 80,
      render: (v: string | null, r: OrderRecord) => isTopUp(r) ? "--" : (v || "--"),
    },
    {
      title: t("columnStatus"),
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (s: string, r: OrderRecord) => {
        if (isTopUp(r)) return <Tag color="green">{t("statusCompleted")}</Tag>;
        return <Tag color={STATUS_COLORS[s]}>{STATUS_KEYS[s] ? t(STATUS_KEYS[s] as `${string}.${string}`) : s}</Tag>;
      },
    },
    {
      title: t("columnNote"),
      key: "note",
      width: 120,
      render: (_: unknown, r: OrderRecord) => {
        if (!isTopUp(r) || !r.note) return "--";
        return (
          <Tooltip title={r.note}>
            <span className="text-gray-500 text-xs truncate block max-w-[100px]">{r.note}</span>
          </Tooltip>
        );
      },
    },
    {
      title: t("columnDate"),
      dataIndex: "createdAt",
      key: "createdAt",
      width: 120,
      render: (d: string) => new Date(d).toLocaleDateString(),
    },
    {
      title: t("columnActions"),
      key: "actions",
      width: 120,
      render: (_: unknown, r: OrderRecord) => (
        <Space size="small">
          {!isTopUp(r) && (r.status === "paid" || r.status === "partially_refunded") && (
            <Button size="small" danger onClick={() => handleRefund(r)}>{t("btnRefund")}</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">{t("title")}</h1>

      {/* Stats */}
      {stats && (
        <Row gutter={16} className="mb-6">
          <Col span={6}>
            <Card size="small"><Statistic title={t("statsTotalRevenue")} value={stats.totalRevenue / 100} prefix={<DollarOutlined />} precision={2} /></Card>
          </Col>
          <Col span={6}>
            <Card size="small"><Statistic title={t("statsMonthlyRevenue")} value={stats.monthlyRevenue / 100} prefix={<ShoppingCartOutlined />} precision={2} /></Card>
          </Col>
          <Col span={6}>
            <Card size="small"><Statistic title={t("statsPendingRefunds")} value={stats.pendingRefunds} prefix={<FundOutlined />} /></Card>
          </Col>
          <Col span={6}>
            <Card size="small"><Statistic title={t("statsActiveSubscriptions")} value={stats.activeSubscriptions} prefix={<TeamOutlined />} /></Card>
          </Col>
        </Row>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <Select
          value={typeFilter}
          onChange={(v) => { setTypeFilter(v); setPage(1); }}
          style={{ width: 150 }}
          options={[
            { label: t("filterTypeAll"), value: "all" },
            { label: t("filterTypeOrders"), value: "order" },
            { label: t("filterTypeTopUps"), value: "topup" },
          ]}
        />
        <Input
          placeholder={t("placeholderSearch")}
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 200 }}
          allowClear
        />
        <Select
          placeholder={t("placeholderStatus")}
          value={statusFilter}
          onChange={setStatusFilter}
          allowClear
          style={{ width: 150 }}
          options={[
            { label: t("statusPending"), value: "pending" },
            { label: t("statusPaid"), value: "paid" },
            { label: t("statusCancelled"), value: "cancelled" },
            { label: t("statusRefunded"), value: "refunded" },
            { label: t("statusPartiallyRefunded"), value: "partially_refunded" },
            { label: t("statusFailed"), value: "failed" },
            { label: t("statusCompleted"), value: "completed" },
          ]}
        />
        <Select
          placeholder={t("placeholderProvider")}
          value={providerFilter}
          onChange={setProviderFilter}
          allowClear
          style={{ width: 120 }}
          options={[
            { label: t("providerStripe"), value: "stripe" },
            { label: t("providerAdmin"), value: "admin" },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={loadOrders}>{t("btnRefresh")}</Button>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={orders}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
        scroll={{ x: 1200 }}
        size="middle"
      />
    </div>
  );
}
