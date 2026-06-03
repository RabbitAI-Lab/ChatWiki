"use client";

import { Input, Modal } from "antd";

export interface ApiKeyMcpModalProps {
  open: boolean;
  // Name of the server the key belongs to; null when modal is closed.
  name: string | null;
  // Current value of the API key input (controlled).
  value: string;
  saving: boolean;
  onChange: (value: string) => void;
  onOk: () => void;
  onCancel: () => void;
}

/**
 * Modal for editing the API key of an MCP server (e.g. zhipu-style).
 * The key is stored in `_apiKeys` and appended to the server URL as
 * `?Authorization=<key>` on save.
 */
export default function ApiKeyMcpModal({
  open,
  name,
  value,
  saving,
  onChange,
  onOk,
  onCancel,
}: ApiKeyMcpModalProps) {
  return (
    <Modal
      title={name ? `API Key for "${name}"` : "API Key"}
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      okText="Save"
      cancelText="Cancel"
      confirmLoading={saving}
    >
      <p className="text-xs text-gray-500 mb-2">
        The key will be stored in <code>_apiKeys</code> and prepended to the
        server URL as <code>?Authorization=&lt;key&gt;</code>.
      </p>
      <Input.Password
        placeholder="Enter API Key"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus
      />
    </Modal>
  );
}
