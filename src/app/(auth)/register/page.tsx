"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/useAuth";
import { Button, Form, Input, Card, App, Result } from "antd";
import { MailOutlined, LockOutlined, UserOutlined } from "@ant-design/icons";
import Link from "next/link";

interface RegistrationStatus {
  openRegistration: boolean;
  requireInviteCode: boolean;
  generalKeyEnabled: boolean;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [regStatus, setRegStatus] = useState<RegistrationStatus | null>(null);
  const [devHint, setDevHint] = useState<{
    verificationUrl?: string;
    verificationCode?: string;
    hint?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/registration-status")
      .then((res) => res.json())
      .then((data) => setRegStatus(data))
      .catch(() =>
        setRegStatus({
          openRegistration: true,
          requireInviteCode: false,
          generalKeyEnabled: false,
        })
      );
  }, []);

  const onFinish = async (values: {
    email: string;
    password: string;
    name?: string;
    inviteCode?: string;
    generalKey?: string;
  }) => {
    setLoading(true);
    try {
      const result = await register(
        values.email,
        values.password,
        values.name,
        values.inviteCode,
        values.generalKey
      );
      setSuccess(true);
      if (result.verificationUrl || result.verificationCode) {
        setDevHint({
          verificationUrl: result.verificationUrl,
          verificationCode: result.verificationCode,
          hint: result.devHint,
        });
      }
      message.success("Registration successful! Please check your email for the verification link.");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="shadow-lg">
        <Result
          status="success"
          title="Registration Successful"
          subTitle="Please check your email to verify your account, then log in."
          extra={
            <div className="flex flex-col gap-2 items-center">
              <Button type="primary" onClick={() => router.push("/login")}>
                Go to Login
              </Button>
              {devHint?.verificationCode && (
                <Button
                  type="link"
                  onClick={() => router.push(`/verify-email`)}
                >
                  I have received the verification code
                </Button>
              )}
            </div>
          }
        />
        {devHint && (
          <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-left">
            <div className="text-amber-800 font-medium text-sm mb-2">
              ⚙️ Local Development Hint
            </div>
            <div className="text-amber-700 text-xs mb-3">
              {devHint.hint || "SMTP not configured. The verification code is displayed below (local development only)."}
            </div>
            {devHint.verificationCode && (
              <div className="mb-2">
                <div className="text-xs text-amber-700 mb-1">Verification Code:</div>
                <div className="text-2xl font-mono font-bold tracking-widest text-amber-900 select-all">
                  {devHint.verificationCode}
                </div>
              </div>
            )}
            {devHint.verificationUrl && (
              <div>
                <div className="text-xs text-amber-700 mb-1">Verification Link:</div>
                <a
                  href={devHint.verificationUrl}
                  className="text-xs text-blue-600 break-all hover:underline"
                >
                  {devHint.verificationUrl}
                </a>
              </div>
            )}
          </div>
        )}
      </Card>
    );
  }

  if (regStatus && !regStatus.openRegistration) {
    return (
      <Card className="shadow-lg">
        <Result
          status="warning"
          title="Registration Closed"
          subTitle="New user registration is currently not accepted."
          extra={
            <Button type="primary" onClick={() => router.push("/login")}>
              Back to Login
            </Button>
          }
        />
      </Card>
    );
  }

  const requireInviteCode = regStatus?.requireInviteCode ?? false;
  const generalKeyEnabled = regStatus?.generalKeyEnabled ?? false;
  const prefillCode = searchParams.get("code") || undefined;
  const prefillGeneralKey = searchParams.get("generalKey") || undefined;
  const hasPrefill = !!(prefillCode || prefillGeneralKey);
  const showGeneralKey = prefillGeneralKey || generalKeyEnabled || requireInviteCode;

  return (
    <Card title="Register for RabbitDocs" className="shadow-lg">
      <Form
        onFinish={onFinish}
        layout="vertical"
        size="large"
        initialValues={{
          inviteCode: prefillCode,
          generalKey: prefillGeneralKey,
        }}
      >
        <Form.Item
          name="email"
          rules={[
            { required: true, message: "Please enter your email" },
            { type: "email", message: "Please enter a valid email address" },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="Email" autoComplete="email" />
        </Form.Item>

        <Form.Item name="name">
          <Input prefix={<UserOutlined />} placeholder="Display name (optional)" />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[
            { required: true, message: "Please enter your password" },
            { min: 6, message: "Password must be at least 6 characters" },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="Password (at least 6 characters)"
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          dependencies={["password"]}
          rules={[
            { required: true, message: "Please confirm your password" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("password") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error("The two passwords do not match"));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="Confirm password"
            autoComplete="new-password"
          />
        </Form.Item>

        {(requireInviteCode || prefillCode) && (
          <Form.Item
            name="inviteCode"
            rules={requireInviteCode ? [{ required: true, message: "Please enter the invite code" }] : []}
          >
            <Input placeholder="Invite code" />
          </Form.Item>
        )}

        {showGeneralKey && (
          <Form.Item name="generalKey">
            <Input
              placeholder={
                prefillGeneralKey
                  ? "General registration key"
                  : requireInviteCode
                    ? "General registration key (can replace invite code)"
                    : "General registration key (optional)"
              }
            />
          </Form.Item>
        )}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Register
          </Button>
        </Form.Item>
      </Form>

      <div className="text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-600 hover:text-blue-800">
          Log in
        </Link>
      </div>
    </Card>
  );
}
