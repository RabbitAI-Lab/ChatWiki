import { db } from "@/db";
import { templates } from "@/db/schema";
import TemplatesPageClient from "@/components/templates/TemplatesPageClient";

export default async function TemplatesPage() {
  let templatesList: Array<typeof templates.$inferSelect> = [];
  try {
    const result = await db.select().from(templates);
    if (result) templatesList = result;
  } catch (err) {
    // During build phase, db is not available — skip silently
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      console.error("[templates] Failed to load templates:", err);
    }
  }

  return <TemplatesPageClient initialTemplates={templatesList} />;
}
