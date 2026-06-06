/**
 * Core filesystem utilities: data root resolution, path building,
 * directory operations, and tree listing.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { TreeNode } from "../tree";

const DEFAULT_DATA_ROOT =
  process.env.DATA_ROOT ||
  path.join(os.homedir(), ".rabbitdocs", "data");

/**
 * Get the data root directory.
 * If a custom storage path is configured in the database, use it;
 * otherwise fall back to the default ./data directory.
 */
export function getDataRoot(): string {
  try {
    // Use require to avoid circular import issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { db } = require("@/db") as { db: import("drizzle-orm/better-sqlite3").BetterSQLite3Database };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { storageConfig } = require("@/db/schema") as { storageConfig: import("drizzle-orm/sqlite-core").SQLiteTableWithColumns<never> };
    const config = db.select().from(storageConfig).get() as { storagePath: string } | undefined;
    if (config?.storagePath) return config.storagePath;
  } catch {
    // DB not available (e.g. during build), use default
  }
  return DEFAULT_DATA_ROOT;
}

/**
 * Build a full file system path from path segments.
 * Example: buildPath("projects", "my-project", "docs", "doc") => "data/projects/my-project/docs/doc.md"
 * Rejects path segments containing ".." or null bytes to prevent path traversal attacks.
 */
export function buildPath(...segments: string[]): string {
  assertValidSegments(segments);
  const last = segments[segments.length - 1];
  // If the last segment doesn't already end with .md, add it
  const withMd =
    segments.length > 0 && !last.endsWith(".md")
      ? [...segments.slice(0, -1), `${last}.md`]
      : segments;
  return path.join(getDataRoot(), ...withMd);
}

/**
 * Build a full file system path for an HTML file (e.g. ".html" extension).
 * Mirrors {@link buildPath} but uses ".html" as the default extension.
 * Rejects path segments containing ".." or null bytes.
 */
export function buildHtmlPath(...segments: string[]): string {
  assertValidSegments(segments);
  const last = segments[segments.length - 1];
  const withHtml =
    segments.length > 0 && !last.endsWith(".html")
      ? [...segments.slice(0, -1), `${last}.html`]
      : segments;
  return path.join(getDataRoot(), ...withHtml);
}

/**
 * Reject path traversal attempts (e.g. "..") and null bytes inside path segments.
 */
function assertValidSegments(segments: string[]): void {
  for (const seg of segments) {
    if (seg === ".." || seg.includes("\0")) {
      throw new Error("Invalid path segment");
    }
  }
}

/**
 * List organizations for an enterprise.
 * Reads subdirectories under data/enterprise/{enterpriseId}/
 */
export function listOrgs(enterpriseId: string): string[] {
  const dirPath = path.join(getDataRoot(), "enterprise", enterpriseId);
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

/**
 * Recursively list a directory tree: directories and files matching the provided extensions.
 * Default behavior (exts = [".md"]) preserves backward compatibility with the original
 * Markdown-only tree.
 *
 * When exts is an empty array, all files are accepted (useful for workspace root view).
 * Hidden directories (starting with ".") and "node_modules" are always excluded.
 */
const HIDDEN_DIR_PATTERN = /^\./;
const EXCLUDED_DIRS = new Set(["node_modules"]);

export function listTree(dirSegments: string[], exts: string[] = [".md"]): TreeNode[] {
  const dirPath = path.join(getDataRoot(), ...dirSegments);
  if (!fs.existsSync(dirPath)) return [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const result: TreeNode[] = [];

  // Sort alphabetically, mixed order (macOS / Windows / Linux style)
  // Folders and files are interleaved by name, not grouped.
  const sorted = entries.sort((a, b) => a.name.localeCompare(b.name));

  const acceptAll = exts.length === 0;

  for (const entry of sorted) {
    const relPath = path.join(...dirSegments, entry.name);
    if (entry.isDirectory()) {
      // Skip hidden and excluded directories
      if (HIDDEN_DIR_PATTERN.test(entry.name) || EXCLUDED_DIRS.has(entry.name)) continue;
      result.push({
        name: entry.name,
        type: "directory",
        path: relPath,
        children: listTree([...dirSegments, entry.name], exts),
      });
    } else {
      const matchedExt = acceptAll || exts.find((ext) => entry.name.endsWith(ext));
      if (matchedExt) {
        result.push({
          name: entry.name,
          type: "file",
          path: relPath,
        });
      }
    }
  }

  return result;
}

/**
 * Create a directory (with parents).
 */
export function createDir(dirSegments: string[]): void {
  const dirPath = path.join(getDataRoot(), ...dirSegments);
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Delete a directory (recursively).
 */
export function deleteDir(dirSegments: string[]): void {
  const dirPath = path.join(getDataRoot(), ...dirSegments);
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Rename a directory.
 */
export function renameDir(newName: string, ...dirSegments: string[]): void {
  const oldPath = path.join(getDataRoot(), ...dirSegments);
  const newPath = path.join(getDataRoot(), ...dirSegments.slice(0, -1), newName);
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
  }
}
