"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { ReactNode, useEffect } from "react";
import { applyColorScheme, type ColorScheme } from "@/lib/color-scheme";

/**
 * Inner component that listens to theme changes and applies color scheme.
 * Must be inside NextThemesProvider to use useTheme().
 */
function ColorSchemeApplier({
  colorScheme,
  children,
}: {
  colorScheme: ColorScheme | null;
  children: ReactNode;
}) {
  const { resolvedTheme } = useTheme();

  // Re-apply colors whenever theme or colorScheme changes
  useEffect(() => {
    if (colorScheme && resolvedTheme) {
      applyColorScheme(colorScheme, resolvedTheme === "dark");
    }
  }, [colorScheme, resolvedTheme]);

  return <>{children}</>;
}

/**
 * 根级主题 Provider:仅提供 next-themes 的 light/dark 切换,
 * 供营销站与产品页共用。antd 主题同步在 (app)/layout.tsx 的 ThemeRegistry 中处理。
 *
 * 接受可选的 colorScheme prop。
 * 初始 FOUC 防护脚本已在 layout.tsx 的 <head> 中注入，
 * 此组件仅通过 useEffect 监听主题切换并动态更新 CSS 变量。
 */
export default function ThemeRoot({
  children,
  colorScheme,
}: {
  children: ReactNode;
  colorScheme?: ColorScheme | null;
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ColorSchemeApplier colorScheme={colorScheme ?? null}>
        {children}
      </ColorSchemeApplier>
    </NextThemesProvider>
  );
}
