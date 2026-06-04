"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/useAuth";
import { Card, Button, Typography, Descriptions, App } from "antd";
import { SafetyCertificateOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

const { Text, Title } = Typography;

export default function CliConsentPage() {
  const searchParams = useSearchParams();
  const { authFetch, user } = useAuth();
  const { message } = App.useApp();
  const router = useRouter();
  const [brandName, setBrandName] = useState("RabbitDocs");

  useEffect(() => {
    fetch("/api/brand")
      .then((res) => res.json())
      .then((data) => {
        if (data?.brandName) setBrandName(data.brandName);
      })
      .catch(() => {});
  }, []);

  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = searchParams.get("code_challenge_method") || "S256";
  const redirectUri = searchParams.get("redirect_uri");
  const state = searchParams.get("state");

  if (!codeChallenge || !redirectUri || !state) {
    return (
      <Card className="shadow-lg">
        <Title level={4}>错误</Title>
        <Text type="danger">缺少必要的 OAuth 参数</Text>
      </Card>
    );
  }

  const handleApprove = async () => {
    try {
      // 服务端会返回 302 重定向到 CLI 回调
      const res = await authFetch("/api/auth/cli/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          redirect_uri: redirectUri,
          state,
        }),
        redirect: "manual",
      });

      // 手动处理重定向
      if (res.status === 302 || res.type === "opaqueredirect") {
        message.success("已授权，请返回终端查看");
        return;
      }

      // 如果没有重定向，可能直接返回了结果
      if (res.ok) {
        message.success("已授权");
      }
    } catch (err) {
      message.error("授权失败");
    }
  };

  const handleDeny = () => {
    const denyUrl = new URL(redirectUri);
    denyUrl.searchParams.set("error", "access_denied");
    denyUrl.searchParams.set("state", state);
    window.location.href = denyUrl.toString();
  };

  return (
    <Card className="shadow-lg">
      <div className="text-center mb-6">
        <SafetyCertificateOutlined style={{ fontSize: 48, color: "#1677ff" }} />
        <Title level={4} className="mt-4">
          CLI 授权请求
        </Title>
        <p className="text-gray-500">
          一个 CLI 工具请求访问您的 {brandName} 账号
        </p>
      </div>

      <Descriptions column={1} bordered size="small" className="mb-6">
        <Descriptions.Item label="当前用户">{user?.email}</Descriptions.Item>
        <Descriptions.Item label="回调地址">
          <Text code className="text-xs">{redirectUri}</Text>
        </Descriptions.Item>
      </Descriptions>

      <div className="mb-6">
        <Text type="secondary">授权后 CLI 将能够：</Text>
        <ul className="mt-2 text-sm text-gray-600 list-disc pl-5">
          <li>访问您的个人资料信息</li>
          <li>管理项目和工作区</li>
          <li>执行命令</li>
        </ul>
      </div>

      <div className="flex gap-3 justify-center">
        <Button size="large" onClick={handleDeny}>
          拒绝
        </Button>
        <Button type="primary" size="large" onClick={handleApprove}>
          授权
        </Button>
      </div>
    </Card>
  );
}
