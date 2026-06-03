"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/useAuth";
import { Button, Form, Input, Card, App, Typography, Spin } from "antd";
import { MailOutlined, LockOutlined, RocketOutlined } from "@ant-design/icons";

const { Text } = Typography;

export default function SetupPage() {
  const { loginWithTokens } = useAuth();
  const router = useRouter();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [alreadyInitialized, setAlreadyInitialized] = useState(false);

  useEffect(() => {
    fetch("/api/auth/init-status")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.initialized) {
          setAlreadyInitialized(true);
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Spin size="large" />
      </div>
    );
  }

  if (alreadyInitialized) {
    return (
      <Card className="shadow-lg">
        <div className="text-center py-6">
          <RocketOutlined style={{ fontSize: 48, color: "#52c41a" }} />
          <h2 className="mt-4 text-xl font-semibold">系统已初始化</h2>
          <p className="text-gray-500 mt-2 mb-4">系统已经完成初始化，请直接登录</p>
          <Button type="primary" onClick={() => router.push("/login")}>
            前往登录
          </Button>
        </div>
      </Card>
    );
  }


  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        message.error(data.error || "初始化失败");
        return;
      }

      loginWithTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });

      if (data.inviteCode) {
        setInviteCode(data.inviteCode);
        message.success(
          `系统初始化成功！初始邀请码: ${data.inviteCode}`
        );
      }

      router.push("/");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "初始化失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <div className="text-center mb-6">
        <RocketOutlined style={{ fontSize: 48, color: "#1677ff" }} />
        <h2 className="mt-4 text-xl font-semibold">初始化 RabbitDocs</h2>
        <p className="text-gray-500 mt-2">
          创建管理员账号以开始使用系统
        </p>
      </div>

      <Form onFinish={onFinish} layout="vertical" size="large">
        <Form.Item
          name="email"
          rules={[
            { required: true, message: "请输入管理员邮箱" },
            { type: "email", message: "请输入有效的邮箱地址" },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="管理员邮箱" autoComplete="email" />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[
            { required: true, message: "请输入密码" },
            { min: 6, message: "密码至少 6 个字符" },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="管理员密码"
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          dependencies={["password"]}
          rules={[
            { required: true, message: "请确认密码" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("password") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error("两次输入的密码不一致"));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="确认密码"
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            初始化系统
          </Button>
        </Form.Item>
      </Form>

      {inviteCode && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-center">
          <Text type="secondary">初始邀请码：</Text>
          <Text strong copyable className="ml-2">
            {inviteCode}
          </Text>
        </div>
      )}
    </Card>
  );
}
