"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/useAuth";
import { Switch, App } from "antd";
import type { ProjectMeta } from "./types";
import type { PublishStatus } from "@/lib/fs";

interface PublishPanelProps {
  projectId: string;
  projectName: string;
  projectMeta: ProjectMeta | null;
}

export default function PublishPanel({
  projectId,
  projectName: _projectName,
  projectMeta,
}: PublishPanelProps) {
  const t = useTranslations("project");
  const { message: messageApi } = App.useApp();
  const { authFetch, user } = useAuth();

  const isOwner = user?.id === projectMeta?.ownerId;

  const [publishStatus, setPublishStatus] = useState<PublishStatus>(
    projectMeta?.publishStatus ?? { enabled: false }
  );
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);

  // 加载发布状态
  useEffect(() => {
    authFetch(`/api/fs/project-publish?projectId=${projectId}`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data?.publishStatus) {
          setPublishStatus(data.publishStatus);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId, authFetch]);

  // 切换发布状态
  const handleToggle = async (enabled: boolean) => {
    setToggling(true);
    try {
      const res = await authFetch("/api/fs/project-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, enabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setPublishStatus(data.publishStatus);
        messageApi.success(
          enabled ? t("publish.enableSuccess") : t("publish.disableSuccess")
        );
      } else {
        const data = await res.json();
        messageApi.error(data.error || (enabled ? t("publish.enableFailed") : t("publish.disableFailed")));
      }
    } catch {
      messageApi.error(enabled ? t("publish.enableFailed") : t("publish.disableFailed"));
    } finally {
      setToggling(false);
    }
  };

  // 复制链接
  const handleCopy = () => {
    const url = `${window.location.origin}/docify?projectId=${projectId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      messageApi.success(t("publish.copied"));
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // 在新标签页打开
  const handleOpen = () => {
    window.open(`/docify?projectId=${projectId}`, "_blank");
  };

  const publishUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/docify?projectId=${projectId}`
      : `/docify?projectId=${projectId}`;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 标题区 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">
          {t("publish.title")}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t("publish.description")}
        </p>
      </div>

      {/* 发布状态开关 */}
      <div className="flex items-center justify-between py-3 border border-gray-200 dark:border-zinc-700 rounded-lg px-4">
        <div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("publish.status")}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {publishStatus.enabled ? t("publish.enabled") : t("publish.disabled")}
          </div>
        </div>
        <Switch
          checked={publishStatus.enabled}
          loading={toggling || loading}
          disabled={!isOwner}
          onChange={handleToggle}
        />
      </div>

      {/* 发布地址 */}
      {publishStatus.enabled && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("publish.url")}
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 text-xs bg-gray-100 dark:bg-zinc-800 rounded-lg text-gray-700 dark:text-gray-300 break-all select-all">
              {publishUrl}
            </code>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 shrink-0 text-sm font-medium border rounded-lg px-3 py-2 transition-colors"
              style={{
                color: "var(--color-primary, #3B82F6)",
                borderColor: "var(--color-primary, #3B82F6)",
              }}
            >
              {copied ? (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
              {t("publish.copyUrl")}
            </button>
            <button
              onClick={handleOpen}
              className="inline-flex items-center gap-1.5 shrink-0 text-sm font-medium border rounded-lg px-3 py-2 transition-colors text-gray-600 dark:text-gray-400 border-gray-300 dark:border-zinc-600 hover:text-gray-800 dark:hover:text-gray-200"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              {t("publish.openInNewTab")}
            </button>
          </div>
        </div>
      )}

      {/* 发布时间 */}
      {publishStatus.enabled && publishStatus.publishedAt && (
        <div className="text-xs text-gray-400 dark:text-gray-500">
          {t("publish.publishedAt")}: {new Date(publishStatus.publishedAt).toLocaleString()}
        </div>
      )}

      {/* 使用说明 */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 p-4 space-y-2">
        <div className="text-sm font-medium text-blue-700 dark:text-blue-400">
          {t("publish.tips")}
        </div>
        <ul className="text-xs text-blue-600 dark:text-blue-300/80 space-y-1 list-disc list-inside">
          <li>{t("publish.tip1")}</li>
          <li>{t("publish.tip2")}</li>
          <li>{t("publish.tip3")}</li>
        </ul>
      </div>

      {/* 非 Owner 提示 */}
      {!isOwner && (
        <div className="text-xs text-gray-400 dark:text-gray-500">
          {t("publish.notOwner")}
        </div>
      )}
    </div>
  );
}
