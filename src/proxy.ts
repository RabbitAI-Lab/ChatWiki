import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

async function verifyAccessToken(token: string): Promise<boolean> {
  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "dev-secret-change-in-production"
    );
    const payload = await jwtVerify(token, secret);
    return payload.payload.type === "access";
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 检查系统是否已初始化
  // 注意：middleware 运行在 Edge Runtime，无法直接访问 SQLite
  // 初始化状态检查由前端 AuthProvider 处理
  // 这里只做 token 验证和页面保护

  // API 路由不做拦截，由各 route handler 自行校验
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 静态资源
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/fonts") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // SEO 元文件(sitemap/robots) - 必须公开,供搜索引擎抓取
  if (pathname === "/sitemap.xml" || pathname === "/robots.txt") {
    return NextResponse.next();
  }

  // 公开页面不需要认证
  const publicPaths = [
    "/login",
    "/register",
    "/setup",
    "/verify-email",
    "/cli-consent",
    "/docify",
  ];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 营销站(根路径智能分流:已登录会被 page.tsx 重定向到 /chat/new)
  const marketingPaths = [
    "/",
    "/home",
    "/features",
    "/pricing",
    "/use-cases",
    "/about",
  ];
  if (marketingPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // MCP 代理路由 — 使用 API Key 鉴权，不需要登录态
  if (pathname === "/mcp" || pathname.startsWith("/mcp/")) {
    return NextResponse.next();
  }

  // 分享页面
  if (pathname.startsWith("/share")) {
    return NextResponse.next();
  }

  // 检查 access_token cookie
  const token = req.cookies.get("access_token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const valid = await verifyAccessToken(token);
  if (!valid) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Phase 8：激活完整 matcher — 保护所有非公开页面路由
// 多个匹配器替代单个正则（避免捕获组问题）
export const config = {
  matcher: [
    // 匹配除公开路径外的所有页面路由
    "/((?!api/auth|api/share|api/share-html|api/published-docs|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|login|register|setup|verify-email|cli-consent|docify|docsify|share|mcp).*)",
  ],
};
