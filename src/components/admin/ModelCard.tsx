"use client";

import { Card, Tag, Button, Space, Typography } from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  StarOutlined,
  StarFilled,
} from "@ant-design/icons";
import {
  PROTOCOL_TAG_COLORS,
  PROTOCOL_LABELS,
} from "@/lib/model-constants";
import { PREDEFINED_ENV_KEYS, parseExtraEnv } from "@/lib/model-env";
import { ModelConfig, maskApiKey } from "./model-config-shared";

const { Text, Paragraph } = Typography;

interface ModelCardProps {
  model: ModelConfig;
  showApiKey: boolean;
  onToggleApiKey: (id: number) => void;
  onSetDefault: (model: ModelConfig) => void;
  onEdit: (model: ModelConfig) => void;
  onDelete: (id: number, name: string, isDefault?: boolean) => void;
}

export default function ModelCard({
  model,
  showApiKey,
  onToggleApiKey,
  onSetDefault,
  onEdit,
  onDelete,
}: ModelCardProps) {
  const envMap = parseExtraEnv(model.extraEnvJson);
  const envCount = Object.keys(envMap).length;
  const hasPreset =
    envMap[PREDEFINED_ENV_KEYS.DISABLE_ADAPTIVE] === "1" ||
    typeof envMap[PREDEFINED_ENV_KEYS.DEFAULT_THINKING] === "string";

  return (
    <Card
      size="small"
      hoverable
      title={
        <Text strong>{model.provider}-{model.modelName}</Text>
      }
      extra={
        <Space size={4}>
          <Tag
            color={
              PROTOCOL_TAG_COLORS[model.protocol || "openai"] || "cyan"
            }
          >
            {PROTOCOL_LABELS[model.protocol || "openai"] || model.protocol}
          </Tag>
          {model.isDefault ? <Tag color="gold">Default</Tag> : null}
        </Space>
      }
      actions={[
        <span
          key="default"
          onClick={() => onSetDefault(model)}
          style={{ color: model.isDefault ? "#faad14" : undefined }}
        >
          {model.isDefault ? <StarFilled /> : <StarOutlined />}
        </span>,
        <EditOutlined key="edit" onClick={() => onEdit(model)} />,
        <DeleteOutlined
          key="delete"
          onClick={() => onDelete(model.id, model.name, model.isDefault)}
        />,
      ]}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Text type="secondary" className="text-xs w-16 shrink-0">
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
          <Text type="secondary" className="text-xs w-16 shrink-0">
            Model
          </Text>
          <Text className="text-xs">{model.modelName}</Text>
        </div>
        <div className="flex items-center gap-2">
          <Text type="secondary" className="text-xs w-16 shrink-0">
            API Key
          </Text>
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Text className="!text-xs font-mono" ellipsis>
              {showApiKey ? model.apiKey : maskApiKey(model.apiKey)}
            </Text>
            <Button
              type="text"
              size="small"
              icon={
                showApiKey ? (
                  <EyeInvisibleOutlined />
                ) : (
                  <EyeOutlined />
                )
              }
              onClick={() => onToggleApiKey(model.id)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Text type="secondary" className="text-xs w-16 shrink-0">
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
}
