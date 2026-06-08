import { getBrandName, getSetting } from "@/lib/auth/settings";
import GeneralSettingsPageClient from "@/components/admin/GeneralSettingsPageClient";

export default async function GeneralSettingsPage() {
  const brandName = await getBrandName();
  const siteUrl = (await getSetting("site_url")) ?? "";
  const adminEmail = (await getSetting("admin_email")) ?? "";
  return <GeneralSettingsPageClient initialBrandName={brandName} initialSiteUrl={siteUrl} initialAdminEmail={adminEmail} />;
}
