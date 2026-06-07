import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://docs.rabbitai-lab.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/chat",
          "/chats",
          "/workspace",
          "/project",
          "/doc",
          "/settings",
          "/profile",
          "/billing",
          "/sandbox",
          "/todos",
          "/templates",
          "/share-html",
          "/cli-consent",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
