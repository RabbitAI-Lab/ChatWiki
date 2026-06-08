import { db } from "@/db";
import { systemPrompts } from "@/db/schema";
import SystemPromptsPageClient from "@/components/admin/SystemPromptsPageClient";

export default async function SystemPromptsPage() {
  const prompts = await db.select().from(systemPrompts).orderBy(systemPrompts.sortOrder);

  return <SystemPromptsPageClient initialPrompts={prompts} />;
}
