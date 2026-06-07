"use client";

import { useTranslations } from "next-intl";
import { PlusOutlined } from "@ant-design/icons";
import { Button } from "antd";

export interface McpToolbarProps {
  enabledCount: number;
  totalCount: number;
  onAdd: () => void;
}

/**
 * Top toolbar: shows the enabled/configured count on the left and the
 * "Add MCP" button on the right.
 */
export default function McpToolbar({
  enabledCount,
  totalCount,
  onAdd,
}: McpToolbarProps) {
  const t = useTranslations('workspace');
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {t('mcp.toolbarCount', { enabled: enabledCount, total: totalCount })}
      </span>
      <Button
        type="primary"
        onClick={onAdd}
        size="small"
        icon={<PlusOutlined />}
      >
        {t('mcp.addMcp')}
      </Button>
    </div>
  );
}
