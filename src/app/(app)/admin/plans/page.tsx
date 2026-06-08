import { db } from "@/db";
import { plans } from "@/db/schema";
import PlansPageClient from "@/components/admin/PlansPageClient";

export default async function PlansPage() {
  const allPlans = await db.select().from(plans).orderBy(plans.sortOrder);

  return <PlansPageClient initialPlans={allPlans} />;
}
