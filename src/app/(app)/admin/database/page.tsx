import { getDatabaseInfo } from "@/lib/db-dump";
import DatabasePageClient from "@/components/admin/DatabasePageClient";

export default async function DatabasePage() {
  const info = await getDatabaseInfo();
  return <DatabasePageClient initialInfo={info} />;
}
