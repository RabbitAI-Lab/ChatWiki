"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ConfigProvider, App as AntApp, theme as antdTheme } from "antd";
import { useTheme } from "next-themes";
import { ReactNode, useEffect, useMemo, useState } from "react";
import zhCN from "antd/locale/zh_CN";
import enUS from "antd/locale/en_US";
import { type ColorScheme } from "@/lib/color-scheme";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const antLocales: Record<string, any> = { zh: zhCN, en: enUS };

function AntdThemeSync({ children, locale, colorScheme }: { children: ReactNode; locale: string; colorScheme?: ColorScheme | null }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
  }, []);

  const antdLocale = useMemo(() => antLocales[locale] || zhCN, [locale]);

  const colorPrimary = useMemo(() => {
    if (!colorScheme) return undefined;
    // SSR 首帧用 light 模式颜色，mounted 后根据 resolvedTheme 切换
    const isDark = mounted && resolvedTheme === "dark";
    return isDark ? colorScheme.dark.primaryBtn : colorScheme.light.primaryBtn;
  }, [colorScheme, resolvedTheme, mounted]);

  const colorBgContainer = useMemo(() => {
    if (!colorScheme) return undefined;
    const isDark = mounted && resolvedTheme === "dark";
    return isDark ? colorScheme.dark.background : colorScheme.light.background;
  }, [colorScheme, resolvedTheme, mounted]);

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        algorithm:
          mounted && resolvedTheme === "dark"
            ? antdTheme.darkAlgorithm
            : antdTheme.defaultAlgorithm,
        token: {
          ...(colorPrimary ? { colorPrimary } : {}),
          ...(colorBgContainer ? { colorBgContainer, colorBgElevated: colorBgContainer } : {}),
        },
      }}
    >
      <AntApp className="h-full w-full">{children}</AntApp>
    </ConfigProvider>
  );
}

export default function ThemeRegistry({ children, locale, colorScheme }: { children: ReactNode; locale: string; colorScheme?: ColorScheme | null }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AntdThemeSync locale={locale} colorScheme={colorScheme}>{children}</AntdThemeSync>
    </NextThemesProvider>
  );
}
