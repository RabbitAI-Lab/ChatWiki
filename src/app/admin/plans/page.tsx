import { db } from "@/db";
import { plans } from "@/db/schema";
import PlansPageClient from "@/components/admin/PlansPageClient";

export default function PlansPage() {
  const allPlans = db.select().from(plans).orderBy(plans.sortOrder).all();

  return <PlansPageClient initialPlans={allPlans} />;
}
