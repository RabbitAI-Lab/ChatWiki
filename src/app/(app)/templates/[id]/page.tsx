import { notFound } from "next/navigation";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { eq } from "drizzle-orm";
import TemplateEditor from "@/components/templates/TemplateEditor";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [template] = await db
    .select()
    .from(templates)
    .where(eq(templates.id, parseInt(id)));

  if (!template) {
    notFound();
  }

  return <TemplateEditor template={template} />;
}
