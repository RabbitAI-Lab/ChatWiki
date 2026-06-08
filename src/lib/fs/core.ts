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

/** Cached data root (resolved once on first call) */
let _cachedDataRoot: string | undefined;

/**
 * Get the data root directory.
 * If a custom storage path is configured in the database, use it;
 * otherwise fall back to the default ./data directory.
 */
export function getDataRoot(): string {
  if (_cachedDataRoot) return _cachedDataRoot;
  // Use default until DB is queried asynchronously
  return DEFAULT_DATA_ROOT;
}

/**
 * Initialize data root from database (called during initDb).
 * Caches the result for subsequent synchronous access.
 */
export async function initDataRootFromDb(): Promise<void> {
  try {
    const { db } = await import("@/db");
    const { storageConfig } = await import("@/db/schema");
    const [config] = await db.select().from(storageConfig).limit(1);
    if (config?.storagePath) {
      _cachedDataRoot = config.storagePath;
    }
  } catch {
    // DB not available, use default
  }
}

/**
 * Build a full file system path from path segments.
 */
export function buildPath(...segments: string[]): string {
  assertValidSegments(segments);
  const last = segments[segments.length - 1];
  const withMd =
    segments.length > 0 && !last.endsWith(".md")
      ? [...segments.slice(0, -1), `${last}.md`]
      : segments;
  return path.join(getDataRoot(), ...withMd);
}

/**
 * Build a full file system path for an HTML file.
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

function assertValidSegments(segments: string[]): void {
  for (const seg of segments) {
    if (seg === ".." || seg.includes("\0")) {
      throw new Error("Invalid path segment");
    }
  }
}

/** Resolve a full path under data root (no file extension added). */
export function resolvePath(...segments: string[]): string {
  return path.join(getDataRoot(), ...segments);
}

export function listOrgs(enterpriseId: string): string[] {
  const dirPath = path.join(getDataRoot(), "enterprise", enterpriseId);
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

const HIDDEN_DIR_PATTERN = /^\./;
const EXCLUDED_DIRS = new Set(["node_modules"]);

export function listTree(dirSegments: string[], exts: string[] = [".md"]): TreeNode[] {
  const dirPath = path.join(getDataRoot(), ...dirSegments);
  if (!fs.existsSync(dirPath)) return [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const result: TreeNode[] = [];
  const sorted = entries.sort((a, b) => a.name.localeCompare(b.name));
  const acceptAll = exts.length === 0;

  for (const entry of sorted) {
    const relPath = path.join(...dirSegments, entry.name);
    if (entry.isDirectory()) {
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

export function createDir(dirSegments: string[]): void {
  const dirPath = path.join(getDataRoot(), ...dirSegments);
  fs.mkdirSync(dirPath, { recursive: true });
}

export function deleteDir(dirSegments: string[]): void {
  const dirPath = path.join(getDataRoot(), ...dirSegments);
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

export function renameDir(newName: string, ...dirSegments: string[]): void {
  const oldPath = path.join(getDataRoot(), ...dirSegments);
  const newPath = path.join(getDataRoot(), ...dirSegments.slice(0, -1), newName);
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
  }
}
