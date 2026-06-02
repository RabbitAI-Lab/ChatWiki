"use client";

import { useState, useCallback, useRef } from "react";
import {
  Card,
  Button,
  Form,
  Input,
  Select,
  Space,
  Modal,
  Tag,
  Typography,
  Switch,
  App,
  Row,
  Col,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  ExportOutlined,
  ImportOutlined,
  CloudServerOutlined,
  StarOutlined,
  StarFilled,
  MinusCircleOutlined,
} from "@ant-design/icons";
import {
  PROVIDERS,
  PROTOCOLS,
  PROTOCOL_LABELS,
  PROVIDER_TAG_COLORS,
  PROTOCOL_TAG_COLORS,
  getProviderDefaults,
  isPresetProvider,
} from "@/lib/model-constants";
import {
  parseExtraEnv,
  serializeExtraEnv,
  PREDEFINED_ENV_KEYS,
  DEFAULT_THINKING_VALUE,
} from "@/lib/model-env";

const { Text, Paragraph } = Typography;

interface ModelConfig {
  id: number;
  provider: string;
  protocol: "openai" | "anthropic";
  name: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  extraEnvJson: string;
  createdAt: string;
  updatedAt: string;
  isDefault: number;
}

const CUSTOM_PROVIDER_KEY = "__custom__";

const PROVIDER_SELECT_OPTIONS = [
  ...PROVIDERS.map((p) => ({ value: p, label: p })),
  { value: CUSTOM_PROVIDER_KEY, label: "Custom..." },
];

function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 3) + "****" + key.slice(-4);
}

/** 从表单字段拼装 extra env 对象（Switch 关闭 / Input 清空 -> 不写入对应 key） */
function collectExtraEnvFromForm(
  disableAdaptive: boolean | undefined,
  defaultThinking: string | undefined,
  customEnvList:
    | Array<{ key?: string; value?: string }>
    | undefined
): Record<string, string> {
  const out: Record<string, string> = {};
  if (disableAdaptive) {
    out[PREDEFINED_ENV_KEYS.DISABLE_ADAPTIVE] = "1";
  }
  const thinking = (defaultThinking || "").trim();
  if (thinking) {
    out[PREDEFINED_ENV_KEYS.DEFAULT_THINKING] = thinking;
  }
  if (Array.isArray(customEnvList)) {
    for (const item of customEnvList) {
      const k = (item?.key || "").trim();
      const v = (item?.value || "").trim();
      if (k && v) {
        out[k] = v;
      }
    }
  }
  return out;
}

/** 从 extraEnvJson 拆出表单三个字段的初值 */
function splitExtraEnvToForm(extraEnvJson: string) {
  const envMap = parseExtraEnv(extraEnvJson);
  const customEnvList: Array<{ key: string; value: string }> = [];
  for (const [k, v] of Object.entries(envMap)) {
    if (
      k === PREDEFINED_ENV_KEYS.DISABLE_ADAPTIVE ||
      k === PREDEFINED_ENV_KEYS.DEFAULT_THINKING
    ) {
      continue;
    }
    customEnvList.push({ key: k, value: v });
  }
  return {
    disableAdaptive: envMap[PREDEFINED_ENV_KEYS.DISABLE_ADAPTIVE] === "1",
    defaultThinking: envMap[PREDEFINED_ENV_KEYS.DEFAULT_THINKING] ?? "",
    customEnvList,
  };
}

interface Props {
  initialModels: ModelConfig[];
}

export default function ModelsPageClient({ initialModels }: Props) {
  const [models, setModels] = useState<ModelConfig[]>(initialModels);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [showApiKeyMap, setShowApiKeyMap] = useState<Record<number, boolean>>(
    {}
  );
  // Custom provider input state
  const [createCustomProvider, setCreateCustomProvider] = useState("");
  const [editCustomProvider, setEditCustomProvider] = useState("");
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const { modal, message } = App.useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track user manually edited fields to avoid auto-fill override
  const createUserEditedRef = useRef<Set<string>>(new Set());
  const editUserEditedRef = useRef<Set<string>>(new Set());

  const refreshList = useCallback(async () => {
    const res = await fetch("/api/models");
    const data = await res.json();
    setModels(data);
  }, []);

  /** Get actual provider value from form (handle custom provider) */
  const getRealProvider = useCallback(
    (
      formProvider: string,
      customProvider: string
    ) => {
      if (formProvider === CUSTOM_PROVIDER_KEY) {
        return customProvider;
      }
      return formProvider;
    },
    []
  );

  /** Provider dropdown change */
  const handleProviderSelect = useCallback(
    (
      value: string,
      form: ReturnType<typeof Form.useForm>[0],
      setCustomProvider: (v: string) => void,
      userEditedRef: React.MutableRefObject<Set<string>>
    ) => {
      if (value === CUSTOM_PROVIDER_KEY) {
        setCustomProvider("");
        form.setFieldValue("baseUrl", "");
        form.setFieldValue("modelName", "");
        form.setFieldValue("name", "");
        return;
      }
      // Select preset provider, clear custom input
      setCustomProvider("");
      const protocol = form.getFieldValue("protocol");
      if (!protocol) return;

      const defaults = getProviderDefaults(value, protocol);
      if (!defaults) return;

      if (!userEditedRef.current.has("baseUrl") && defaults.baseUrl) {
        form.setFieldValue("baseUrl", defaults.baseUrl);
      }
      if (!userEditedRef.current.has("modelName") && defaults.modelName) {
        form.setFieldValue("modelName", defaults.modelName);
      }
      if (!userEditedRef.current.has("name")) {
        form.setFieldValue("name", `${value}-${defaults.modelName}`);
      }
    },
    []
  );

  /** Auto-fill on protocol change */
  const handleProtocolChange = useCallback(
    (
      protocol: string,
      form: ReturnType<typeof Form.useForm>[0],
      customProvider: string,
      userEditedRef: React.MutableRefObject<Set<string>>
    ) => {
      const formProvider = form.getFieldValue("provider");
      const realProvider = getRealProvider(formProvider, customProvider);
      if (!realProvider) return;

      const defaults = getProviderDefaults(realProvider, protocol);
      if (!defaults) return;

      if (!userEditedRef.current.has("baseUrl") && defaults.baseUrl) {
        form.setFieldValue("baseUrl", defaults.baseUrl);
      }
      if (!userEditedRef.current.has("modelName") && defaults.modelName) {
        form.setFieldValue("modelName", defaults.modelName);
      }
      if (!userEditedRef.current.has("name")) {
        form.setFieldValue("name", `${realProvider}-${defaults.modelName}`);
      }
    },
    [getRealProvider]
  );

  /** Mark field as user edited */
  const markUserEdited = useCallback(
    (field: string, userEditedRef: React.MutableRefObject<Set<string>>) => {
      userEditedRef.current.add(field);
    },
    []
  );

  const handleCreate = useCallback(async () => {
    try {
      const values = await createForm.validateFields();
      // Replace custom provider value
      if (values.provider === CUSTOM_PROVIDER_KEY) {
        if (!createCustomProvider.trim()) {
          message.error("Please enter custom provider name");
          return;
        }
        values.provider = createCustomProvider.trim();
      }
      // 合并环境变量：Switch / Input / Form.List -> extraEnvJson
      values.extraEnvJson = serializeExtraEnv(
        collectExtraEnvFromForm(values.disableAdaptive, values.defaultThinking, values.customEnvList)
      );
      delete values.disableAdaptive;
      delete values.defaultThinking;
      delete values.customEnvList;
      await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      setCreateOpen(false);
      createForm.resetFields();
      setCreateCustomProvider("");
      createUserEditedRef.current.clear();
      await refreshList();
    } catch {
      // validation failed, antd will show errors
    }
  }, [createForm, createCustomProvider, refreshList, message]);

  const handleSetDefault = useCallback(
    (model: ModelConfig) => {
      const newDefault = model.isDefault ? 0 : 1;
      fetch(`/api/models/${model.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: newDefault }),
      }).then(() => {
        refreshList();
        message.success(newDefault ? `"${model.name}" set as default model` : `"${model.name}" removed as default model`);
      });
    },
    [refreshList, message]
  );

  const handleDelete = useCallback(
    (id: number, name: string, isDefault?: number) => {
      let content = `Confirm delete "${name}"?`;
      if (isDefault) {
        content += "\n\nNote: This model is the default model. After deletion, new chats will not automatically select a model.";
      }
      modal.confirm({
        title: "Confirm Delete",
        content,
        okText: "Delete",
        cancelText: "Cancel",
        okButtonProps: { danger: true },
        onOk: async () => {
          await fetch(`/api/models/${id}`, { method: "DELETE" });
          await refreshList();
        },
      });
    },
    [modal, refreshList]
  );

  const handleStartEdit = useCallback(
    (model: ModelConfig) => {
      setEditingModel(model);
      const isPreset = isPresetProvider(model.provider);
      const envFields = splitExtraEnvToForm(model.extraEnvJson || "{}");
      editForm.setFieldsValue({
        provider: isPreset ? model.provider : CUSTOM_PROVIDER_KEY,
        protocol: model.protocol || "openai",
        name: model.name,
        baseUrl: model.baseUrl,
        apiKey: model.apiKey,
        modelName: model.modelName,
        disableAdaptive: envFields.disableAdaptive,
        defaultThinking: envFields.defaultThinking,
        customEnvList: envFields.customEnvList,
      });
      setEditCustomProvider(isPreset ? "" : model.provider);
      editUserEditedRef.current.clear();
      setEditOpen(true);
    },
    [editForm]
  );

  const handleSaveEdit = useCallback(async () => {
    if (!editingModel) return;
    try {
      const values = await editForm.validateFields();
      // Replace custom provider value
      if (values.provider === CUSTOM_PROVIDER_KEY) {
        if (!editCustomProvider.trim()) {
          message.error("Please enter custom provider name");
          return;
        }
        values.provider = editCustomProvider.trim();
      }
      const body: Record<string, string> = {};
      if (values.provider) body.provider = values.provider;
      if (values.protocol) body.protocol = values.protocol;
      if (values.name) body.name = values.name;
      if (values.baseUrl) body.baseUrl = values.baseUrl;
      if (values.modelName) body.modelName = values.modelName;
      if (values.apiKey) body.apiKey = values.apiKey;
      // Edit 模式总是按当前表单状态重新生成 extraEnvJson（声明式）
      body.extraEnvJson = serializeExtraEnv(
        collectExtraEnvFromForm(values.disableAdaptive, values.defaultThinking, values.customEnvList)
      );

      await fetch(`/api/models/${editingModel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setEditOpen(false);
      setEditingModel(null);
      editForm.resetFields();
      setEditCustomProvider("");
      editUserEditedRef.current.clear();
      await refreshList();
    } catch {
      // validation failed
    }
  }, [editingModel, editForm, editCustomProvider, refreshList, message]);

  const toggleApiKeyVisibility = useCallback((id: number) => {
    setShowApiKeyMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Export: download all model configs as JSON file
  const handleExport = useCallback(() => {
    if (models.length === 0) {
      message.warning("No model configurations to export");
      return;
    }
    const exportData = models.map(
      ({ id, createdAt, updatedAt, isDefault, ...rest }) => rest
    );
    const blob = new Blob(
      [JSON.stringify({ version: 2, models: exportData }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `model-configs-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success(`Exported ${models.length} model configurations`);
  }, [models, message]);

  // Import: read JSON file and batch create
  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset input to allow selecting same file again
      e.target.value = "";

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        let importList: (Omit<
          ModelConfig,
          "id" | "createdAt" | "updatedAt"
        > & { protocol?: string })[] = [];

        if (Array.isArray(data)) {
          importList = data;
        } else if (data.models && Array.isArray(data.models)) {
          importList = data.models;
        } else {
          message.error("Invalid file format");
          return;
        }

        const validProtocols = PROTOCOLS as readonly string[];
        const validItems = importList
          .map(({ isDefault, ...item }) => ({
            ...item,
            protocol: item.protocol || "openai",
          }))
          .filter(
            (item) =>
              item.provider &&
              item.name &&
              item.baseUrl &&
              item.apiKey &&
              item.modelName &&
              validProtocols.includes(item.protocol)
          );

        if (validItems.length === 0) {
          message.error("No valid model configurations in file");
          return;
        }

        modal.confirm({
          title: "Confirm Import",
          content: `Detected ${validItems.length} valid model configurations. Import?`,
          okText: "Import",
          cancelText: "Cancel",
          onOk: async () => {
            let successCount = 0;
            for (const item of validItems) {
              try {
                await fetch("/api/models", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(item),
                });
                successCount++;
              } catch {
                // skip failed items
              }
            }
            await refreshList();
            message.success(`Successfully imported ${successCount} model configurations`);
          },
        });
      } catch {
        message.error("File parsing failed, please check JSON format");
      }
    },
    [modal, message, refreshList]
  );

  /** Render the provider select field (single Form.Item) */
  const renderProviderItem = (
    form: ReturnType<typeof Form.useForm>[0],
    setCustomProvider: (v: string) => void,
    userEditedRef: React.MutableRefObject<Set<string>>
  ) => (
    <Form.Item
      label="Provider"
      name="provider"
      rules={[{ required: true, message: "Please select provider" }]}
    >
      <Select
        options={PROVIDER_SELECT_OPTIONS}
        placeholder="Select provider"
        onChange={(value) =>
          handleProviderSelect(value, form, setCustomProvider, userEditedRef)
        }
      />
    </Form.Item>
  );

  /** Render the custom provider name field (single Form.Item, full-width) */
  const renderCustomProviderItem = (
    form: ReturnType<typeof Form.useForm>[0],
    customProvider: string,
    setCustomProvider: (v: string) => void
  ) => {
    if (form.getFieldValue("provider") !== CUSTOM_PROVIDER_KEY) return null;
    return (
      <Form.Item
        label="Custom Provider Name"
        required
        rules={[{ required: true, message: "Please enter custom provider name" }]}
      >
        <Input
          value={customProvider}
          onChange={(e) => setCustomProvider(e.target.value)}
          placeholder="e.g. Ollama, SiliconFlow..."
        />
      </Form.Item>
    );
  };

  /** Render environment variable configuration section (Switch + Input + Form.List) */
  const renderEnvSection = () => (
    <>
      <div
        style={{
          marginTop: 4,
          marginBottom: 16,
          fontSize: 16,
          fontWeight: 600,
          lineHeight: 1.5,
          color: "rgba(0, 0, 0, 0.88)",
        }}
      >
        Environment Variables
      </div>
      <Form.Item
        label={
          <span>
            Disable Adaptive
            <Text type="secondary" className="text-xs ml-1">
              ({PREDEFINED_ENV_KEYS.DISABLE_ADAPTIVE})
            </Text>
          </span>
        }
        name="disableAdaptive"
        valuePropName="checked"
        tooltip="Recommended for domestic models. Sets CLAUDE_CODE_DISABLE_ADAPTIVE=1 when on."
        style={{ marginBottom: 10 }}
      >
        <Switch />
      </Form.Item>
      <Form.Item
        label={
          <span>
            Default Thinking
            <Text type="secondary" className="text-xs ml-1">
              ({PREDEFINED_ENV_KEYS.DEFAULT_THINKING})
            </Text>
          </span>
        }
        name="defaultThinking"
        tooltip="JSON string passed to Claude Code SDK to enable extended thinking (budgetTokens: 4096 by default)."
        style={{ marginBottom: 10 }}
      >
        <Input
          allowClear
          placeholder={DEFAULT_THINKING_VALUE}
        />
      </Form.Item>
      <Form.Item
        label={
          <span>
            Custom Env
            <Text type="secondary" className="text-xs ml-1">
              (hard-coded system envs always win)
            </Text>
          </span>
        }
        style={{ marginBottom: 8 }}
      >
        <Form.List name="customEnvList">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name: fieldName, ...restField }) => (
                <Space
                  key={key}
                  align="baseline"
                  size={4}
                  style={{ display: "flex", marginBottom: 4 }}
                >
                  <Form.Item
                    {...restField}
                    name={[fieldName, "key"]}
                    rules={[
                      { required: true, message: "Missing key" },
                      {
                        pattern: /^[A-Za-z_][A-Za-z0-9_]*$/,
                        message: "Invalid env var name",
                      },
                    ]}
                    style={{ marginBottom: 0, width: 160 }}
                  >
                    <Input placeholder="KEY" />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    name={[fieldName, "value"]}
                    rules={[{ required: true, message: "Missing value" }]}
                    style={{ marginBottom: 0, flex: 1, minWidth: 120 }}
                  >
                    <Input placeholder="value" allowClear />
                  </Form.Item>
                  <MinusCircleOutlined
                    onClick={() => remove(fieldName)}
                    style={{ color: "#ff4d4f", fontSize: 14, cursor: "pointer" }}
                  />
                </Space>
              ))}
              <Button
                type="dashed"
                onClick={() => add({ key: "", value: "" })}
                block
                size="small"
                icon={<PlusOutlined />}
              >
                Add env
              </Button>
            </>
          )}
        </Form.List>
      </Form.Item>
    </>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Model Config</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage AI model API connection configurations
          </p>
        </div>
        <Space>
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            Export
          </Button>
          <Button icon={<ImportOutlined />} onClick={handleImport}>
            Import
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              createUserEditedRef.current.clear();
              setCreateCustomProvider("");
              // 先重置所有字段（避免上次表单残留）
              createForm.resetFields();
              // Set initial defaults
              const defaults = getProviderDefaults("GLM", "openai");
              createForm.setFieldsValue({
                provider: "GLM",
                protocol: "openai",
                name: defaults ? `GLM-${defaults.modelName}` : undefined,
                baseUrl: defaults?.baseUrl,
                modelName: defaults?.modelName,
                // 国产模型默认开启两个预定义 env
                disableAdaptive: true,
                defaultThinking: DEFAULT_THINKING_VALUE,
                customEnvList: [],
              });
              setCreateOpen(true);
            }}
          >
            Add Model
          </Button>
        </Space>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {models.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60%] text-gray-400">
            <CloudServerOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <p className="text-sm">No model configurations, click the button above to add</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {models.map((model) => {
              const envMap = parseExtraEnv(model.extraEnvJson);
              const envCount = Object.keys(envMap).length;
              const hasPreset =
                envMap[PREDEFINED_ENV_KEYS.DISABLE_ADAPTIVE] === "1" ||
                typeof envMap[PREDEFINED_ENV_KEYS.DEFAULT_THINKING] === "string";
              return (
              <Card
                key={model.id}
                size="small"
                hoverable
                actions={[
                  <span
                    key="default"
                    onClick={() => handleSetDefault(model)}
                    style={{ color: model.isDefault ? '#faad14' : undefined }}
                  >
                    {model.isDefault ? <StarFilled /> : <StarOutlined />}
                  </span>,
                  <EditOutlined
                    key="edit"
                    onClick={() => handleStartEdit(model)}
                  />,
                  <DeleteOutlined
                    key="delete"
                    onClick={() => handleDelete(model.id, model.name, model.isDefault)}
                  />,
                ]}
              >
                <div className="mb-3">
                  <Space align="center">
                    <Tag
                      color={
                        PROVIDER_TAG_COLORS[model.provider] || "geekblue"
                      }
                    >
                      {model.provider}
                    </Tag>
                    <Tag
                      color={
                        PROTOCOL_TAG_COLORS[model.protocol || "openai"] ||
                        "cyan"
                      }
                    >
                      {PROTOCOL_LABELS[model.protocol || "openai"] ||
                        model.protocol}
                    </Tag>
                    {model.isDefault ? <Tag color="gold">Default</Tag> : null}
                    <Text strong>{model.name}</Text>
                  </Space>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Text
                      type="secondary"
                      className="text-xs w-16 shrink-0"
                    >
                      Base URL
                    </Text>
                    <Paragraph
                      copyable={{ text: model.baseUrl }}
                      className="!mb-0 text-xs font-mono"
                      ellipsis
                    >
                      {model.baseUrl}
                    </Paragraph>
                  </div>
                  <div className="flex items-center gap-2">
                    <Text
                      type="secondary"
                      className="text-xs w-16 shrink-0"
                    >
                      Model
                    </Text>
                    <Text className="text-xs">{model.modelName}</Text>
                  </div>
                  <div className="flex items-center gap-2">
                    <Text
                      type="secondary"
                      className="text-xs w-16 shrink-0"
                    >
                      API Key
                    </Text>
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <Text className="!text-xs font-mono" ellipsis>
                        {showApiKeyMap[model.id]
                          ? model.apiKey
                          : maskApiKey(model.apiKey)}
                      </Text>
                      <Button
                        type="text"
                        size="small"
                        icon={
                          showApiKeyMap[model.id] ? (
                            <EyeInvisibleOutlined />
                          ) : (
                            <EyeOutlined />
                          )
                        }
                        onClick={() => toggleApiKeyVisibility(model.id)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Text
                      type="secondary"
                      className="text-xs w-16 shrink-0"
                    >
                      Env
                    </Text>
                    <div className="flex items-center gap-1 flex-1 flex-wrap">
                      <Tag color={envCount > 0 ? "blue" : "default"} className="!m-0">
                        {envCount} {envCount === 1 ? "var" : "vars"}
                      </Tag>
                      {hasPreset ? <Tag color="purple" className="!m-0">Preset ON</Tag> : null}
                      {!hasPreset && envCount === 0 ? (
                        <Text type="secondary" className="text-xs">
                          (no env vars)
                        </Text>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {createOpen && (
      <Modal
        title="New Model Config"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
          setCreateCustomProvider("");
          createUserEditedRef.current.clear();
        }}
        okText="Create"
        cancelText="Cancel"
        width={600}
        centered
        destroyOnHidden
        styles={{
          body: {
            maxHeight: "calc(100vh - 200px)",
            overflowY: "auto",
            paddingRight: 4,
          },
        }}
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{
            provider: "GLM",
            protocol: "openai",
            disableAdaptive: true,
            defaultThinking: DEFAULT_THINKING_VALUE,
            customEnvList: [],
          }}
          className="mt-4"
        >
          <Row gutter={16}>
            <Col span={12}>
              {renderProviderItem(
                createForm,
                setCreateCustomProvider,
                createUserEditedRef
              )}
            </Col>
            <Col span={12}>
              <Form.Item
                label="Protocol"
                name="protocol"
                rules={[{ required: true, message: "Please select protocol" }]}
              >
                <Select
                  onChange={(value) =>
                    handleProtocolChange(
                      value,
                      createForm,
                      createCustomProvider,
                      createUserEditedRef
                    )
                  }
                >
                  {PROTOCOLS.map((p) => (
                    <Select.Option key={p} value={p}>
                      {PROTOCOL_LABELS[p]}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          {renderCustomProviderItem(
            createForm,
            createCustomProvider,
            setCreateCustomProvider
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Config Name"
                name="name"
                rules={[{ required: true, message: "Please enter config name" }]}
              >
                <Input placeholder="e.g. My GLM-4" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Model Name"
                name="modelName"
                rules={[{ required: true, message: "Please enter Model Name" }]}
              >
                <Input
                  placeholder="e.g. glm-5.1"
                  onChange={() => markUserEdited("modelName", createUserEditedRef)}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="Base URL"
            name="baseUrl"
            rules={[{ required: true, message: "Please enter Base URL" }]}
          >
            <Input
              placeholder="https://open.bigmodel.cn/api/coding/paas/v4"
              onChange={() => markUserEdited("baseUrl", createUserEditedRef)}
            />
          </Form.Item>
          <Form.Item
            label="API Key"
            name="apiKey"
            rules={[{ required: true, message: "Please enter API Key" }]}
          >
            <Input.Password placeholder="Enter API Key" />
          </Form.Item>
          {renderEnvSection()}
        </Form>
      </Modal>
      )}

      {/* Edit Modal */}
      {editOpen && (
      <Modal
        title="Edit Model Config"
        open={editOpen}
        onOk={handleSaveEdit}
        onCancel={() => {
          setEditOpen(false);
          setEditingModel(null);
          editForm.resetFields();
          setEditCustomProvider("");
          editUserEditedRef.current.clear();
        }}
        okText="Save"
        cancelText="Cancel"
        width={600}
        centered
        destroyOnHidden
        styles={{
          body: {
            maxHeight: "calc(100vh - 200px)",
            overflowY: "auto",
            paddingRight: 4,
          },
        }}
      >
        <Form
          form={editForm}
          layout="vertical"
          className="mt-4"
        >
          <Row gutter={16}>
            <Col span={12}>
              {renderProviderItem(
                editForm,
                setEditCustomProvider,
                editUserEditedRef
              )}
            </Col>
            <Col span={12}>
              <Form.Item
                label="Protocol"
                name="protocol"
                rules={[{ required: true, message: "Please select protocol" }]}
              >
                <Select
                  onChange={(value) =>
                    handleProtocolChange(
                      value,
                      editForm,
                      editCustomProvider,
                      editUserEditedRef
                    )
                  }
                >
                  {PROTOCOLS.map((p) => (
                    <Select.Option key={p} value={p}>
                      {PROTOCOL_LABELS[p]}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          {renderCustomProviderItem(
            editForm,
            editCustomProvider,
            setEditCustomProvider
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Config Name"
                name="name"
                rules={[{ required: true, message: "Please enter config name" }]}
              >
                <Input placeholder="e.g. My GLM-4" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Model Name"
                name="modelName"
                rules={[{ required: true, message: "Please enter Model Name" }]}
              >
                <Input
                  placeholder="e.g. glm-5.1"
                  onChange={() => markUserEdited("modelName", editUserEditedRef)}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="Base URL"
            name="baseUrl"
            rules={[{ required: true, message: "Please enter Base URL" }]}
          >
            <Input
              placeholder="https://open.bigmodel.cn/api/coding/paas/v4"
              onChange={() => markUserEdited("baseUrl", editUserEditedRef)}
            />
          </Form.Item>
          <Form.Item
            label="API Key"
            name="apiKey"
            rules={[{ required: true, message: "Please enter API Key" }]}
          >
            <Input.Password placeholder="Enter API Key" />
          </Form.Item>
          {renderEnvSection()}
        </Form>
      </Modal>
      )}
    </div>
  );
}
