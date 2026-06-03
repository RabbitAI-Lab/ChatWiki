// Shared types and constants for MCP configuration UI.
// Used by both project-level and workspace-level panels.

export type McpServerType = "stdio" | "http" | "sse";

export interface McpServerEntry {
  type?: McpServerType;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
}

/**
 * Structure persisted in mcp.json files.
 * - mcpServers: entries currently enabled and injected into the Agent SDK.
 * - disabled:   entries kept as config but not injected; toggled off by the user.
 *               Project-level panel supports this; workspace-level does not.
 * - _apiKeys:   per-name API keys used to rebuild zhipu-style URLs on enable.
 */
export interface McpJson {
  mcpServers: Record<string, McpServerEntry>;
  disabled?: Record<string, McpServerEntry>;
  _apiKeys: Record<string, string>;
}

// MCP servers injected by the platform; not deletable.
export const SYSTEM_MCP_NAMES: ReadonlySet<string> = new Set([
  "gitnexus",
  "zhipu-web-search-sse",
]);

// System MCP names that require an API Key to enable.
export const SYSTEM_MCP_NEEDS_KEY: ReadonlySet<string> = new Set([
  "zhipu-web-search-sse",
]);

// Default entries for system MCP servers. These are merged into every
// project/workspace MCP config when the user has not overridden them.
export const SYSTEM_MCP_DEFAULTS: Record<string, McpServerEntry> = {
  gitnexus: {
    type: "stdio",
    command: "npx",
    args: ["-y", "gitnexus@latest", "mcp"],
  },
  "zhipu-web-search-sse": {
    type: "sse",
    url: "https://open.bigmodel.cn/api/mcp-broker/proxy/web-search/sse",
  },
};

// Name validation pattern: letters, digits, underscore and dash only.
export const NAME_PATTERN = /^[a-zA-Z0-9_\-]+$/;

// Base URL for zhipu-style MCP servers; API key is appended as ?Authorization=<key>.
export const MCP_BASE_URL =
  "https://open.bigmodel.cn/api/mcp-broker/proxy/web-search/mcp?Authorization=";
