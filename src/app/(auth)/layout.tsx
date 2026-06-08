import type { Metadata } from "next";
import { getBrandName, getSetting } from "@/lib/auth/settings";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import ThemeRegistry from "@/components/layout/ThemeRegistry";
import ThemeToggle from "@/components/layout/ThemeToggle";
import AuthLanguageSwitcher from "@/components/auth/AuthLanguageSwitcher";
import { parseColorScheme } from "@/lib/color-scheme";

export async function generateMetadata(): Promise<Metadata> {
  const brandName = await getBrandName();
  return {
    title: `${brandName} - Auth`,
  };
}

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const msgs = await getMessages();

  // Read color scheme for antd theme sync (same as app layout)
  const colorSchemeRaw = await getSetting("color_scheme");
  const colorScheme = colorSchemeRaw ? parseColorScheme(colorSchemeRaw) : null;

  return (
    <NextIntlClientProvider locale={locale} messages={msgs}>
      <ThemeRegistry locale={locale} colorScheme={colorScheme}>
        <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-[var(--main-bg)] relative auth-page">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <ThemeToggle />
            <AuthLanguageSwitcher />
          </div>
          <div className="w-full max-w-md px-4">{children}</div>
        </div>
      </ThemeRegistry>
    </NextIntlClientProvider>
  );
}
