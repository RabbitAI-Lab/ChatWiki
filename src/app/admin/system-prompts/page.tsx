import { db } from "@/db";
import { systemPrompts } from "@/db/schema";
import SystemPromptsPageClient from "@/components/admin/SystemPromptsPageClient";

export default function SystemPromptsPage() {
  const prompts = db.select().from(systemPrompts).orderBy(systemPrompts.sortOrder).all();

  return <SystemPromptsPageClient initialPrompts={prompts} />;
}
