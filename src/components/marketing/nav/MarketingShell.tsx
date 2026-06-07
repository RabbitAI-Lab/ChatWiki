import { ReactNode } from "react";
import { getTranslations, getLocale } from "next-intl/server";
import MarketingNav from "./MarketingNav";
import MarketingFooter from "./MarketingFooter";
import JsonLd from "@/components/marketing/seo/JsonLd";

interface MarketingShellProps {
  children: ReactNode;
}

/**
 * 营销站通用 shell:提供顶部 nav + 主体 + 底部 footer,并注入首页 JSON-LD。
 * 子页面可以通过 `noPadding` 等 prop 自定义,目前统一形态。
 */
export default async function MarketingShell({ children }: MarketingShellProps) {
  const t = await getTranslations("marketing.nav");
  const locale = await getLocale();
  const brand = t("brand");

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand,
    url: "https://docs.rabbitai-lab.com",
    logo: "https://docs.rabbitai-lab.com/logo.svg",
    sameAs: [
      "https://github.com/rabbitai-lab",
      "https://twitter.com/rabbitai_lab",
    ],
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--marketing-bg)] text-[var(--marketing-fg)]">
      <JsonLd data={orgJsonLd} />
      <MarketingNav />
      <div className="flex-1">{children}</div>
      <MarketingFooter locale={locale} />
    </div>
  );
}
