// Centralised re-exports for the MCP configuration UI.
// Allows callers to import multiple pieces from a single path:
//   import { useMcpConfig, McpListItem, AddMcpModal } from "@/components/mcp";

export {
  MCP_BASE_URL,
  NAME_PATTERN,
  SYSTEM_MCP_NAMES,
  SYSTEM_MCP_DEFAULTS,
} from "./types";
export type { McpJson, McpServerEntry, McpServerType } from "./types";

export {
  buildEntryFromFormValues,
  describeServer,
  emptyMcpJson,
  hasAuthorization,
  inferType,
  isSystemMcp,
  needsApiKey,
  parseLineMap,
} from "./utils";
export type { AddMcpFormValues } from "./utils";

export {
  useMcpConfig,
  type McpRenderEntry,
  type UseMcpConfigParams,
  type UseMcpConfigResult,
} from "./use-mcp-config";

export { default as AddMcpModal } from "./add-mcp-modal";
export { default as ApiKeyMcpModal } from "./api-key-mcp-modal";
export { default as EditMcpModal } from "./edit-mcp-modal";
export { default as McpListItem } from "./mcp-list-item";
export { default as McpToolbar } from "./mcp-toolbar";
