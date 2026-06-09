import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { entities } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { readDocument, listTree } from "@/lib/fs";
import { stripTreePrefix } from "@/lib/tree";
import type { TreeNode } from "@/lib/tree";
import type { PublishStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * 检查项目是否已发布。
 * 返回 { name, status } 或 null。
 */
async function getPublishInfo(projectId: string): Promise<{ name: string; status: PublishStatus } | null> {
  const [row] = await db
    .select({ name: entities.name, publishStatus: entities.publishStatus })
    .from(entities)
    .where(and(eq(entities.id, projectId), eq(entities.type, "project")))
    .limit(1);

  if (!row?.publishStatus) return null;
  try {
    const status = JSON.parse(row.publishStatus) as PublishStatus;
    return status.enabled ? { name: row.name, status } : null;
  } catch {
    return null;
  }
}

/**
 * 递归生成 docsify sidebar markdown 。
 * TreeNode.path 是相对于 docs 目录的路径（已被 stripTreePrefix 处理过）。
 */
function generateSidebarMarkdown(nodes: TreeNode[], indent: number = 0): string {
  const lines: string[] = [];
  const prefix = "  ".repeat(indent);

  // 排序：目录在前，文件在后
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const node of sorted) {
    if (node.type === "file") {
      // 文件标题：去掉 .md 后缀
      const title = node.name.endsWith(".md")
        ? node.name.slice(0, -3)
        : node.name;
      // docsify 路径需要 "/" 前缀
      const href = "/" + node.path.replace(/\.md$/, ".md");
      lines.push(`${prefix}- [${title}](${href})`);
    } else if (node.type === "directory" && node.children?.length) {
      // 目录标题
      lines.push(`${prefix}- **${node.name}**`);
      lines.push(generateSidebarMarkdown(node.children, indent + 1));
    }
  }

  return lines.join("\n");
}

/**
 * 当 README.md 不存在时，自动生成一个文档首页。
 */
function generateIndexPage(nodes: TreeNode[], projectName: string): string {
  const links: string[] = [];

  function collectFiles(items: TreeNode[]) {
    const sorted = [...items].sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const item of sorted) {
      if (item.type === "file") {
        const title = item.name.endsWith(".md") ? item.name.slice(0, -3) : item.name;
        links.push(`- [${title}](/${item.path})`);
      } else if (item.type === "directory" && item.children?.length) {
        links.push(`\n**${item.name}**\n`);
        collectFiles(item.children);
      }
    }
  }

  collectFiles(nodes);

  if (links.length === 0) {
    return `# ${projectName}\n\nNo documents yet.`;
  }

  return `# ${projectName}\n\n${links.join("\n")}`;
}

// GET /api/published-docs/[projectId]/[...path]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; path: string[] }> }
) {
  const { projectId, path: rawPath } = await params;

  // 路径安全检查
  for (const seg of rawPath) {
    if (seg === ".." || seg.includes("\0")) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  // 检查发布状态
  const publishInfo = await getPublishInfo(projectId);
  if (!publishInfo) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const projectName = publishInfo.name;

  const filePath = rawPath.join("/");
  const docsDirSegments = ["projects", projectId, "docs"];

  // 特殊路径：动态生成侧边栏
  if (filePath === "_sidebar.md") {
    const rawTree = listTree(docsDirSegments, [".md"]);
    const docsPrefix = docsDirSegments.join("/");
    const tree = stripTreePrefix(rawTree, docsPrefix);

    const sidebar = generateSidebarMarkdown(tree);
    return new NextResponse(sidebar, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=30",
      },
    });
  }

  // 只允许 .md 文件
  if (!filePath.endsWith(".md")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // 读取文档内容
  const fileSegments = [...docsDirSegments, ...rawPath];
  const content = readDocument(...fileSegments);

  if (content === null) {
    // 如果请求的是 README.md 但不存在，自动生成首页
    if (filePath === "README.md") {
      const rawTree = listTree(docsDirSegments, [".md"]);
      const docsPrefix = docsDirSegments.join("/");
      const tree = stripTreePrefix(rawTree, docsPrefix);
      const indexPage = generateIndexPage(tree, projectName);
      return new NextResponse(indexPage, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=30",
        },
      });
    }
    return new NextResponse("Not Found", { status: 404 });
  }

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}
