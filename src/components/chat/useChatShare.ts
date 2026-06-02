"use client";

import { useState, useEffect } from "react";
import { App } from "antd";

interface UseChatShareOptions {
  effectiveChatId: number | null;
}

export function useChatShare({ effectiveChatId }: UseChatShareOptions) {
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const { message } = App.useApp();

  // 查询当前会话的分享状态
  useEffect(() => {
    if (!effectiveChatId) {
      setShareToken(null);
      return;
    }
    fetch(`/api/chats/${effectiveChatId}/share`)
      .then((r) => r.json())
      .then((data) => {
        setShareToken(data.token);
      });
  }, [effectiveChatId]);

  const handleShare = async () => {
    if (!effectiveChatId) return;
    setShareLoading(true);
    try {
      if (!shareToken) {
        const res = await fetch(`/api/chats/${effectiveChatId}/share`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setShareToken(data.token);
        }
      }
      setShareOpen(true);
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyLink = () => {
    const url = shareToken ? `${window.location.origin}/share/${shareToken}` : "";
    if (url) {
      navigator.clipboard.writeText(url);
      message.success("分享链接已复制到剪贴板");
    }
  };

  const handleRegenerateLink = async () => {
    if (!effectiveChatId) return;
    setShareLoading(true);
    try {
      const res = await fetch(`/api/chats/${effectiveChatId}/share`, { method: "PATCH" });
      if (res.ok) {
        const data = await res.json();
        setShareToken(data.token);
        message.success("已重新生成分享链接");
      }
    } finally {
      setShareLoading(false);
    }
  };

  const handleCancelShare = async () => {
    if (!effectiveChatId) return;
    setShareLoading(true);
    try {
      const res = await fetch(`/api/chats/${effectiveChatId}/share`, { method: "DELETE" });
      if (res.ok) {
        setShareToken(null);
        setShareOpen(false);
        message.success("已取消分享");
      }
    } finally {
      setShareLoading(false);
    }
  };

  return {
    shareToken,
    shareOpen,
    setShareOpen,
    shareLoading,
    handleShare,
    handleCopyLink,
    handleRegenerateLink,
    handleCancelShare,
  };
}
