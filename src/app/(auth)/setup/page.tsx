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
  const [brandName, setBrandName] = useState("RabbitDocs");

  useEffect(() => {
    fetch("/api/brand")
      .then((res) => res.json())
      .then((data) => {
        if (data?.brandName) setBrandName(data.brandName);
      })
      .catch(() => {});
  }, []);

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
          <h2 className="mt-4 text-xl font-semibold">System Already Initialized</h2>
          <p className="text-gray-500 mt-2 mb-4">The system has been initialized. Please log in directly.</p>
          <Button type="primary" onClick={() => router.push("/login")}>
            Go to Login
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
        message.error(data.error || "Setup failed");
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
          `Setup successful! Initial invite code: ${data.inviteCode}`
        );
      }

      router.push("/");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <div className="text-center mb-6">
        <RocketOutlined style={{ fontSize: 48, color: "#1677ff" }} />
        <h2 className="mt-4 text-xl font-semibold">Initialize {brandName}</h2>
        <p className="text-gray-500 mt-2">
          Create an admin account to get started
        </p>
      </div>

      <Form onFinish={onFinish} layout="vertical" size="large">
        <Form.Item
          name="email"
          rules={[
            { required: true, message: "Please enter admin email" },
            { type: "email", message: "Please enter a valid email address" },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="Admin Email" autoComplete="email" />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[
            { required: true, message: "Please enter password" },
            { min: 6, message: "Password must be at least 6 characters" },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="Admin Password"
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          dependencies={["password"]}
          rules={[
            { required: true, message: "Please confirm password" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("password") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error("Passwords do not match"));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="Confirm Password"
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Initialize System
          </Button>
        </Form.Item>
      </Form>

      {inviteCode && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-center">
          <Text type="secondary">Initial Invite Code:</Text>
          <Text strong copyable className="ml-2">
            {inviteCode}
          </Text>
        </div>
      )}
    </Card>
  );
}
