import type { Metadata } from "next";
import { getBrandName } from "@/lib/auth/settings";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import ThemeRegistry from "@/components/layout/ThemeRegistry";
import ThemeToggle from "@/components/layout/ThemeToggle";
import AuthLanguageSwitcher from "@/components/auth/AuthLanguageSwitcher";

export async function generateMetadata(): Promise<Metadata> {
  const brandName = getBrandName();
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

  return (
    <NextIntlClientProvider locale={locale} messages={msgs}>
      <ThemeRegistry locale={locale}>
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-950 relative">
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
