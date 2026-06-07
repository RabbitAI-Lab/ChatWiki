"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ClearOutlined } from "@ant-design/icons";
import { useAuth } from "@/components/auth/useAuth";

interface Chat {
  id: number;
  title: string;
  projectId: string | null;
  workspaceId: string | null;
  modelName: string | null;
  templateName: string | null;
  creatorName: string | null;
  modifierName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ChatsData {
  chats: Chat[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ProjectMeta {
  id: string;
  name: string;
  ownerId?: string;
}

type TabScope = "owned" | "participated";

// Project icon (folder)
function ProjectIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// Workspace icon (layers)
function WorkspaceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

export default function ChatsPageClient() {
  const router = useRouter();
  const { user, isLoading: authLoading, authFetch } = useAuth();
  const t = useTranslations('chatsPage');
  const ts = useTranslations('settings');
  const [data, setData] = useState<ChatsData | null>(null);
  const [allProjects, setAllProjects] = useState<ProjectMeta[]>([]);
  const [allWorkspaces, setAllWorkspaces] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<TabScope>("owned");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const pageSize = 20;

  // Build maps from allProjects/allWorkspaces (which include both owned and member entities)
  const projectMap = (() => {
    const map = new Map<string, string>();
    for (const p of allProjects) map.set(p.id, p.name);
    return map;
  })();
  const workspaceMap = (() => {
    const map = new Map<string, string>();
    for (const w of allWorkspaces) map.set(w.id, w.name);
    return map;
  })();

  // Fetch all projects & workspaces (includes member entities)
  useEffect(() => {
    if (authLoading || !user) return;
    authFetch(`/api/fs/projects?type=personal&accountId=${user.id}`)
      .then((res) => res.json())
      .then((data: ProjectMeta[] | { error: string }) => {
        if (Array.isArray(data)) setAllProjects(data);
      });
    authFetch(`/api/fs/workspaces?type=personal&accountId=${user.id}`)
      .then((res) => res.json())
      .then((data: ProjectMeta[] | { error: string }) => {
        if (Array.isArray(data)) setAllWorkspaces(data);
      });
  }, [authLoading, user, authFetch]);

  // Fetch chats based on activeTab
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    // Schedule setState via microtask to satisfy react-hooks/set-state-in-effect
    Promise.resolve().then(() => {
      if (!cancelled) setLoading(true);
    });
    authFetch(`/api/chats?page=${page}&pageSize=${pageSize}&scope=${activeTab}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [page, activeTab, authLoading, user, authFetch]);

  const handleTabChange = (tab: TabScope) => {
    setActiveTab(tab);
    setPage(1);
    setConfirmDeleteId(null);
    setShowClearConfirm(false);
  };

  const handleDelete = async (chatId: number) => {
    await authFetch(`/api/chats/${chatId}`, { method: "DELETE" });
    setConfirmDeleteId(null);
    authFetch(`/api/chats?page=${page}&pageSize=${pageSize}&scope=${activeTab}`)
      .then((res) => res.json())
      .then((json) => setData(json));
  };

  const handleClearAll = async () => {
    await authFetch("/api/chats", { method: "DELETE" });
    setShowClearConfirm(false);
    authFetch(`/api/chats?page=${page}&pageSize=${pageSize}&scope=${activeTab}`)
      .then((res) => res.json())
      .then((json) => setData(json));
    router.refresh();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderLocation = (chat: Chat) => {
    if (chat.projectId) {
      const name = projectMap.get(chat.projectId) || chat.projectId;
      return (
        <span className="flex items-center gap-1.5">
          <ProjectIcon className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
          <span className="truncate">{name}</span>
        </span>
      );
    }
    if (chat.workspaceId) {
      const name = workspaceMap.get(chat.workspaceId) || chat.workspaceId;
      return (
        <span className="flex items-center gap-1.5">
          <WorkspaceIcon className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
          <span className="truncate">{name}</span>
        </span>
      );
    }
    return <span className="text-gray-300 dark:text-zinc-600">-</span>;
  };

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t('title')}</h1>
        <span className="flex items-center gap-3">
          <span className="text-sm text-gray-400 dark:text-gray-500">
            {data ? t('totalChats', { count: data.total }) : ""}
          </span>
          {activeTab === "owned" && data && data.total > 0 && (
            <span className="relative">
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center justify-center p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                title={t('clearAll')}
              >
                <ClearOutlined className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" style={{ fontSize: '14px' }} />
              </button>
              {showClearConfirm && (
                <span className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 px-3 py-2 flex items-center gap-2 text-xs whitespace-nowrap z-50">
                  <span className="text-gray-500">{t('confirmClearAll')}</span>
                  <button
                    onClick={handleClearAll}
                    className="px-1.5 py-0.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                  >{t('clear')}</button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-1.5 py-0.5 text-gray-500 hover:text-gray-700 transition-colors"
                  >{t('cancel')}</button>
                </span>
              )}
            </span>
          )}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-gray-200 dark:border-zinc-700">
        <button
          onClick={() => handleTabChange("owned")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "owned"
              ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
              : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          {t('tabMyEntities')}
        </button>
        <button
          onClick={() => handleTabChange("participated")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "participated"
              ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
              : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          {t('tabParticipated')}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-400 dark:text-gray-500">{t('loading')}</div>
        </div>
      ) : data && data.chats.length > 0 ? (
        <>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr className="border-b border-gray-200 dark:border-zinc-700">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ width: "300px" }}>
                    {ts('columnTitle')}
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ width: "192px" }}>
                    {t('columnLocation')}
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ width: "112px" }}>
                    {t('columnCreator')}
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ width: "112px" }}>
                    {t('columnModifier')}
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ width: "144px" }}>
                    {ts('columnModel')}
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ width: "144px" }}>
                    {ts('columnTemplate')}
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ width: "176px" }}>
                    {ts('columnCreated')}
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ width: "176px" }}>
                    {ts('columnUpdated')}
                  </th>
                  <th style={{ width: "48px" }}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-700/50">
                {data.chats.map((chat) => (
                  <tr
                    key={chat.id}
                    onClick={() => {
                      if (chat.projectId) {
                        router.push(`/project/${chat.projectId}?chatId=${chat.id}`);
                      } else if (chat.workspaceId) {
                        router.push(`/workspace/${chat.workspaceId}?chatId=${chat.id}`);
                      } else {
                        router.push(`/chat/${chat.id}`);
                      }
                    }}
                    className="hover:bg-blue-50 dark:hover:bg-zinc-700/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-800 dark:text-gray-100 truncate block">
                        {chat.title}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">
                      {renderLocation(chat)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400 truncate">
                      {chat.creatorName || <span className="text-gray-300 dark:text-zinc-600">-</span>}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400 truncate">
                      {chat.modifierName || <span className="text-gray-300 dark:text-zinc-600">-</span>}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400 truncate">
                      {chat.modelName || <span className="text-gray-300 dark:text-zinc-600">-</span>}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400 truncate">
                      {chat.templateName || <span className="text-gray-300 dark:text-zinc-600">-</span>}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(chat.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(chat.updatedAt)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(confirmDeleteId === chat.id ? null : chat.id); }}
                          className="text-red-400 hover:text-red-600 dark:hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                        {confirmDeleteId === chat.id && (
                          <span
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 bottom-full mb-1 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 px-3 py-2 flex items-center gap-2 text-xs whitespace-nowrap z-50"
                          >
                            <span className="text-gray-500">{t('confirmDelete')}</span>
                            <button
                              onClick={() => handleDelete(chat.id)}
                              className="px-1.5 py-0.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                            >{t('delete')}</button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-1.5 py-0.5 text-gray-500 hover:text-gray-700 transition-colors"
                            >{t('cancel')}</button>
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-zinc-700">
              <button
                onClick={() => { setLoading(true); setPage((p) => Math.max(1, p - 1)); }}
                disabled={page <= 1}
                className="px-4 py-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {t('previous')}
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {t('pageInfo', { page, totalPages: data.totalPages })}
              </span>
              <button
                onClick={() => { setLoading(true); setPage((p) => Math.min(data.totalPages, p + 1)); }}
                disabled={page >= data.totalPages}
                className="px-4 py-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {t('next')}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 dark:text-gray-500 mb-2">{t('noChatRecords')}</p>
            <button
              onClick={() => router.push("/chat/new")}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              {t('startNewChat')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
