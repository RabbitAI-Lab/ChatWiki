"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/useAuth";
import { Input, Button, Modal, App } from "antd";
import type { ProjectMember } from "@/lib/fs";
import type { ProjectMeta } from "./types";

interface ProjectSettingsPanelProps {
  projectId: string;
  projectName: string;
  projectMeta: ProjectMeta | null;
  members: ProjectMember[];
  ownerId: string;
  ownerName: string;
  onProjectUpdate: (name: string, description: string) => void;
  onOwnerTransfer: (newOwnerId: string, newMembers: ProjectMember[]) => void;
  onProjectDelete: () => void;
}

export default function ProjectSettingsPanel({
  projectId,
  projectName,
  projectMeta,
  members,
  ownerId,
  onProjectUpdate,
  onOwnerTransfer,
  onProjectDelete,
}: ProjectSettingsPanelProps) {
  const t = useTranslations("project");
  const { message: messageApi } = App.useApp();
  const { authFetch, user } = useAuth();
  const router = useRouter();

  const isOwner = user?.id === ownerId;

  // ── Basic info state ──
  const [name, setName] = useState(projectName);
  const [description, setDescription] = useState(projectMeta?.description || "");
  const [saving, setSaving] = useState(false);
  const hasChanges =
    name !== projectName || description !== (projectMeta?.description || "");

  // ── Transfer owner state ──
  const [transferMemberId, setTransferMemberId] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);

  // ── Delete project state ──
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Filter members that have userId (required for transfer)
  const transferableMembers = members.filter((m) => m.userId);

  // ── Handlers ──

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/fs/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, name: name.trim(), description }),
      });
      if (res.ok) {
        messageApi.success(t("settings.saved"));
        onProjectUpdate(name.trim(), description);
      } else {
        const data = await res.json();
        messageApi.error(data.error || t("settings.saveFailed"));
      }
    } catch {
      messageApi.error(t("settings.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleTransfer = () => {
    if (!transferMemberId) return;
    const member = members.find((m) => m.id === transferMemberId);
    if (!member) return;

    Modal.confirm({
      title: t("settings.transferTitle"),
      content: <p>{t("settings.transferContent", { name: member.accountName })}</p>,
      okText: t("settings.transfer"),
      okType: "danger",
      cancelText: t("members.cancel"),
      onOk: async () => {
        setTransferring(true);
        try {
          const res = await authFetch("/api/fs/project-members", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId, memberId: member.id }),
          });
          if (res.ok) {
            const data = await res.json();
            messageApi.success(t("settings.transferSuccess"));
            onOwnerTransfer(data.ownerId, data.members);
            setTransferMemberId(null);
          } else {
            const data = await res.json();
            messageApi.error(data.error || t("settings.transferFailed"));
          }
        } finally {
          setTransferring(false);
        }
      },
    });
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== projectName) return;
    setDeleting(true);
    try {
      const res = await authFetch("/api/fs/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId }),
      });
      if (res.ok) {
        messageApi.success(t("settings.deleteSuccess"));
        onProjectDelete();
        router.push("/");
      } else {
        const data = await res.json();
        messageApi.error(data.error || t("settings.deleteFailed"));
      }
    } catch {
      messageApi.error(t("settings.deleteFailed"));
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
      setDeleteConfirmText("");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Basic info section */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {t("settings.title")}
          </label>
          <Input
            styles={{ input: { background: 'transparent' } }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("settings.titlePlaceholder")}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {t("settings.description")}
          </label>
          <Input.TextArea
            styles={{ textarea: { background: 'transparent' } }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("settings.descriptionPlaceholder")}
            rows={3}
          />
        </div>
        <div>
          <Button
            type="primary"
            onClick={handleSave}
            loading={saving}
            disabled={!hasChanges || !name.trim()}
          >
            {saving ? t("settings.saving") : t("settings.save")}
          </Button>
        </div>
      </div>

      {/* Danger zone (owner only) */}
      {isOwner && (
        <div className="border border-red-200 dark:border-red-800/50 rounded-lg p-4 space-y-6">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">
              {t("settings.dangerZone")}
            </h3>
          </div>
          <p className="text-xs text-red-500/70 dark:text-red-400/60 -mt-4 ml-7">
            {t("settings.dangerZoneDesc")}
          </p>

          {/* Transfer ownership */}
          <div className="pt-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("settings.transferOwner")}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-2">
              {t("settings.transferOwnerDesc")}
            </p>
            {transferableMembers.length > 0 ? (
              <div className="flex items-center gap-2">
                <select
                  value={transferMemberId || ""}
                  onChange={(e) => setTransferMemberId(e.target.value || null)}
                  className="flex-1 h-8 px-2 text-sm border border-gray-200 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">{t("settings.selectMember")}</option>
                  {transferableMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.accountName}
                    </option>
                  ))}
                </select>
                <Button
                  danger
                  disabled={!transferMemberId}
                  loading={transferring}
                  onClick={handleTransfer}
                >
                  {t("settings.transfer")}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {t("settings.noTransferableMembers")}
              </p>
            )}
          </div>

          {/* Delete project */}
          <div className="pt-2 border-t border-red-100 dark:border-red-800/30">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("settings.deleteProject")}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-2">
              {t("settings.deleteProjectDesc")}
            </p>
            <Button danger type="primary" onClick={() => setDeleteModalOpen(true)}>
              {t("settings.deleteBtn")}
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        title={t("settings.deleteConfirmTitle")}
        open={deleteModalOpen}
        onOk={handleDelete}
        okText={t("settings.deleteBtn")}
        okType="danger"
        okButtonProps={{ disabled: deleteConfirmText !== projectName, loading: deleting }}
        onCancel={() => { setDeleteModalOpen(false); setDeleteConfirmText(""); }}
        cancelText={t("members.cancel")}
      >
        <div className="py-2 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t("settings.deleteConfirmContent", { name: projectName })}
          </p>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={t("settings.deleteConfirmPlaceholder")}
          />
        </div>
      </Modal>
    </div>
  );
}
