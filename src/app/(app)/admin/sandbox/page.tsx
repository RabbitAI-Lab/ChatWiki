import { db } from "@/db";
import { sandboxConfig } from "@/db/schema";
import SandboxPageClient from "@/components/admin/SandboxPageClient";

export default async function SandboxPage() {
  const [config] = await db.select().from(sandboxConfig);

  return (
    <SandboxPageClient
      initialConfig={
        config
          ? { sandboxUrl: config.sandboxUrl, updatedAt: config.updatedAt }
          : undefined
      }
    />
  );
}
