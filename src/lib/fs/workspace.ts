/**
 * Workspace-specific functions: CRUD, metadata, repository, member, and MCP config.
 * Uses the generic factories from meta-crud.ts.
 */
import type { WorkspaceMeta, Repository, ProjectMember } from "../types";
import {
  readMetaFromDb,
  writeMetaToDb,
  createEntityCrud,
  createRepositoryCrud,
  createMemberCrud,
  createMcpConfigCrud,
} from "./meta-crud";
import type { EntityStrategy } from "./meta-crud";

// ────────────────────────────────────────────────────────────
// Workspace strategy
// ────────────────────────────────────────────────────────────

const WORKSPACE_STRATEGY: EntityStrategy = {
  entityName: "Workspace",
  entityDir: "workspace",
  entityType: "workspace",
  metaFileName: ".workspace.json",
  defaultNamePrefix: "Workspace",
  createDocsDir: true,
  async readMeta(dirSegments) {
    const entityId = dirSegments[dirSegments.length - 1];
    return readMetaFromDb(entityId, "workspace");
  },
  async writeMeta(meta, _dirSegments) {
    await writeMetaToDb(meta, "workspace");
  },
};

// ────────────────────────────────────────────────────────────
// Entity CRUD
// ────────────────────────────────────────────────────────────

const workspaceEntityCrud = createEntityCrud(WORKSPACE_STRATEGY);

export const listWorkspaces: (accountId: string) => Promise<WorkspaceMeta[]> = workspaceEntityCrud.list as unknown as typeof listWorkspaces;
export const createWorkspace: (accountId: string, name: string) => Promise<WorkspaceMeta> = workspaceEntityCrud.create as unknown as typeof createWorkspace;
export const deleteWorkspace = workspaceEntityCrud.remove;

// ────────────────────────────────────────────────────────────
// Metadata read/write
// ────────────────────────────────────────────────────────────

export async function readWorkspaceMeta(dirSegments: string[]): Promise<WorkspaceMeta | null> {
  return WORKSPACE_STRATEGY.readMeta(dirSegments);
}

export async function writeWorkspaceMeta(meta: WorkspaceMeta, dirSegments: string[]): Promise<void> {
  await WORKSPACE_STRATEGY.writeMeta(meta, dirSegments);
}

// ────────────────────────────────────────────────────────────
// Repository CRUD
// ────────────────────────────────────────────────────────────

const workspaceRepoCrud = createRepositoryCrud(WORKSPACE_STRATEGY);

export const addWorkspaceRepository: (dirSegments: string[], repository: Repository) => Promise<Repository[]> = workspaceRepoCrud.add;
export const removeWorkspaceRepository: (dirSegments: string[], repoId: string) => Promise<void> = workspaceRepoCrud.remove;
export const updateWorkspaceRepository: (dirSegments: string[], repoId: string, updates: Partial<Omit<Repository, "id">>) => Promise<Repository | null> = workspaceRepoCrud.update;

// ────────────────────────────────────────────────────────────
// Member CRUD
// ────────────────────────────────────────────────────────────

const workspaceMemberCrud = createMemberCrud(WORKSPACE_STRATEGY);

export const addWorkspaceMember: (dirSegments: string[], member: ProjectMember) => Promise<ProjectMember[]> = workspaceMemberCrud.add;
export const removeWorkspaceMember: (dirSegments: string[], memberId: string) => Promise<void> = workspaceMemberCrud.remove;
export const updateWorkspaceMember: (dirSegments: string[], memberId: string, updates: Partial<Omit<ProjectMember, "id">>) => Promise<ProjectMember | null> = workspaceMemberCrud.update;

// ────────────────────────────────────────────────────────────
// MCP Config
// ────────────────────────────────────────────────────────────

const workspaceMcpCrud = createMcpConfigCrud();

export const readWorkspaceMcpConfig = workspaceMcpCrud.read;
export const writeWorkspaceMcpConfig = workspaceMcpCrud.write;

// ────────────────────────────────────────────────────────────
// Re-export workspace link functions
// ────────────────────────────────────────────────────────────

export {
  listWorkspaceProjects,
  linkProjectToWorkspace,
  unlinkProjectFromWorkspace,
} from "./workspace-links";
