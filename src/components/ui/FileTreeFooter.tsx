"use client";

import { useTranslations } from "next-intl";

export type TreeViewMode = "docs" | "workspace";

interface FileTreeFooterProps {
  activeView: TreeViewMode;
  onViewChange: (view: TreeViewMode) => void;
}

export default function FileTreeFooter({ activeView, onViewChange }: FileTreeFooterProps) {
  const t = useTranslations("common");

  return (
    <div className="shrink-0 border-t border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex">
      <button
        onClick={() => onViewChange("docs")}
        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors ${
          activeView === "docs"
            ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
            : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        {t("docsView")}
      </button>
      <button
        onClick={() => onViewChange("workspace")}
        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors ${
          activeView === "workspace"
            ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
            : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        {t("workspaceView")}
      </button>
    </div>
  );
}
