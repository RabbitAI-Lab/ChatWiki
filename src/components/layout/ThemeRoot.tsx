"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ReactNode } from "react";

/**
 * 根级主题 Provider:仅提供 next-themes 的 light/dark 切换,
 * 供营销站与产品页共用。antd 主题同步在 (app)/layout.tsx 的 ThemeRegistry 中处理。
 */
export default function ThemeRoot({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
