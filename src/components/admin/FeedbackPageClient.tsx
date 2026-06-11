"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  Select,
  Button,
  Tag,
  Modal,
  App,
  Tooltip,
  Typography,
} from "antd";
import { ReloadOutlined, EyeOutlined } from "@ant-design/icons";
import { useAuth } from "@/components/auth/useAuth";
import { useTranslations } from "next-intl";

const { Text, Paragraph } = Typography;

interface FeedbackItem {
  id: number;
  userId: string | null;
  title: string;
  content: string;
  contact: string | null;
  type: "bug" | "improvement" | "other";
  status: "pending" | "reviewed" | "resolved";
  createdAt: string;
  updatedAt: string;
  userEmail: string | null;
  userName: string | null;
}

const TYPE_TAG_MAP: Record<string, { color: string }> = {
  bug: { color: "red" },
  improvement: { color: "blue" },
  other: { color: "default" },
};

const STATUS_TAG_MAP: Record<string, { color: string }> = {
  pending: { color: "orange" },
  reviewed: { color: "blue" },
  resolved: { color: "green" },
};

export default function FeedbackPageClient() {
  const { authFetch } = useAuth();
  const { message } = App.useApp();
  const t = useTranslations("feedbackPage");

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [detailItem, setDetailItem] = useState<FeedbackItem | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<number | null>(null);

  const loadFeedback = useCallback(
    async (p = page, ps = pageSize, status = statusFilter) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(p),
          pageSize: String(ps),
        });
        if (status) params.set("status", status);
        const res = await authFetch(`/api/feedback?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || t("msgFailedToLoad"));
        }
        const data = await res.json();
        setItems(data.items);
        setTotal(data.total);
      } catch (error: unknown) {
        const msg =
          error instanceof Error ? error.message : t("msgFailedToLoad");
        message.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [authFetch, page, pageSize, statusFilter, message, t],
  );

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const handleStatusChange = async (id: number, newStatus: string) => {
    setStatusUpdating(id);
    try {
      const res = await authFetch(`/api/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("msgFailedToUpdate"));
      }
      message.success(t("msgStatusUpdated"));
      loadFeedback();
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : t("msgFailedToUpdate");
      message.error(msg);
    } finally {
      setStatusUpdating(null);
    }
  };

  const typeLabel = (type: string) => {
    if (type === "bug") return t("typeBug");
    if (type === "improvement") return t("typeImprovement");
    return t("typeOther");
  };

  const statusLabel = (status: string) => {
    if (status === "pending") return t("statusPending");
    if (status === "reviewed") return t("statusReviewed");
    return t("statusResolved");
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      width: 60,
    },
    {
      title: t("colTitle"),
      dataIndex: "title",
      ellipsis: true,
      width: 180,
    },
    {
      title: t("colType"),
      dataIndex: "type",
      width: 100,
      render: (type: string) => (
        <Tag color={TYPE_TAG_MAP[type]?.color}>{typeLabel(type)}</Tag>
      ),
    },
    {
      title: t("colSubmitter"),
      width: 160,
      render: (_: unknown, record: FeedbackItem) => (
        <span className="text-xs">
          {record.userName || "-"}
          <br />
          <Text type="secondary" className="text-xs">
            {record.userEmail || "-"}
          </Text>
        </span>
      ),
    },
    {
      title: t("colContact"),
      dataIndex: "contact",
      width: 140,
      ellipsis: true,
      render: (v: string | null) => v || "-",
    },
    {
      title: t("colStatus"),
      dataIndex: "status",
      width: 140,
      render: (status: string, record: FeedbackItem) => (
        <Select
          value={status}
          size="small"
          loading={statusUpdating === record.id}
          onChange={(v) => handleStatusChange(record.id, v)}
          style={{ width: 110 }}
          variant="outlined"
        >
          <Select.Option value="pending">
            <Tag color="orange">{statusLabel("pending")}</Tag>
          </Select.Option>
          <Select.Option value="reviewed">
            <Tag color="blue">{statusLabel("reviewed")}</Tag>
          </Select.Option>
          <Select.Option value="resolved">
            <Tag color="green">{statusLabel("resolved")}</Tag>
          </Select.Option>
        </Select>
      ),
    },
    {
      title: t("colCreatedAt"),
      dataIndex: "createdAt",
      width: 160,
      render: (v: string) => (
        <span className="text-xs text-gray-500">{formatTime(v)}</span>
      ),
    },
    {
      title: t("colActions"),
      width: 60,
      render: (_: unknown, record: FeedbackItem) => (
        <Tooltip title={t("btnViewDetail")}>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setDetailItem(record)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t("pageTitle")}
        </h1>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            style={{ width: 140 }}
            allowClear
            placeholder={t("filterStatus")}
            variant="outlined"
          >
            <Select.Option value="pending">
              <Tag color="orange">{statusLabel("pending")}</Tag>
            </Select.Option>
            <Select.Option value="reviewed">
              <Tag color="blue">{statusLabel("reviewed")}</Tag>
            </Select.Option>
            <Select.Option value="resolved">
              <Tag color="green">{statusLabel("resolved")}</Tag>
            </Select.Option>
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => loadFeedback()}
            loading={loading}
          >
            {t("btnRefresh")}
          </Button>
        </div>
      </div>

      <Table
        dataSource={items}
        columns={columns}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1000 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (count: number) => t("paginationTotal", { total: count }),
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      {/* Detail Modal */}
      <Modal
        title={detailItem?.title}
        open={!!detailItem}
        onCancel={() => setDetailItem(null)}
        footer={null}
        width={600}
        centered
        styles={{
          container: { border: "1px solid var(--popup-border)" },
          body: { maxHeight: "calc(90vh - 110px)", overflowY: "auto" },
        }}
      >
        {detailItem && (
          <div className="mt-4 space-y-3">
            <div className="flex gap-4">
              <div>
                <Text type="secondary">{t("colType")}:</Text>{" "}
                <Tag color={TYPE_TAG_MAP[detailItem.type]?.color}>
                  {typeLabel(detailItem.type)}
                </Tag>
              </div>
              <div>
                <Text type="secondary">{t("colStatus")}:</Text>{" "}
                <Tag color={STATUS_TAG_MAP[detailItem.status]?.color}>
                  {statusLabel(detailItem.status)}
                </Tag>
              </div>
            </div>
            <div>
              <Text type="secondary">{t("colSubmitter")}:</Text>{" "}
              <Text>
                {detailItem.userName || "-"} ({detailItem.userEmail || "-"})
              </Text>
            </div>
            {detailItem.contact && (
              <div>
                <Text type="secondary">{t("colContact")}:</Text>{" "}
                <Text>{detailItem.contact}</Text>
              </div>
            )}
            <div>
              <Text type="secondary">{t("colCreatedAt")}:</Text>{" "}
              <Text>{formatTime(detailItem.createdAt)}</Text>
            </div>
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <Text strong>{t("contentLabel")}:</Text>
              <Paragraph className="mt-1 whitespace-pre-wrap">
                {detailItem.content}
              </Paragraph>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
