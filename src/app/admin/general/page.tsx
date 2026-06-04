import { getBrandName } from "@/lib/auth/settings";
import GeneralSettingsPageClient from "@/components/admin/GeneralSettingsPageClient";

export default function GeneralSettingsPage() {
  const brandName = getBrandName();
  return <GeneralSettingsPageClient initialBrandName={brandName} />;
}
