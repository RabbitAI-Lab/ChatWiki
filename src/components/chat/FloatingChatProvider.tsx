"use client";

import { ReactNode } from "react";
import { FloatingChatProviderInner, useFloatingChat } from "./FloatingChatContext";
import FloatingChatWindow from "./FloatingChatWindow";

function FloatingChatPortal() {
  const { isOpen, windowKey } = useFloatingChat();
  if (!isOpen) return null;
  return <FloatingChatWindow key={windowKey} />;
}

interface FloatingChatProviderProps {
  children: ReactNode;
}

export default function FloatingChatProvider({ children }: FloatingChatProviderProps) {
  return (
    <FloatingChatProviderInner>
      {children}
      <FloatingChatPortal />
    </FloatingChatProviderInner>
  );
}
