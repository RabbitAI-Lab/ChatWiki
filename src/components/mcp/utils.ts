// Pure helpers for MCP configuration UI. No React dependencies.

import {
  MCP_BASE_URL,
  SYSTEM_MCP_NAMES,
  SYSTEM_MCP_NEEDS_KEY,
  type McpServerEntry,
  type McpServerType,
  type McpJson,
} from "./types";

// Build an empty McpJson used as initial state and a safe fallback.
export function emptyMcpJson(): McpJson {
  return { mcpServers: {}, disabled: {}, _apiKeys: {} };
}

// Check whether an MCP is a system one (platform-injected, not deletable).
export function isSystemMcp(name: string): boolean {
  return SYSTEM_MCP_NAMES.has(name);
}

// Format a server entry as a one-line description.
// Sensitive Authorization=... query segments are redacted.
export function describeServer(entry: McpServerEntry): string {
  if (entry.command) {
    const args = (entry.args || []).join(" ");
    return `${entry.command} ${args}`.trim();
  }
  if (entry.url) {
    return entry.url.replace(/Authorization=[^&]+/g, "Authorization=***");
  }
  return "(empty)";
}

// Infer the server type from an entry. Falls back to "stdio" when ambiguous.
export function inferType(entry: McpServerEntry): McpServerType {
  if (entry.type === "stdio" || entry.type === "http" || entry.type === "sse") {
    return entry.type;
  }
  if (entry.command) return "stdio";
  if (entry.url) {
    if (entry.url.includes("/sse") || /\.sse(\?|$)/.test(entry.url)) return "sse";
    return "http";
  }
  return "stdio";
}

// Whether the entry's URL carries a sensitive Authorization=... segment.
export function hasAuthorization(entry: McpServerEntry): boolean {
  return !!(entry.url && entry.url.includes("Authorization="));
}

// Whether this MCP name needs an API Key (either it already has Authorization=
// in its URL, or it is a system MCP that requires one to enable).
export function needsApiKey(name: string, entry: McpServerEntry): boolean {
  return hasAuthorization(entry) || SYSTEM_MCP_NEEDS_KEY.has(name);
}

/**
 * Parse multi-line text into a key/value record.
 * `separator` is "=" for env (KEY=VALUE) and ":" for headers (Key: Value).
 * Empty lines and lines without the separator are dropped.
 */
export function parseLineMap(
  text: string | undefined,
  separator: "=" | ":",
): Record<string, string> {
  if (!text || !text.trim()) return {};
  return Object.fromEntries(
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const idx = line.indexOf(separator);
        if (idx > 0) {
          return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
        }
        return [line, ""];
      }),
  );
}

// Form values produced by AddMcpModal.
export interface AddMcpFormValues {
  name: string;
  type: McpServerType;
  command?: string;
  args?: string;
  env?: string;
  url?: string;
  headers?: string;
}

/**
 * Build a McpServerEntry from raw form values. Only handles entry construction
 * and parsing of env/headers; duplicate-name checks are the caller's concern.
 */
export function buildEntryFromFormValues(
  values: AddMcpFormValues,
): McpServerEntry {
  const entry: McpServerEntry = { type: values.type };
  if (values.type === "stdio") {
    entry.command = values.command;
    entry.args = (values.args || "")
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const env = parseLineMap(values.env, "=");
    if (Object.keys(env).length > 0) entry.env = env;
  } else {
    entry.url = values.url;
    const headers = parseLineMap(values.headers, ":");
    if (Object.keys(headers).length > 0) entry.headers = headers;
  }
  return entry;
}

// Re-export the zhipu base URL for callers that need to rebuild URLs.
export { MCP_BASE_URL };
