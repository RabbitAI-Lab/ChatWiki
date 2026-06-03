"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  Result,
  Spin,
  Input,
  Button,
  App,
  Typography,
  Divider,
} from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import Link from "next/link";

const { Text, Paragraph } = Typography;

type Status = "verifying" | "success" | "error" | "awaiting-code";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMessage, setErrorMessage] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const token = searchParams.get("token");
    if (!token) {
      // 没有 token：进入"输入验证码"模式
      setStatus("awaiting-code");
      return;
    }

    fetch(`/api/auth/verify-email?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMessage(data.error || "验证失败");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMessage("网络错误，请稍后重试");
      });
  }, [searchParams]);

  const handleSubmitCode = async () => {
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      message.warning("请输入 6 位数字验证码");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
      } else {
        setErrorMessage(data.error || "验证失败");
        setStatus("error");
      }
    } catch {
      setErrorMessage("网络错误，请稍后重试");
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "verifying") {
    return (
      <Card className="shadow-lg">
        <div className="text-center py-8">
          <Spin size="large" />
          <p className="mt-4 text-gray-500">正在验证您的邮箱...</p>
        </div>
      </Card>
    );
  }

  if (status === "success") {
    return (
      <Card className="shadow-lg">
        <Result
          icon={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
          title="邮箱验证成功"
          subTitle="您的邮箱已成功验证，现在可以登录了。"
          extra={
            <Link href="/login">
              <Button type="primary">前往登录</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card className="shadow-lg">
        <Result
          icon={<CloseCircleOutlined style={{ color: "#ff4d4f" }} />}
          title="验证失败"
          subTitle={errorMessage}
          extra={
            <div className="flex flex-col gap-2 items-center">
              <Button
                type="default"
                onClick={() => {
                  setStatus("awaiting-code");
                  setErrorMessage("");
                }}
              >
                重新输入验证码
              </Button>
              <Link href="/login">
                <Button type="link">返回登录</Button>
              </Link>
            </div>
          }
        />
      </Card>
    );
  }

  // awaiting-code
  return (
    <Card title="输入邮箱验证码" className="shadow-lg">
      <Paragraph type="secondary" className="!mb-4">
        请输入您收到的 6 位数字验证码以验证邮箱。验证码 24 小时内有效。
      </Paragraph>
      <div className="space-y-3">
        <Input
          size="large"
          maxLength={6}
          placeholder="例如 123456"
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          onPressEnter={handleSubmitCode}
          autoFocus
          style={{
            fontSize: 24,
            letterSpacing: 8,
            textAlign: "center",
            fontFamily: "monospace",
          }}
        />
        <Button
          type="primary"
          size="large"
          block
          loading={submitting}
          disabled={code.length !== 6}
          onClick={handleSubmitCode}
        >
          验证
        </Button>
      </div>
      <Divider />
      <div className="text-center text-sm text-gray-500">
        <Link href="/login">返回登录</Link>
      </div>
    </Card>
  );
}
