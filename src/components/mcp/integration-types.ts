// Integration types for the Integrations marketplace page.

// Category for "coming soon" integrations
export type ComingSoonCategory = "messaging" | "import-export" | "ai-generation";

// A "coming soon" integration entry — purely frontend display data.
export interface ComingSoonEntry {
  id: string;
  nameKey: string;        // i18n key under integrationsPage namespace
  descriptionKey: string; // i18n key under integrationsPage namespace
  category: ComingSoonCategory;
  categoryKey: string;    // i18n key for category label
  icon: string;           // emoji
}
