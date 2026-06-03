"use client";

import { Form, Input, Modal, Select } from "antd";
import type { FormInstance } from "antd";
import { NAME_PATTERN } from "./types";

export interface AddMcpModalProps {
  open: boolean;
  saving: boolean;
  // Form instance owned by the parent (hook) so that openAdd can
  // reset/setFieldsValue on it.
  form: FormInstance;
  onOk: () => void;
  onCancel: () => void;
}

/**
 * Modal with a Form to add a new MCP server. Supports stdio, http, and sse.
 * Stdio: command + args + env (one KEY=VALUE per line).
 * Http/SSE: url + headers (one Key: Value per line).
 */
export default function AddMcpModal({
  open,
  saving,
  form,
  onOk,
  onCancel,
}: AddMcpModalProps) {
  return (
    <Modal
      title="Add MCP Server"
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      okText="Add"
      cancelText="Cancel"
      confirmLoading={saving}
      width={560}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" className="mt-2">
        <Form.Item
          name="name"
          label="Name"
          rules={[
            { required: true, message: "Please input a name" },
            {
              pattern: NAME_PATTERN,
              message:
                "Only letters, digits, underscore and dash are allowed",
            },
          ]}
        >
          <Input placeholder="e.g. gitnexus" />
        </Form.Item>

        <Form.Item
          name="type"
          label="Type"
          rules={[{ required: true }]}
        >
          <Select
            options={[
              { value: "stdio", label: "stdio (local command)" },
              { value: "http", label: "http (remote endpoint)" },
              { value: "sse", label: "sse (server-sent events)" },
            ]}
            onChange={(val) => {
              // Clear unrelated fields when switching type to avoid stale data.
              if (val === "stdio") {
                form.setFieldsValue({ url: undefined, headers: undefined });
              } else {
                form.setFieldsValue({
                  command: undefined,
                  args: undefined,
                  env: undefined,
                });
              }
            }}
          />
        </Form.Item>

        <Form.Item shouldUpdate>
          {() => {
            const type = form.getFieldValue("type");
            if (type === "stdio") {
              return (
                <>
                  <Form.Item
                    name="command"
                    label="Command"
                    rules={[
                      { required: true, message: "Please input command" },
                    ]}
                  >
                    <Input placeholder="e.g. npx" />
                  </Form.Item>
                  <Form.Item name="args" label="Args (space-separated)">
                    <Input placeholder="e.g. -y gitnexus@latest mcp" />
                  </Form.Item>
                  <Form.Item
                    name="env"
                    label="Environment variables (one KEY=VALUE per line, optional)"
                  >
                    <Input.TextArea
                      rows={3}
                      placeholder={"API_KEY=xxx\nDEBUG=1"}
                      className="font-mono text-sm"
                    />
                  </Form.Item>
                </>
              );
            }
            return (
              <>
                <Form.Item
                  name="url"
                  label="URL"
                  rules={[
                    { required: true, message: "Please input URL" },
                    { type: "url", message: "Please input a valid URL" },
                  ]}
                >
                  <Input placeholder="https://example.com/mcp" />
                </Form.Item>
                <Form.Item
                  name="headers"
                  label="Headers (one Key: Value per line, optional)"
                >
                  <Input.TextArea
                    rows={3}
                    placeholder={"Authorization: Bearer xxx"}
                    className="font-mono text-sm"
                  />
                </Form.Item>
              </>
            );
          }}
        </Form.Item>
      </Form>
    </Modal>
  );
}
