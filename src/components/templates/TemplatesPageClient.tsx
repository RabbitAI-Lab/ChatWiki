"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Modal, Input, Form, App } from "antd";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/auth/useAuth";
import { useRouter } from "next/navigation";
import Spinner from "@/components/ui/Spinner";

interface Template {
  id: number;
  name: string;
  description: string | null;
  content: string;
  icon: string | null;
  agentPrompt: string | null;
  isSystem: boolean;  // false=用户创建, true=系统模板
  createdAt: string;
  updatedAt: string;
}

interface TemplatesPageClientProps {
  initialTemplates: Template[];
}

export default function TemplatesPageClient({ initialTemplates }: TemplatesPageClientProps) {
  const { message } = App.useApp();
  const router = useRouter();
  const t = useTranslations('templates');
  const { resolvedTheme } = useTheme();
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(false);
  const isDark = resolvedTheme === "dark";

  // New Template
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "", icon: "" });
  const [creating, setCreating] = useState(false);
  const [createFormInstance] = Form.useForm();

  // Copy Template
  const [copyingTemplate, setCopyingTemplate] = useState<Template | null>(null);
  const [copyName, setCopyName] = useState("");
  const [copying, setCopying] = useState(false);

  const refreshList = async () => {
    setLoading(true);
    const res = await authFetch("/api/templates");
    const data = await res.json();
    setTemplates(data);
    setLoading(false);
  };

  const modalStyles = useMemo(() => ({
    mask: {
      background: isDark ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.15)",
      backdropFilter: "blur(6px) saturate(1.4)",
      WebkitBackdropFilter: "blur(6px) saturate(1.4)",
    },
    container: {
      background: 'var(--main-bg)',
      border: '1px solid var(--popup-border)',
      boxShadow: isDark
        ? "0 8px 32px -4px rgba(0, 0, 0, 0.4), 0 2px 8px -2px rgba(0, 0, 0, 0.3)"
        : "0 8px 32px -4px rgba(0, 0, 0, 0.08), 0 2px 8px -2px rgba(0, 0, 0, 0.04)",
    },
    header: {
      borderBottom: "none",
    },
    footer: {
      borderTop: "none",
      paddingTop: 8,
      paddingBottom: 4,
    },
  }), [isDark]);

  const okBtnProps = useMemo(() => ({
    style: {
      borderRadius: 8,
      height: 36,
      paddingInline: 20,
      fontWeight: 500,
      boxShadow: isDark
        ? "0 2px 8px rgba(59, 130, 246, 0.25)"
        : "0 1px 4px rgba(59, 130, 246, 0.2)",
    } as React.CSSProperties,
  }), [isDark]);

  const cancelBtnProps = useMemo(() => ({
    style: {
      borderRadius: 8,
      height: 36,
    } as React.CSSProperties,
  }), []);

  const handleCreate = async () => {
    if (creating) return;
    try {
      const values = await createFormInstance.validateFields();
      const name = (values.name || "").trim();
      if (!name) return;
      setCreating(true);
      const res = await authFetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: (values.description || "").trim(),
          icon: (values.icon || "").trim(),
        }),
      });
      const newTemplate = await res.json();
      if (newTemplate?.id) {
        createFormInstance.resetFields();
        setShowCreate(false);
        router.push(`/templates/${newTemplate.id}`);
      } else {
        message.error(t('createFailed'));
        refreshList();
      }
    } catch {
      // validation failed
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number, name: string) => {
    e.stopPropagation();
    if (!confirm(t('confirmDelete', { name }))) return;
    await authFetch(`/api/templates/${id}`, { method: "DELETE" });
    refreshList();
  };

  const openCopyModal = (e: React.MouseEvent, template: Template) => {
    e.stopPropagation();
    setCopyingTemplate(template);
    setCopyName(template.name + " " + t('copySuffix'));
  };

  const handleCopy = async () => {
    if (!copyingTemplate || !copyName.trim() || copying) return;
    setCopying(true);
    try {
      await authFetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: copyName.trim(),
          description: copyingTemplate.description,
          content: copyingTemplate.content,
          icon: copyingTemplate.icon,
          agentPrompt: copyingTemplate.agentPrompt,
        }),
      });
      setCopyingTemplate(null);
      refreshList();
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t('title')}</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t('newTemplate')}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && <Spinner />}

        {/* 模板列表分组 */}
        {/* 我创建的 */}
        {(() => {
          const userTemplates = templates.filter(t => !t.isSystem);
          if (userTemplates.length === 0) return null;
          return (
            <div className="mb-8">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">{t('myTemplates')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    onClick={() => router.push(`/templates/${tpl.id}`)}
                    className="rounded-xl border border-gray-200 dark:border-[var(--popup-border)] shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700 transition-all cursor-pointer"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xl shrink-0">{tpl.icon || "📄"}</span>
                          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{tpl.name}</h3>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={(e) => openCopyModal(e, tpl)}
                            className="p-1 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                            title={t('copy')}
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, tpl.id, tpl.name)}
                            className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                            title={t('delete')}
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {tpl.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{tpl.description}</p>
                      )}
                      <div className="flex items-center gap-2">
                        {tpl.agentPrompt ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                            🤖 {t('agentPromptConfigured')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-[var(--main-bg)] px-1.5 py-0.5 rounded">
                            {t('promptNotConfigured')}
                          </span>
                        )}
                      </div>
                      {tpl.content && (
                        <pre className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-[var(--main-bg)] rounded-lg p-2 max-h-24 overflow-hidden whitespace-pre-wrap line-clamp-3 mt-3">
                          {tpl.content.slice(0, 150)}{tpl.content.length > 150 ? "..." : ""}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* 系统模板 */}
        {(() => {
          const systemTemplates = templates.filter(t => t.isSystem);
          if (systemTemplates.length === 0) return null;
          return (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">{t('systemTemplates')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {systemTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    onClick={() => router.push(`/templates/${tpl.id}`)}
                    className="rounded-xl border border-gray-200 dark:border-[var(--popup-border)] shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700 transition-all cursor-pointer"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xl shrink-0">{tpl.icon || "📄"}</span>
                          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{tpl.name}</h3>
                        </div>
                        {/* 系统模板无删除按钮，但有复制按钮 */}
                        <button
                          onClick={(e) => openCopyModal(e, tpl)}
                          className="p-1 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors shrink-0"
                          title={t('copy')}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                      </div>
                      {tpl.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{tpl.description}</p>
                      )}
                      <div className="flex items-center gap-2">
                        {tpl.agentPrompt ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                            🤖 {t('agentPromptConfigured')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-[var(--main-bg)] px-1.5 py-0.5 rounded">
                            {t('promptNotConfigured')}
                          </span>
                        )}
                      </div>
                      {tpl.content && (
                        <pre className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-[var(--main-bg)] rounded-lg p-2 max-h-24 overflow-hidden whitespace-pre-wrap line-clamp-3 mt-3">
                          {tpl.content.slice(0, 150)}{tpl.content.length > 150 ? "..." : ""}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {templates.length === 0 && !loading && (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('noTemplates')}</p>
          </div>
        )}
      </div>

      {/* 新建模版弹窗 */}
      <Modal
        title={t('newTemplate')}
        open={showCreate}
        onOk={handleCreate}
        okText={t('createAndEdit')}
        confirmLoading={creating}
        onCancel={() => {
          setShowCreate(false);
          createFormInstance.resetFields();
        }}
        destroyOnHidden
        centered
        mask={{ closable: false }}
        styles={modalStyles}
        okButtonProps={okBtnProps}
        cancelButtonProps={cancelBtnProps}
      >
        <Form
          form={createFormInstance}
          layout="vertical"
          className="mt-4"
        >
          <Form.Item
            label={t('namePlaceholder')}
            name="name"
            rules={[{ required: true, message: t('namePlaceholder') }]}
          >
            <Input placeholder={t('namePlaceholder')} maxLength={100} autoFocus style={{ background: 'transparent' }} />
          </Form.Item>
          <Form.Item
            label="Icon"
            name="icon"
          >
            <Input placeholder="Emoji" maxLength={4} style={{ background: 'transparent' }} />
          </Form.Item>
          <Form.Item
            label={t('descriptionPlaceholder')}
            name="description"
          >
            <Input placeholder={t('descriptionPlaceholder')} maxLength={200} style={{ background: 'transparent' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 复制模版弹窗 */}
      <Modal
        title={t('copyTemplate')}
        open={!!copyingTemplate}
        onOk={handleCopy}
        okText={t('confirmCopy')}
        confirmLoading={copying}
        onCancel={() => setCopyingTemplate(null)}
        destroyOnHidden
        centered
        mask={{ closable: false }}
        styles={modalStyles}
        okButtonProps={okBtnProps}
        cancelButtonProps={cancelBtnProps}
      >
        <div className="mt-4">
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1.5">{t('newTemplateName')}</label>
          <input
            value={copyName}
            onChange={(e) => setCopyName(e.target.value)}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleCopy(); }}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-zinc-600 bg-transparent dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-400"
          />
        </div>
      </Modal>
    </div>
  );
}
