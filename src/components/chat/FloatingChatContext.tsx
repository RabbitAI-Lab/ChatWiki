"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface FloatingChatContextValue {
  isOpen: boolean;
  isMinimized: boolean;
  projectId: string | undefined;
  workspaceId: string | undefined;
  windowKey: number;
  open: (projectId?: string, workspaceId?: string) => void;
  close: () => void;
  minimize: () => void;
  mentionFile: string | null;
  setMentionFile: (file: string | null) => void;
}

const FloatingChatContext = createContext<FloatingChatContextValue | null>(null);

export function useFloatingChat(): FloatingChatContextValue {
  const ctx = useContext(FloatingChatContext);
  if (!ctx) {
    throw new Error("useFloatingChat must be used within FloatingChatProvider");
  }
  return ctx;
}

interface FloatingChatProviderInnerProps {
  children: ReactNode;
}

export function FloatingChatProviderInner({ children }: FloatingChatProviderInnerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(undefined);
  const [windowKey, setWindowKey] = useState(0);
  const [mentionFile, setMentionFile] = useState<string | null>(null);

  const open = useCallback((newProjectId?: string, newWorkspaceId?: string) => {
    if (isMinimized) {
      // Restore from minimized — keep existing session
      setIsMinimized(false);
      return;
    }
    if (isOpen) return;
    // New floating chat session
    setProjectId(newProjectId);
    setWorkspaceId(newWorkspaceId);
    setWindowKey((k) => k + 1);
    setIsOpen(true);
  }, [isOpen, isMinimized]);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
    setProjectId(undefined);
    setWorkspaceId(undefined);
  }, []);

  const minimize = useCallback(() => {
    setIsMinimized(true);
  }, []);

  return (
    <FloatingChatContext.Provider value={{ isOpen, isMinimized, projectId, workspaceId, windowKey, open, close, minimize, mentionFile, setMentionFile }}>
      {children}
    </FloatingChatContext.Provider>
  );
}
