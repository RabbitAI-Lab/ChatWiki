import { db } from "@/db";
import { templates } from "@/db/schema";
import TemplatesPageClient from "@/components/templates/TemplatesPageClient";

export default function TemplatesPage() {
  let templatesList: Array<typeof templates.$inferSelect> = [];
  try {
    templatesList = db.select().from(templates).all();
  } catch (err) {
    console.error("[templates] Failed to load templates:", err);
  }

  return <TemplatesPageClient initialTemplates={templatesList} />;
}
