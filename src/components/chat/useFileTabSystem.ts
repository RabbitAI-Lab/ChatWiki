"use client";

import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/components/auth/useAuth";
import type { TreeNode } from "@/lib/tree";

export interface FileTab {
  filePath: string;
  content: string;
  loaded: boolean;
  type: "markdown" | "html";
}

const PROJECT_INFO_TAB = "__project_info__" as const;
const CHAT_TAB = "__chat__" as const;

export { PROJECT_INFO_TAB, CHAT_TAB };

interface UseFileTabSystemOptions {
  projectId: string | null;
  projectPath: string;
  closeFallbackTab?: string;
}

export function useFileTabSystem({ projectId, projectPath, closeFallbackTab = PROJECT_INFO_TAB }: UseFileTabSystemOptions) {
  const [tabs, setTabs] = useState<FileTab[]>([]);
  const { authFetch } = useAuth();
  const [activeTabId, setActiveTabId] = useState<string>(CHAT_TAB);
  const contentCache = useRef<Record<string, string>>({});

  // Use ref to track activeTabId to avoid stale closure in handleTabClose
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  const updateTabPaths = useCallback((oldPath: string, newPath: string) => {
    setTabs((prev) => prev.map((t) => t.filePath === oldPath ? { ...t, filePath: newPath } : t));
    setActiveTabId((prev) => prev === oldPath ? newPath : prev);
    const cached = contentCache.current[oldPath];
    if (cached !== undefined) {
      contentCache.current[newPath] = cached;
      delete contentCache.current[oldPath];
    }
  }, []);

  const handleFileClick = useCallback(async (node: TreeNode) => {
    const filePath = node.path;
    // If tab already open, switch to it
    setTabs((prev) => {
      const existingTab = prev.find((t) => t.filePath === filePath);
      if (existingTab) {
        setActiveTabId(filePath);
        return prev;
      }
      // Create new tab
      const cachedContent = contentCache.current[filePath] ?? "";
      const fileType = filePath.toLowerCase().endsWith(".html") ? "html" as const : "markdown" as const;
      const newTab: FileTab = {
        filePath,
        content: cachedContent,
        loaded: !!cachedContent,
        type: fileType,
      };
      setActiveTabId(filePath);

      // Fetch content if not cached
      if (!cachedContent) {
        const apiPath = `${projectPath}/${filePath}`;
        authFetch(`/api/fs/document?path=${apiPath}`)
          .then((r) => r.json())
          .then((data) => {
            const content = data.content ?? "";
            contentCache.current[filePath] = content;
            setTabs((prev2) =>
              prev2.map((t) =>
                t.filePath === filePath ? { ...t, content, loaded: true } : t
              )
            );
          })
          .catch(() => {
            setTabs((prev2) =>
              prev2.map((t) =>
                t.filePath === filePath ? { ...t, content: "", loaded: true } : t
              )
            );
          });
      }

      return [...prev, newTab];
    });
  }, [projectId]);

  const handleTabClose = useCallback((tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.filePath === tabId);
      const newTabs = prev.filter((t) => t.filePath !== tabId);
      if (activeTabIdRef.current === tabId) {
        if (newTabs.length === 0) {
          setActiveTabId(closeFallbackTab);
        } else if (idx < newTabs.length) {
          setActiveTabId(newTabs[idx].filePath);
        } else {
          setActiveTabId(newTabs[newTabs.length - 1].filePath);
        }
      }
      return newTabs;
    });
  }, []);

  const handleFileSave = useCallback(async (filePath: string, markdown: string) => {
    contentCache.current[filePath] = markdown;
    await authFetch("/api/fs/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `${projectPath}/${filePath}`, content: markdown }),
    });
  }, [projectPath]);

  const handleFileChange = useCallback((filePath: string, markdown: string) => {
    contentCache.current[filePath] = markdown;
  }, []);

  const reset = useCallback(() => {
    setTabs([]);
    setActiveTabId(CHAT_TAB);
    contentCache.current = {};
  }, []);

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    contentCache,
    handleFileClick,
    handleTabClose,
    handleFileSave,
    handleFileChange,
    updateTabPaths,
    reset,
  };
}
