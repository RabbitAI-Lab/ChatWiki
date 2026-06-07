"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  Switch,
  Input,
  Button,
  App,
  Form,
  InputNumber,
  Tag,
  Spin,
  Typography,
  Alert,
  Tooltip,
} from "antd";
import {
  SaveOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/components/auth/useAuth";

interface ProviderField {
  key: string;
  label: string;
  type: "text" | "password" | "switch" | "number";
  required?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
}

interface ProviderInfo {
  name: string;
  enabled: boolean;
  fields: ProviderField[];
  values: Record<string, unknown>;
  webhookUrl?: string;
}

export default function PaymentConfigPageClient() {
  const { authFetch } = useAuth();
  const { message } = App.useApp();

  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [_general, setGeneral] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    message.success("Copied to clipboard");
  };

  // Local state for edits
  const [providerEdits, setProviderEdits] = useState<Record<string, Record<string, unknown>>>({});
  const [generalEdits, setGeneralEdits] = useState<Record<string, string>>({});

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/auth/admin/payment-config");
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
        setGeneral(data.generalConfig || {});
        setGeneralEdits(data.generalConfig || {});
        // Initialize edits from current values
        const edits: Record<string, Record<string, unknown>> = {};
        for (const p of data.providers || []) {
          edits[p.name] = { ...p.values, enabled: p.enabled };
        }
        setProviderEdits(edits);
        setTestResults({});
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { Promise.resolve().then(() => loadConfig()); }, [loadConfig]);

  const handleSaveProvider = async (providerName: string) => {
    setSaving(providerName);
    try {
      const config = providerEdits[providerName] || {};
      const res = await authFetch("/api/auth/admin/payment-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerName, config }),
      });
      if (res.ok) {
        message.success(`${providerName} config saved`);
        loadConfig();
      } else {
        const data = await res.json();
        message.error(data.error || "Failed to save");
      }
    } catch {
      message.error("Failed to save");
    } finally {
      setSaving(null);
    }
  };

  const handleSaveGeneral = async () => {
    setSaving("general");
    try {
      const res = await authFetch("/api/auth/admin/payment-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ general: generalEdits }),
      });
      if (res.ok) {
        message.success("General settings saved");
        loadConfig();
      } else {
        message.error("Failed to save");
      }
    } catch {
      message.error("Failed to save");
    } finally {
      setSaving(null);
    }
  };

  const handleTestConnection = async (providerName: string) => {
    setTesting(providerName);
    try {
      const res = await authFetch("/api/auth/admin/payment-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerName }),
      });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [providerName]: data }));
      if (data.success) {
        message.success(data.message);
      } else {
        message.error(data.message);
      }
    } catch {
      message.error("Test failed");
    } finally {
      setTesting(null);
    }
  };

  const updateProviderEdit = (providerName: string, key: string, value: unknown) => {
    setProviderEdits((prev) => ({
      ...prev,
      [providerName]: {
        ...(prev[providerName] || {}),
        [key]: value,
      },
    }));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spin size="large" /></div>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <Typography.Title level={4} style={{ marginBottom: 24 }}>Payment Configuration</Typography.Title>

      <div className="flex flex-col gap-6">
        {/* Provider Cards */}
        {providers.map((provider) => {
          const edits = providerEdits[provider.name] || {};
          const testResult = testResults[provider.name];

          return (
            <Card
              key={provider.name}
              title={
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="capitalize font-semibold">{provider.name}</span>
                    <Tag color={edits.enabled ? "green" : "default"}>
                      {edits.enabled ? "Enabled" : "Disabled"}
                    </Tag>
                  </div>
                  <Switch
                    checked={!!edits.enabled}
                    onChange={(v) => updateProviderEdit(provider.name, "enabled", v)}
                  />
                </div>
              }
            >
              <Form layout="vertical" size="middle">
                {provider.fields.map((field) => {
                  const val = edits[field.key] ?? (field.type === "switch" ? false : "");

                  if (field.type === "switch") {
                    return (
                      <Form.Item key={field.key} label={field.label}>
                        <Switch
                          checked={!!val}
                          onChange={(v) => updateProviderEdit(provider.name, field.key, v)}
                        />
                      </Form.Item>
                    );
                  }

                  if (field.type === "password") {
                    return (
                      <Form.Item key={field.key} label={field.label}>
                        <Input.Password
                          value={String(val || "")}
                          onChange={(e) => updateProviderEdit(provider.name, field.key, e.target.value)}
                          placeholder={field.placeholder}
                        />
                      </Form.Item>
                    );
                  }

                  return (
                    <Form.Item key={field.key} label={field.label}>
                      <Input
                        value={String(val || "")}
                        onChange={(e) => updateProviderEdit(provider.name, field.key, e.target.value)}
                        placeholder={field.placeholder}
                      />
                    </Form.Item>
                  );
                })}

                {/* Webhook URL */}
                {provider.webhookUrl && (
                  <Form.Item
                    label={
                      <span>Webhook URL <Tooltip title="Configure this URL in your Stripe dashboard under Webhooks endpoints"><QuestionCircleOutlined className="text-gray-400 ml-1" /></Tooltip></span>
                    }
                  >
                    <Input
                      value={provider.webhookUrl}
                      readOnly
                      suffix={
                        <Tooltip title={copied ? "Copied!" : "Copy"}>
                          <Button
                            type="text"
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => copyToClipboard(provider.webhookUrl!)}
                          />
                        </Tooltip>
                      }
                    />
                  </Form.Item>
                )}

                {/* Test Result */}
                {testResult && (
                  <Alert
                    type={testResult.success ? "success" : "error"}
                    title={testResult.message}
                    showIcon
                    icon={testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                    style={{ marginBottom: 16 }}
                  />
                )}

                {/* Actions */}
                <Form.Item>
                  <Button
                    icon={<ApiOutlined />}
                    onClick={() => handleTestConnection(provider.name)}
                    loading={testing === provider.name}
                    style={{ marginRight: 8 }}
                  >
                    Test Connection
                  </Button>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={() => handleSaveProvider(provider.name)}
                    loading={saving === provider.name}
                  >
                    Save
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          );
        })}

        {/* General Settings */}
        <Card title={<span className="font-semibold">General Settings</span>}>
          <Form layout="vertical" size="middle">
            <Form.Item
              label="Checkout Timeout (hours)"
              tooltip="Orders will be cancelled if not paid within this time"
            >
              <InputNumber
                value={Number(generalEdits.checkout_timeout_hours || 24)}
                onChange={(v) => setGeneralEdits((prev) => ({ ...prev, checkout_timeout_hours: String(v || 24) }))}
                min={1}
                max={72}
                style={{ width: "100%" }}
              />
            </Form.Item>
            <Form.Item
              label="Refund Deadline (days)"
              tooltip="Users can request a refund within this many days after payment"
            >
              <InputNumber
                value={Number(generalEdits.refund_deadline_days || 30)}
                onChange={(v) => setGeneralEdits((prev) => ({ ...prev, refund_deadline_days: String(v || 30) }))}
                min={1}
                max={365}
                style={{ width: "100%" }}
              />
            </Form.Item>
            <Form.Item
              label="Renewal Reminder (days before expiry)"
              tooltip="Send a renewal reminder email this many days before subscription expires"
            >
              <InputNumber
                value={Number(generalEdits.renewal_reminder_days || 5)}
                onChange={(v) => setGeneralEdits((prev) => ({ ...prev, renewal_reminder_days: String(v || 5) }))}
                min={1}
                max={30}
                style={{ width: "100%" }}
              />
            </Form.Item>
            <Form.Item
              label="Reminder Interval (hours)"
              tooltip="Interval between pending payment reminder emails"
            >
              <InputNumber
                value={Number(generalEdits.pending_reminder_interval_hours || 6)}
                onChange={(v) => setGeneralEdits((prev) => ({ ...prev, pending_reminder_interval_hours: String(v || 6) }))}
                min={1}
                max={48}
                style={{ width: "100%" }}
              />
            </Form.Item>
            <Form.Item
              label="Max Reminders"
              tooltip="Maximum number of pending payment reminder emails to send"
            >
              <InputNumber
                value={Number(generalEdits.pending_reminder_max_count || 3)}
                onChange={(v) => setGeneralEdits((prev) => ({ ...prev, pending_reminder_max_count: String(v || 3) }))}
                min={0}
                max={10}
                style={{ width: "100%" }}
              />
            </Form.Item>
            <Form.Item
              label="Refund Admin Emails"
              tooltip="Administrators who will receive refund request notifications"
            >
              <Input.TextArea
                value={generalEdits.refund_admin_emails || ""}
                onChange={(e) => setGeneralEdits((prev) => ({ ...prev, refund_admin_emails: e.target.value }))}
                placeholder="admin@example.com, finance@example.com"
                rows={2}
              />
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSaveGeneral}
                loading={saving === "general"}
              >
                Save General Settings
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
}
