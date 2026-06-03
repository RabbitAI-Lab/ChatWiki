/**
 * Document read/write operations for Markdown (.md) and HTML (.html) files.
 */
import fs from "node:fs";
import path from "node:path";

import { getDataRoot, buildPath, buildHtmlPath } from "./core";

// ========== Markdown documents ==========

/**
 * Read a document from .md file.
 * File path is constructed from segments, .md suffix added if needed.
 */
export function readDocument(...fileSegments: string[]): string | null {
  const filePath = buildPath(...fileSegments);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Write content to a document .md file.
 */
export function writeDocument(content: string, ...fileSegments: string[]): void {
  const filePath = buildPath(...fileSegments);
  const dirPath = path.dirname(filePath);
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

/**
 * Delete a document .md file.
 */
export function deleteDocument(...fileSegments: string[]): void {
  const filePath = buildPath(...fileSegments);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Rename a document (change title = rename .md file).
 */
export function renameDocument(newTitle: string, ...fileSegments: string[]): void {
  const oldPath = buildPath(...fileSegments);
  const newPath = buildPath(...fileSegments.slice(0, -1), newTitle);
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
  }
}

/**
 * List documents in a directory (only .md files).
 */
export function listDocuments(...dirSegments: string[]): string[] {
  const dirPath = path.join(getDataRoot(), ...dirSegments);
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".md"))
    .map((d) => d.name.slice(0, -3));
}

// ========== HTML documents ==========

/** Read a .html document. Returns null if not found. */
export function readHtmlDocument(...fileSegments: string[]): string | null {
  const filePath = buildHtmlPath(...fileSegments);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

/** Write content to a .html document. Creates parent directories as needed. */
export function writeHtmlDocument(content: string, ...fileSegments: string[]): void {
  const filePath = buildHtmlPath(...fileSegments);
  const dirPath = path.dirname(filePath);
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

/** Delete a .html document if it exists. */
export function deleteHtmlDocument(...fileSegments: string[]): void {
  const filePath = buildHtmlPath(...fileSegments);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/** Rename a .html document. newTitle may or may not include the ".html" suffix. */
export function renameHtmlDocument(newTitle: string, ...fileSegments: string[]): void {
  const oldPath = buildHtmlPath(...fileSegments);
  const newPath = buildHtmlPath(...fileSegments.slice(0, -1), newTitle);
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
  }
}

/** List .html files in a directory (returns filenames without the ".html" suffix). */
export function listHtmlDocuments(...dirSegments: string[]): string[] {
  const dirPath = path.join(getDataRoot(), ...dirSegments);
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".html"))
    .map((d) => d.name.slice(0, -5));
}
