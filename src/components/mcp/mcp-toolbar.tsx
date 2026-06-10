"use client";

import { useTranslations } from "next-intl";
import { PlusOutlined, ImportOutlined } from "@ant-design/icons";
import { Button, Space } from "antd";

export interface McpToolbarProps {
  enabledCount: number;
  totalCount: number;
  onAdd: () => void;
  onImport?: () => void;
}

/**
 * Top toolbar: shows the enabled/configured count on the left and the
 * "Add MCP" button (and optional "Import" button) on the right.
 */
export default function McpToolbar({
  enabledCount,
  totalCount,
  onAdd,
  onImport,
}: McpToolbarProps) {
  const t = useTranslations('workspace');
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {t('mcp.toolbarCount', { enabled: enabledCount, total: totalCount })}
      </span>
      <Space size="small">
        {onImport && (
          <Button
            size="small"
            icon={<ImportOutlined />}
            onClick={onImport}
          >
            {t('mcp.importFromAccount')}
          </Button>
        )}
        <Button
          type="primary"
          onClick={onAdd}
          size="small"
          icon={<PlusOutlined />}
        >
          {t('mcp.addMcp')}
        </Button>
      </Space>
    </div>
  );
}
