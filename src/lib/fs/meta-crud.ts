/**
 * Generic CRUD factories that eliminate code duplication between
 * Project and Workspace entity operations.
 *
 * The "strategy object" pattern is used because ProjectMeta and WorkspaceMeta
 * share identical fields — the difference is in *behaviour* (which JSON file to
 * read/write, which directory name to use), not in *type*.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type {
  ProjectMeta,
  Repository,
  ProjectMember,
} from "../types";
import { getDataRoot, getAccountSegments, createDir } from "./core";

// ────────────────────────────────────────────────────────────
// Strategy interfaces
// ────────────────────────────────────────────────────────────

/** Strategy for reading/writing entity metadata. */
export interface MetaStrategy {
  readMeta(dirSegments: string[]): ProjectMeta | null;
  writeMeta(meta: ProjectMeta, dirSegments: string[]): void;
  entityName: string; // "Project" | "Workspace" — used in error messages
}

/** Extended strategy for full entity CRUD (list / create / delete). */
export interface EntityStrategy extends MetaStrategy {
  entityDir: string;          // "projects" | "workspace"
  metaFileName: string;       // ".project.json" | ".workspace.json"
  defaultNamePrefix: string;  // "Project" | "Workspace"
  /** Whether to create a docs/ subdirectory on entity creation (Project-only). */
  createDocsDir?: boolean;
}

// ────────────────────────────────────────────────────────────
// Generic read/write helpers (used by strategies)
// ────────────────────────────────────────────────────────────

/** Generic metadata reader — reads and parses a JSON file. */
export function readMetaFile(dirSegments: string[], fileName: string): ProjectMeta | null {
  const metaPath = path.join(getDataRoot(), ...dirSegments, fileName);
  if (!fs.existsSync(metaPath)) return null;
  try {
    const raw = fs.readFileSync(metaPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Generic metadata writer — serialises to a JSON file. */
export function writeMetaFile(meta: ProjectMeta, dirSegments: string[], fileName: string): void {
  const metaPath = path.join(getDataRoot(), ...dirSegments, fileName);
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");
}

// ────────────────────────────────────────────────────────────
// Factory: Entity CRUD (list / create / delete)
// ────────────────────────────────────────────────────────────

export interface EntityCrud {
  list(type: "personal" | "enterprise", accountId: string, orgId?: string): ProjectMeta[];
  create(type: "personal" | "enterprise", accountId: string, name: string, orgId?: string): ProjectMeta;
  remove(type: "personal" | "enterprise", accountId: string, id: string, orgId?: string): void;
}

export function createEntityCrud(strategy: EntityStrategy): EntityCrud {
  const { entityDir, defaultNamePrefix, createDocsDir } = strategy;

  function list(type: "personal" | "enterprise", accountId: string, orgId?: string): ProjectMeta[] {
    const accountSegs = getAccountSegments(type, accountId, orgId);
    const dirPath = path.join(getDataRoot(), ...accountSegs, entityDir);

    if (!fs.existsSync(dirPath)) return [];
    const dirs = fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    const result: ProjectMeta[] = [];
    for (const d of dirs) {
      const segs = [...accountSegs, entityDir, d.name];
      const meta = strategy.readMeta(segs);
      if (meta) {
        if (meta.sortOrder === undefined || meta.sortOrder === null) meta.sortOrder = 999;
        result.push(meta);
      } else {
        // Auto-create missing metadata with a friendly default name
        const fallback: ProjectMeta = {
          id: d.name,
          name: `${defaultNamePrefix} ${d.name.slice(0, 8)}`,
          description: "",
          createdAt: new Date().toISOString(),
          accountId,
          accountType: type,
          sortOrder: 999,
        };
        strategy.writeMeta(fallback, segs);
        result.push(fallback);
      }
    }
    result.sort((a, b) => a.sortOrder - b.sortOrder);
    return result;
  }

  function create(type: "personal" | "enterprise", accountId: string, name: string, orgId?: string): ProjectMeta {
    const accountSegs = getAccountSegments(type, accountId, orgId);

    // Shift all existing entities' sortOrder by 1 so new one goes first
    const existing = list(type, accountId, orgId);
    for (const p of existing) {
      p.sortOrder += 1;
      strategy.writeMeta(p, [...accountSegs, entityDir, p.id]);
    }

    const id = randomUUID();
    const dirSegments = [...accountSegs, entityDir, id];
    createDir(dirSegments);
    if (createDocsDir) {
      createDir([...dirSegments, "docs"]);
    }

    const meta: ProjectMeta = {
      id,
      name,
      description: "",
      createdAt: new Date().toISOString(),
      accountId,
      accountType: type,
      sortOrder: 0,
    };
    strategy.writeMeta(meta, dirSegments);
    return meta;
  }

  function remove(type: "personal" | "enterprise", accountId: string, id: string, orgId?: string): void {
    const accountSegs = getAccountSegments(type, accountId, orgId);
    const dirPath = path.join(getDataRoot(), ...accountSegs, entityDir, id);
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  }

  return { list, create, remove };
}

// ────────────────────────────────────────────────────────────
// Factory: Repository CRUD
// ────────────────────────────────────────────────────────────

export interface RepositoryCrud {
  add(dirSegments: string[], repository: Repository): Repository[];
  remove(dirSegments: string[], repoId: string): void;
  update(dirSegments: string[], repoId: string, updates: Partial<Omit<Repository, "id">>): Repository | null;
}

export function createRepositoryCrud(strategy: MetaStrategy): RepositoryCrud {
  function add(dirSegments: string[], repository: Repository): Repository[] {
    const meta = strategy.readMeta(dirSegments);
    if (!meta) throw new Error(`${strategy.entityName} not found`);
    if (!meta.repositories) meta.repositories = [];
    meta.repositories.push(repository);
    strategy.writeMeta(meta, dirSegments);
    return meta.repositories;
  }

  function remove(dirSegments: string[], repoId: string): void {
    const meta = strategy.readMeta(dirSegments);
    if (!meta) throw new Error(`${strategy.entityName} not found`);
    meta.repositories = (meta.repositories || []).filter((r) => r.id !== repoId);
    strategy.writeMeta(meta, dirSegments);
  }

  function update(dirSegments: string[], repoId: string, updates: Partial<Omit<Repository, "id">>): Repository | null {
    const meta = strategy.readMeta(dirSegments);
    if (!meta) throw new Error(`${strategy.entityName} not found`);
    const repo = (meta.repositories || []).find((r) => r.id === repoId);
    if (!repo) return null;
    Object.assign(repo, updates);
    strategy.writeMeta(meta, dirSegments);
    return repo;
  }

  return { add, remove, update };
}

// ────────────────────────────────────────────────────────────
// Factory: Member CRUD
// ────────────────────────────────────────────────────────────

export interface MemberCrud {
  add(dirSegments: string[], member: ProjectMember): ProjectMember[];
  remove(dirSegments: string[], memberId: string): void;
  update(dirSegments: string[], memberId: string, updates: Partial<Omit<ProjectMember, "id">>): ProjectMember | null;
}

export function createMemberCrud(strategy: MetaStrategy): MemberCrud {
  function add(dirSegments: string[], member: ProjectMember): ProjectMember[] {
    const meta = strategy.readMeta(dirSegments);
    if (!meta) throw new Error(`${strategy.entityName} not found`);
    if (!meta.members) meta.members = [];
    meta.members.push(member);
    strategy.writeMeta(meta, dirSegments);
    return meta.members;
  }

  function remove(dirSegments: string[], memberId: string): void {
    const meta = strategy.readMeta(dirSegments);
    if (!meta) throw new Error(`${strategy.entityName} not found`);
    meta.members = (meta.members || []).filter((m) => m.id !== memberId);
    strategy.writeMeta(meta, dirSegments);
  }

  function update(dirSegments: string[], memberId: string, updates: Partial<Omit<ProjectMember, "id">>): ProjectMember | null {
    const meta = strategy.readMeta(dirSegments);
    if (!meta) throw new Error(`${strategy.entityName} not found`);
    const member = (meta.members || []).find((m) => m.id === memberId);
    if (!member) return null;
    Object.assign(member, updates);
    strategy.writeMeta(meta, dirSegments);
    return member;
  }

  return { add, remove, update };
}

// ────────────────────────────────────────────────────────────
// Factory: MCP Config CRUD
// ────────────────────────────────────────────────────────────

export interface McpConfigCrud {
  read(dirSegments: string[]): Record<string, unknown> | null;
  write(config: object, dirSegments: string[]): void;
}

export function createMcpConfigCrud(): McpConfigCrud {
  function read(dirSegments: string[]): Record<string, unknown> | null {
    const configPath = path.join(getDataRoot(), ...dirSegments, ".mcp.json");
    if (!fs.existsSync(configPath)) return null;
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function write(config: object, dirSegments: string[]): void {
    const configPath = path.join(getDataRoot(), ...dirSegments, ".mcp.json");
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  return { read, write };
}
