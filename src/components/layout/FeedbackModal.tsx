"use client";

import { useState } from "react";
import { Modal, Form, Input, Select, App } from "antd";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/useAuth";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

export default function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const { authFetch } = useAuth();
  const { message } = App.useApp();
  const t = useTranslations("feedbackModal");

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const res = await authFetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit");
      }
      message.success(t("submitSuccess"));
      form.resetFields();
      onClose();
    } catch (error: unknown) {
      if (error instanceof Error && error.message !== "Validation failed") {
        message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={t("title")}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={submitting ? t("submitting") : t("submit")}
      cancelText={t("cancel")}
      confirmLoading={submitting}
      width={520}
      centered
      destroyOnHidden
      mask={{ closable: false }}
      styles={{
        container: { border: "1px solid var(--popup-border)" },
        body: { maxHeight: "calc(90vh - 110px)", overflowY: "auto" },
      }}
    >
      <Form
        form={form}
        layout="vertical"
        className="mt-4"
        initialValues={{ type: "bug" }}
      >
        <Form.Item
          label={t("titleLabel")}
          name="title"
          rules={[
            { required: true, message: t("titleRequired") },
            { max: 200, message: t("titleMaxLength") },
          ]}
        >
          <Input
            placeholder={t("titlePlaceholder")}
            maxLength={200}
            autoFocus
            style={{ background: "transparent" }}
          />
        </Form.Item>
        <Form.Item
          label={t("typeLabel")}
          name="type"
          rules={[{ required: true, message: t("typeRequired") }]}
        >
          <Select style={{ background: "transparent" }}>
            <Select.Option value="bug">{t("typeBug")}</Select.Option>
            <Select.Option value="improvement">
              {t("typeImprovement")}
            </Select.Option>
            <Select.Option value="other">{t("typeOther")}</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item
          label={t("contentLabel")}
          name="content"
          rules={[
            { required: true, message: t("contentRequired") },
            { max: 2000, message: t("contentMaxLength") },
          ]}
        >
          <Input.TextArea
            placeholder={t("contentPlaceholder")}
            maxLength={2000}
            rows={4}
            showCount
            style={{ background: "transparent" }}
          />
        </Form.Item>
        <Form.Item
          label={t("contactLabel")}
          name="contact"
          rules={[{ max: 200, message: t("contactMaxLength") }]}
        >
          <Input
            placeholder={t("contactPlaceholder")}
            maxLength={200}
            style={{ background: "transparent" }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
