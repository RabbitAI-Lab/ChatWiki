import { getSetting } from "@/lib/auth/settings";
import { parseColorScheme } from "@/lib/color-scheme";
import AppearanceSettingsPageClient from "@/components/admin/AppearanceSettingsPageClient";

export default async function AppearanceSettingsPage() {
  const raw = await getSetting("color_scheme");
  const colorScheme = parseColorScheme(raw);
  return <AppearanceSettingsPageClient initialColorScheme={colorScheme} />;
}
