import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth/tokens";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import HomePage from "@/components/marketing/home/HomePage";
import MarketingShell from "@/components/marketing/nav/MarketingShell";

/**
 * 根路径智能分流:
 * - 已登录(验证 token 有效 + 用户存在) → 跳转到 /chat/new
 * - 未登录 → 渲染营销首页
 */
export default async function Root() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  if (token) {
    const payload = await verifyToken(token);
    if (payload && payload.type === "access") {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, payload.sub));
      if (user) {
        redirect("/chat/new");
      }
    }
  }

  return <MarketingShell><HomePage /></MarketingShell>;
}
