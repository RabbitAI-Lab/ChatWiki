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
  planId: number;
  planTitle: string | null;
  amount: number;
  currency: string;
  originalAmount: number;
  discountAmount: number;
  billingCycle: string;
  paymentMode: string;
  provider: string;
  providerPaymentId: string | null;
  providerChargeId: string | null;
  status: string;
  paidAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
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
};

export default function OrdersPageClient() {
  const { authFetch } = useAuth();
  const { message, modal } = App.useApp();
  const _t = useTranslations("admin.ordersPage");

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<OrderStats | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [providerFilter, setProviderFilter] = useState<string | undefined>();
  const [searchText, setSearchText] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
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
  }, [authFetch, page, pageSize, statusFilter, providerFilter, searchText]);

  useEffect(() => { Promise.resolve().then(() => loadOrders()); }, [loadOrders]);

  const handleRefund = (order: OrderRecord) => {
    modal.confirm({
      title: "Refund Order",
      content: (
        <Form layout="vertical" id="refund-form">
          <Form.Item label="Refund Amount (cents)">
            <InputNumber id="refund-amount" min={1} max={order.amount} defaultValue={order.amount} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Note">
            <Input.TextArea id="refund-note" rows={3} placeholder="Optional note..." />
          </Form.Item>
        </Form>
      ),
      okText: "Approve Refund",
      cancelText: "Cancel",
      onOk: async () => {
        const amountEl = document.getElementById("refund-amount") as HTMLInputElement;
        const noteEl = document.getElementById("refund-note") as HTMLTextAreaElement;
        const amount = amountEl ? Number((amountEl as unknown as { value: string }).value || order.amount) : order.amount;
        const note = noteEl?.value || "";

        try {
          // Find pending refund for this order
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
                message.success("Refund approved");
                loadOrders();
              } else {
                const data = await res.json();
                message.error(data.error || "Failed to approve refund");
              }
            } else {
              message.warning("No pending refund request found for this order");
            }
          }
        } catch {
          message.error("Failed to process refund");
        }
      },
    });
  };

  const columns = [
    {
      title: "Order ID",
      dataIndex: "id",
      key: "id",
      width: 120,
      render: (id: string) => <span className="font-mono text-xs">{id.slice(0, 8)}...</span>,
    },
    { title: "User", dataIndex: "userEmail", key: "userEmail", width: 180 },
    { title: "Plan", dataIndex: "planTitle", key: "planTitle", width: 120 },
    {
      title: "Amount",
      key: "amount",
      width: 100,
      render: (_: unknown, r: OrderRecord) => `${(r.amount / 100).toFixed(2)} ${r.currency}`,
    },
    {
      title: "Provider",
      dataIndex: "provider",
      key: "provider",
      width: 80,
      render: (p: string) => <Tag>{p}</Tag>,
    },
    {
      title: "Cycle",
      dataIndex: "billingCycle",
      key: "billingCycle",
      width: 80,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (s: string) => <Tag color={STATUS_COLORS[s]}>{s}</Tag>,
    },
    {
      title: "Date",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 120,
      render: (d: string) => new Date(d).toLocaleDateString(),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_: unknown, r: OrderRecord) => (
        <Space size="small">
          {(r.status === "paid" || r.status === "partially_refunded") && (
            <Button size="small" danger onClick={() => handleRefund(r)}>Refund</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Order Management</h1>

      {/* Stats */}
      {stats && (
        <Row gutter={16} className="mb-6">
          <Col span={6}>
            <Card size="small"><Statistic title="Total Revenue" value={stats.totalRevenue / 100} prefix={<DollarOutlined />} precision={2} /></Card>
          </Col>
          <Col span={6}>
            <Card size="small"><Statistic title="Monthly Revenue" value={stats.monthlyRevenue / 100} prefix={<ShoppingCartOutlined />} precision={2} /></Card>
          </Col>
          <Col span={6}>
            <Card size="small"><Statistic title="Pending Refunds" value={stats.pendingRefunds} prefix={<FundOutlined />} /></Card>
          </Col>
          <Col span={6}>
            <Card size="small"><Statistic title="Active Subscriptions" value={stats.activeSubscriptions} prefix={<TeamOutlined />} /></Card>
          </Col>
        </Row>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <Input
          placeholder="Search user..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 200 }}
          allowClear
        />
        <Select
          placeholder="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          allowClear
          style={{ width: 150 }}
          options={[
            { label: "Pending", value: "pending" },
            { label: "Paid", value: "paid" },
            { label: "Cancelled", value: "cancelled" },
            { label: "Refunded", value: "refunded" },
            { label: "Partially Refunded", value: "partially_refunded" },
            { label: "Failed", value: "failed" },
          ]}
        />
        <Select
          placeholder="Provider"
          value={providerFilter}
          onChange={setProviderFilter}
          allowClear
          style={{ width: 120 }}
          options={[{ label: "Stripe", value: "stripe" }]}
        />
        <Button icon={<ReloadOutlined />} onClick={loadOrders}>Refresh</Button>
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
        scroll={{ x: 1000 }}
        size="small"
      />
    </div>
  );
}
