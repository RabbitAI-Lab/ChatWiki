import type { ComingSoonEntry } from "./integration-types";

/**
 * Catalog of integrations that are not yet implemented.
 * Displayed as greyed-out cards with a "Coming Soon" badge.
 */
export const COMING_SOON_CATALOG: ComingSoonEntry[] = [
  {
    id: "feishu",
    nameKey: "feishuTitle",
    descriptionKey: "feishuDesc",
    category: "messaging",
    categoryKey: "messaging",
    icon: "💬",
  },
  {
    id: "telegram",
    nameKey: "telegramTitle",
    descriptionKey: "telegramDesc",
    category: "messaging",
    categoryKey: "messaging",
    icon: "📨",
  },
  {
    id: "import-export",
    nameKey: "importExportTitle",
    descriptionKey: "importExportDesc",
    category: "import-export",
    categoryKey: "importExport",
    icon: "📤",
  },
  {
    id: "lovable",
    nameKey: "lovableTitle",
    descriptionKey: "lovableDesc",
    category: "ai-generation",
    categoryKey: "aiGeneration",
    icon: "✨",
  },
];
