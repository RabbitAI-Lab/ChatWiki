import { db } from "@/db";
import { mcpConfig } from "@/db/schema";
import McpPageClient from "@/components/admin/McpPageClient";
import { getBrandName } from "@/lib/auth/settings";

export default async function McpPage() {
  const [config] = await db.select().from(mcpConfig);

  return (
    <McpPageClient
      initialConfig={
        config
          ? {
              configJson: config.configJson,
              updatedAt: config.updatedAt,
            }
          : undefined
      }
      brandName={await getBrandName()}
    />
  );
}
