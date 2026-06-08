import { db } from "@/db";
import { modelConfigs } from "@/db/schema";
import ModelsPageClient from "@/components/admin/ModelsPageClient";

export default async function ModelsPage() {
  const models = await db.select().from(modelConfigs);

  return <ModelsPageClient initialModels={models} />;
}
