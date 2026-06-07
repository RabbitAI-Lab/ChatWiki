import type { Metadata } from "next";
import MarketingShell from "@/components/marketing/nav/MarketingShell";

/**
 * 营销路由组 layout:为子页面提供共享的 nav + footer shell。
 * 页面 content 通过 children 注入。
 */
export const metadata: Metadata = {
  // 子页面通过 generateMetadata 各自覆盖
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketingShell>{children}</MarketingShell>;
}
