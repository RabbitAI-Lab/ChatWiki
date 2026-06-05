"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/useAuth";

export interface ModelItem {
  id: number;
  provider: string;
  modelName: string;
  isDefault: number;
}

export interface ProjectItem {
  id: string;
  name: string;
}

export interface WorkspaceItem {
  id: string;
  name: string;
}

export interface TemplateItem {
  id: number;
  name: string;
  agentPrompt?: string;
  content?: string;
}

interface UseChatSelectorsOptions {
  initialModelId?: number;
  initialTemplateId?: number;
  initialProjectId?: string;
  workspaceId?: string;
  effectiveChatId: number | null;
}

export function useChatSelectors({
  initialModelId,
  initialTemplateId,
  initialProjectId,
  workspaceId,
  effectiveChatId,
}: UseChatSelectorsOptions) {
  const [models, setModels] = useState<ModelItem[]>([]);
  const { authFetch, user } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | undefined>(initialModelId);
  const [selectedProject, setSelectedProject] = useState<string | undefined>(
    initialProjectId ?? undefined
  );
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | undefined>(
    (!initialProjectId && workspaceId) ? workspaceId : undefined
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>(initialTemplateId);

  // Persist model/template selection to DB (only when chat exists)
  const updateChatSelection = (field: string, value: number | undefined) => {
    if (!effectiveChatId) return;
    authFetch(`/api/chats/${effectiveChatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value ?? null }),
    });
  };

  const handleModelChange = (id: number | undefined) => {
    setSelectedModelId(id);
    updateChatSelection("modelId", id);
  };

  const handleProjectChange = (id: string | undefined) => {
    if (id) setSelectedWorkspace(undefined);
    setSelectedProject(id);
    if (!effectiveChatId) return;
    authFetch(`/api/chats/${effectiveChatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id ?? null, workspaceId: null }),
    });
  };

  const handleWorkspaceChange = (id: string | undefined) => {
    if (id) setSelectedProject(undefined);
    setSelectedWorkspace(id);
    if (!effectiveChatId) return;
    authFetch(`/api/chats/${effectiveChatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: id ?? null, projectId: null }),
    });
  };

  const handleTemplateChange = (id: number | undefined) => {
    setSelectedTemplateId(id);
    updateChatSelection("templateId", id);
    if (id) {
      localStorage.setItem("last-selected-template-id", String(id));
    } else {
      localStorage.removeItem("last-selected-template-id");
    }
  };

  useEffect(() => {
    authFetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        setModels(data);
        if (!initialModelId) {
          const defaultModel = data.find((m: { isDefault: number }) => m.isDefault === 1);
          if (defaultModel) {
            setSelectedModelId(defaultModel.id);
          }
        }
      });
    if (user) {
      authFetch(`/api/fs/projects?type=personal&accountId=${user.id}`)
        .then((r) => r.json())
        .then((data) => setProjects(Array.isArray(data) ? data : []));
      authFetch(`/api/fs/workspaces?type=personal&accountId=${user.id}`)
        .then((r) => r.json())
        .then((data) => setWorkspaces(
          Array.isArray(data) ? data.map((w: { id: string; name: string }) => ({ id: w.id, name: w.name })) : []
        ));
    }
    authFetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data);
        if (!initialTemplateId && data.length > 0) {
          const savedTemplateId = localStorage.getItem("last-selected-template-id");
          if (savedTemplateId) {
            const parsed = Number(savedTemplateId);
            const exists = data.some((t: { id: number }) => t.id === parsed);
            if (exists) {
              setSelectedTemplateId(parsed);
            } else {
              localStorage.removeItem("last-selected-template-id");
            }
          }
        }
      });
  }, [authFetch, user, initialModelId, initialTemplateId]);

  return {
    models,
    projects,
    workspaces,
    templates,
    selectedModelId,
    setSelectedModelId,
    selectedProject,
    setSelectedProject,
    selectedWorkspace,
    setSelectedWorkspace,
    selectedTemplateId,
    setSelectedTemplateId,
    handleModelChange,
    handleProjectChange,
    handleWorkspaceChange,
    handleTemplateChange,
  };
}
