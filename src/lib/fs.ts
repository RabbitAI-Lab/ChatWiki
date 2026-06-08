/**
 * Barrel file — re-exports everything from the split modules.
 * All 46+ consumers continue to import from "@/lib/fs" unchanged.
 */

// ── Types (from types.ts) ──
export type {
  Repository,
  RepositoryCredentials,
  SandboxStatus,
  SkillStatus,
  ProjectSkills,
  ProjectMember,
  ProjectMeta,
  WorkspaceMeta,
  GitNexusStatus,
  GitNexusPhase,
} from "./types";

// ── Tree helpers (from tree.ts) ──
export { stripTreePrefix } from "./tree";
export type { TreeNode } from "./tree";

// ── Core filesystem utilities ──
export {
  getDataRoot,
  resolvePath,
  buildPath,
  buildHtmlPath,
  listOrgs,
  listTree,
  createDir,
  deleteDir,
  renameDir,
} from "./fs/core";

// ── Document operations (MD + HTML) ──
export {
  readDocument,
  writeDocument,
  deleteDocument,
  renameDocument,
  listDocuments,
  readHtmlDocument,
  writeHtmlDocument,
  deleteHtmlDocument,
  renameHtmlDocument,
  listHtmlDocuments,
} from "./fs/documents";

// ── Project CRUD + metadata + repository + member + MCP config ──
export {
  listProjects,
  createProject,
  deleteProject,
  readProjectMeta,
  writeProjectMeta,
  addRepository,
  removeRepository,
  updateRepository,
  addMember,
  removeMember,
  updateMember,
  readProjectMcpConfig,
  writeProjectMcpConfig,
} from "./fs/project";

// ── Workspace CRUD + metadata + repository + member + MCP config + links ──
export {
  listWorkspaces,
  createWorkspace,
  deleteWorkspace,
  readWorkspaceMeta,
  writeWorkspaceMeta,
  addWorkspaceRepository,
  removeWorkspaceRepository,
  updateWorkspaceRepository,
  addWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspaceMember,
  readWorkspaceMcpConfig,
  writeWorkspaceMcpConfig,
  listWorkspaceProjects,
  linkProjectToWorkspace,
  unlinkProjectFromWorkspace,
} from "./fs/workspace";

// ── 辅助: 查找用户作为成员的实体 ──
export { findMemberEntityIds } from "./fs/meta-crud";
