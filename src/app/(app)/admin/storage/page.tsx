import { db } from "@/db";
import { storageConfig } from "@/db/schema";
import StoragePageClient from "@/components/admin/StoragePageClient";

export default async function StoragePage() {
  const [config] = await db.select().from(storageConfig);

  return (
    <StoragePageClient
      initialConfig={
        config
          ? { storagePath: config.storagePath, updatedAt: config.updatedAt }
          : undefined
      }
    />
  );
}
