/**
 * Project-specific functions: CRUD, metadata, repository, member, and MCP config.
 * Uses the generic factories from meta-crud.ts.
 */
import type { ProjectMeta, Repository, ProjectMember } from "../types";
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
// Project strategy
// ────────────────────────────────────────────────────────────

const PROJECT_STRATEGY: EntityStrategy = {
  entityName: "Project",
  entityDir: "projects",
  entityType: "project",
  metaFileName: ".project.json",
  defaultNamePrefix: "Project",
  createDocsDir: true,
  async readMeta(dirSegments) {
    const entityId = dirSegments[dirSegments.length - 1];
    return readMetaFromDb(entityId, "project");
  },
  async writeMeta(meta, _dirSegments) {
    await writeMetaToDb(meta, "project");
  },
};

// ────────────────────────────────────────────────────────────
// Entity CRUD
// ────────────────────────────────────────────────────────────

const projectEntityCrud = createEntityCrud(PROJECT_STRATEGY);

export const listProjects = projectEntityCrud.list;
export const createProject = projectEntityCrud.create;
export const deleteProject = projectEntityCrud.remove;

// ────────────────────────────────────────────────────────────
// Metadata read/write
// ────────────────────────────────────────────────────────────

export async function readProjectMeta(dirSegments: string[]): Promise<ProjectMeta | null> {
  return PROJECT_STRATEGY.readMeta(dirSegments);
}

export async function writeProjectMeta(meta: ProjectMeta, dirSegments: string[]): Promise<void> {
  await PROJECT_STRATEGY.writeMeta(meta, dirSegments);
}

// ────────────────────────────────────────────────────────────
// Repository CRUD
// ────────────────────────────────────────────────────────────

const projectRepoCrud = createRepositoryCrud(PROJECT_STRATEGY);

export const addRepository: (dirSegments: string[], repository: Repository) => Promise<Repository[]> = projectRepoCrud.add;
export const removeRepository: (dirSegments: string[], repoId: string) => Promise<void> = projectRepoCrud.remove;
export const updateRepository: (dirSegments: string[], repoId: string, updates: Partial<Omit<Repository, "id">>) => Promise<Repository | null> = projectRepoCrud.update;

// ────────────────────────────────────────────────────────────
// Member CRUD
// ────────────────────────────────────────────────────────────

const projectMemberCrud = createMemberCrud(PROJECT_STRATEGY);

export const addMember: (dirSegments: string[], member: ProjectMember) => Promise<ProjectMember[]> = projectMemberCrud.add;
export const removeMember: (dirSegments: string[], memberId: string) => Promise<void> = projectMemberCrud.remove;
export const updateMember: (dirSegments: string[], memberId: string, updates: Partial<Omit<ProjectMember, "id">>) => Promise<ProjectMember | null> = projectMemberCrud.update;

// ────────────────────────────────────────────────────────────
// MCP Config
// ────────────────────────────────────────────────────────────

const projectMcpCrud = createMcpConfigCrud();

export const readProjectMcpConfig = projectMcpCrud.read;
export const writeProjectMcpConfig = projectMcpCrud.write;
