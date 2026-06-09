/**
 * 下载 docsify 静态资源到 public/docsify/ 目录。
 * 支持 DOCSIFY_VERSION 环境变量指定版本（默认 4）。
 *
 * 用法：
 *   npx tsx scripts/download-docsify.ts
 *   DOCSIFY_VERSION=4.13 npx tsx scripts/download-docsify.ts
 */
import fs from "node:fs";
import path from "node:path";

const VERSION = process.env.DOCSIFY_VERSION || "4";
const BASE = `https://cdn.jsdelivr.net/npm/docsify@${VERSION}`;
const ROOT = path.resolve(import.meta.dirname, "..", "public", "docsify");

const FILES: Record<string, string> = {
  "docsify.min.js": "lib/docsify.min.js",
  "themes/vue.css": "lib/themes/vue.css",
  "themes/dark.css": "lib/themes/dark.css",
  "plugins/search.min.js": "lib/plugins/search.min.js",
};

async function download() {
  // 检查是否已存在
  const markerFile = path.join(ROOT, ".version");
  if (fs.existsSync(markerFile)) {
    const existingVersion = fs.readFileSync(markerFile, "utf-8").trim();
    if (existingVersion === VERSION && fs.existsSync(path.join(ROOT, "docsify.min.js"))) {
      console.log(`[docsify] Already downloaded v${VERSION}, skipping.`);
      return;
    }
  }

  console.log(`[docsify] Downloading docsify v${VERSION}...`);

  // 创建目录
  for (const relPath of Object.keys(FILES)) {
    const dir = path.dirname(path.join(ROOT, relPath));
    fs.mkdirSync(dir, { recursive: true });
  }

  // 下载文件
  for (const [localPath, remotePath] of Object.entries(FILES)) {
    const url = `${BASE}/${remotePath}`;
    const dest = path.join(ROOT, localPath);
    console.log(`  Fetching ${url}...`);
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  Failed to download ${url}: ${res.status} ${res.statusText}`);
      process.exit(1);
    }
    const content = await res.text();
    fs.writeFileSync(dest, content, "utf-8");
    console.log(`  Saved ${localPath} (${(content.length / 1024).toFixed(1)} KB)`);
  }

  // 写入版本标记
  fs.writeFileSync(markerFile, VERSION, "utf-8");
  console.log(`[docsify] Done. Files saved to public/docsify/`);
}

download().catch((err) => {
  console.error("[docsify] Download failed:", err);
  process.exit(1);
});
