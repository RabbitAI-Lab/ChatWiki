"use client";

import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import {
  Button,
  Table,
  Space,
  App,
  Empty,
  Typography,
  Popconfirm,
} from "antd";
import { DeleteOutlined, CodeOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface CliToken {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function CliTokensSection() {
  const { authFetch } = useAuth();
  const { message } = App.useApp();
  const [tokens, setTokens] = useState<CliToken[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/auth/cli/tokens");
      if (res.ok) {
        const data = await res.json();
        setTokens(data.tokens);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      const res = await authFetch(`/api/auth/cli/tokens/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        message.success("Revoked");
        loadTokens();
      }
    } catch {
      message.error("Failed to revoke");
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <CodeOutlined />
        <Text strong>CLI Tokens</Text>
      </div>

      {tokens.length === 0 ? (
        <Empty description="No CLI tokens yet" />
      ) : (
        <Table
          dataSource={tokens}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          columns={[
            {
              title: "Name",
              dataIndex: "name",
            },
            {
              title: "Prefix",
              dataIndex: "prefix",
              render: (v: string) => <Text code>{v}...</Text>,
            },
            {
              title: "Created At",
              dataIndex: "createdAt",
              render: (v: string) => new Date(v).toLocaleString(),
            },
            {
              title: "Last Used",
              dataIndex: "lastUsedAt",
              render: (v: string | null) =>
                v ? new Date(v).toLocaleString() : "-",
            },
            {
              title: "Actions",
              render: (_: unknown, record: CliToken) => (
                <Popconfirm
                  title="Revoke this token?"
                  onConfirm={() => handleRevoke(record.id)}
                >
                  <Button type="text" size="small" danger icon={<DeleteOutlined />}>
                    Revoke
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
