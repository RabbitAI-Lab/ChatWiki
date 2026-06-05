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
import { db } from "@/db";
import { entityMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// entityDir -> entityType 映射
const ENTITY_DIR_TO_TYPE: Record<string, string> = {
  projects: "project",
  workspace: "workspace",
};

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
      .filter((d) => d.isDirectory() || d.isSymbolicLink());

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
          ownerId: accountId,
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
      ownerId: accountId,
      sortOrder: 0,
    };
    strategy.writeMeta(meta, dirSegments);
    return meta;
  }

  function remove(type: "personal" | "enterprise", accountId: string, id: string, orgId?: string): void {
    const accountSegs = getAccountSegments(type, accountId, orgId);
    const dirPath = path.join(getDataRoot(), ...accountSegs, entityDir, id);

    // 删除前清理 entity_members 索引
    const entityType = ENTITY_DIR_TO_TYPE[entityDir];
    if (entityType) {
      try {
        db.delete(entityMembers)
          .where(
            and(
              eq(entityMembers.entityId, id),
              eq(entityMembers.entityType, entityType)
            )
          )
          .run();
      } catch (e) {
        console.warn(`[MemberDB] Failed to clean up entity_members for ${id}:`, e);
      }
    }

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

    // 如果成员有 userId，创建 symlink 使其在自己的目录下可见
    if (member.userId && dirSegments.length >= 4) {
      try {
        const [personal, ownerId, entityDir, entityId] = dirSegments;
        const memberProjectsDir = path.join(getDataRoot(), personal, member.userId, entityDir);
        if (!fs.existsSync(memberProjectsDir)) {
          fs.mkdirSync(memberProjectsDir, { recursive: true });
        }
        const linkPath = path.join(memberProjectsDir, entityId);
        // symlink 指向所有者的项目目录: ../../../{ownerId}/{entityDir}/{entityId}/
        const targetPath = path.join("..", "..", "..", ownerId, entityDir, entityId);
        if (!fs.existsSync(linkPath)) {
          fs.symlinkSync(targetPath, linkPath);
        }
      } catch (e) {
        console.warn(`[MemberSymlink] Failed to create symlink for member ${member.userId}:`, e);
      }
    }

    // 同步写 DB 索引
    syncMemberToDb(dirSegments, member);

    return meta.members;
  }

  function remove(dirSegments: string[], memberId: string): void {
    const meta = strategy.readMeta(dirSegments);
    if (!meta) throw new Error(`${strategy.entityName} not found`);
    const removed = (meta.members || []).find((m) => m.id === memberId);
    meta.members = (meta.members || []).filter((m) => m.id !== memberId);
    strategy.writeMeta(meta, dirSegments);

    // 如果成员有 userId，清理 symlink
    if (removed?.userId && dirSegments.length >= 4) {
      try {
        const [personal, _ownerId, entityDir, entityId] = dirSegments;
        const linkPath = path.join(getDataRoot(), personal, removed.userId, entityDir, entityId);
        if (fs.existsSync(linkPath) && fs.lstatSync(linkPath).isSymbolicLink()) {
          fs.unlinkSync(linkPath);
        }
      } catch (e) {
        console.warn(`[MemberSymlink] Failed to remove symlink for member ${removed.userId}:`, e);
      }
    }

    // 同步从 DB 索引删除
    removeMemberFromDb(dirSegments, memberId);
  }

  function update(dirSegments: string[], memberId: string, updates: Partial<Omit<ProjectMember, "id">>): ProjectMember | null {
    const meta = strategy.readMeta(dirSegments);
    if (!meta) throw new Error(`${strategy.entityName} not found`);
    const member = (meta.members || []).find((m) => m.id === memberId);
    if (!member) return null;
    Object.assign(member, updates);
    strategy.writeMeta(meta, dirSegments);

    // 同步更新 DB 索引
    updateMemberInDb(dirSegments, memberId, updates);

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

// ────────────────────────────────────────────────────────────
// 辅助函数: 查找用户作为成员的实体 ID (DB 优先 + 文件回退)
// ────────────────────────────────────────────────────────────

/**
 * 文件系统扫描回退逻辑 — 遍历所有用户目录查找成员关系。
 * 仅当 DB 查询失败或返回空时调用。
 */
function scanFilesystemForMembers(userId: string, entityDir: string, metaFileName: string): string[] {
  const dataRoot = getDataRoot();
  const personalDir = path.join(dataRoot, "personal");
  if (!fs.existsSync(personalDir)) return [];

  const result: string[] = [];
  const ownerDirs = fs.readdirSync(personalDir, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const ownerDir of ownerDirs) {
    const entityPath = path.join(personalDir, ownerDir.name, entityDir);
    if (!fs.existsSync(entityPath)) continue;

    const entities = fs.readdirSync(entityPath, { withFileTypes: true })
      .filter((d) => d.isDirectory() || d.isSymbolicLink());

    for (const entity of entities) {
      const metaPath = path.join(entityPath, entity.name, metaFileName);
      if (!fs.existsSync(metaPath)) continue;
      try {
        const raw = fs.readFileSync(metaPath, "utf-8");
        const meta = JSON.parse(raw) as ProjectMeta;
        if (meta.members?.some((m) => m.userId === userId)) {
          result.push(meta.id);
        }
      } catch {
        // skip invalid meta
      }
    }
  }

  return result;
}

/**
 * 异步回填 DB 索引 — 将文件系统扫描结果写入 entity_members 表。
 */
async function repairMemberIndex(
  userId: string,
  entityType: string,
  entityIds: string[]
): Promise<void> {
  for (const entityId of entityIds) {
    try {
      db.insert(entityMembers)
        .values({
          entityId,
          entityType,
          memberId: `repaired-${entityId}-${userId}`,
          userId,
          accountName: "repaired",
          ownerId: "unknown",
          addedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        })
        .onConflictDoNothing()
        .run();
    } catch {
      // duplicate or DB error — skip
    }
  }
}

/**
 * 查找指定用户作为成员的所有实体（项目/工作空间）ID。
 *
 * 优先查询 DB (entity_members 表)，如果 DB 为空则回退到文件系统扫描，
 * 并在文件扫描发现数据时异步回填 DB。
 */
export function findMemberEntityIds(userId: string, entityDir: string, metaFileName: string): string[] {
  const entityType = ENTITY_DIR_TO_TYPE[entityDir];

  // Phase 1: 尝试 DB 查询
  if (entityType) {
    try {
      const rows = db
        .select({ entityId: entityMembers.entityId })
        .from(entityMembers)
        .where(
          and(
            eq(entityMembers.userId, userId),
            eq(entityMembers.entityType, entityType)
          )
        )
        .all();

      if (rows.length > 0) {
        return rows.map((r) => r.entityId);
      }
    } catch (e) {
      console.warn("[MemberDB] DB query failed, falling back to filesystem:", e);
    }
  }

  // Phase 2: 回退到文件系统扫描
  const result = scanFilesystemForMembers(userId, entityDir, metaFileName);

  // Phase 3: 文件系统有数据但 DB 为空 → 异步回填
  if (result.length > 0 && entityType) {
    repairMemberIndex(userId, entityType, result).catch(() => {});
  }

  return result;
}

// ────────────────────────────────────────────────────────────
// DB 索引辅助函数
// ────────────────────────────────────────────────────────────

function extractEntityInfo(dirSegments: string[]): {
  entityId: string;
  entityType: string;
  ownerId: string;
} | null {
  // dirSegments 格式: [personal|enterprise, ownerId, entityDir, entityId]
  if (dirSegments.length < 4) return null;
  const [, ownerId, entityDir, entityId] = dirSegments;
  const entityType = ENTITY_DIR_TO_TYPE[entityDir];
  if (!entityType) return null;
  return { entityId, entityType, ownerId };
}

function syncMemberToDb(dirSegments: string[], member: ProjectMember): void {
  const info = extractEntityInfo(dirSegments);
  if (!info) return;
  try {
    db.insert(entityMembers)
      .values({
        entityId: info.entityId,
        entityType: info.entityType,
        memberId: member.id,
        userId: member.userId ?? null,
        accountName: member.accountName,
        ownerId: info.ownerId,
        addedAt: member.addedAt,
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing()
      .run();
  } catch (e) {
    console.warn("[MemberDB] Failed to sync member to DB:", e);
  }
}

function removeMemberFromDb(dirSegments: string[], memberId: string): void {
  const info = extractEntityInfo(dirSegments);
  if (!info) return;
  try {
    db.delete(entityMembers)
      .where(
        and(
          eq(entityMembers.entityId, info.entityId),
          eq(entityMembers.entityType, info.entityType),
          eq(entityMembers.memberId, memberId)
        )
      )
      .run();
  } catch (e) {
    console.warn("[MemberDB] Failed to remove member from DB:", e);
  }
}

function updateMemberInDb(
  dirSegments: string[],
  memberId: string,
  updates: Partial<Omit<ProjectMember, "id">>
): void {
  const info = extractEntityInfo(dirSegments);
  if (!info) return;
  try {
    const setFields: Record<string, string> = {};
    if (updates.accountName !== undefined) setFields.accountName = updates.accountName;
    if (updates.userId !== undefined) setFields.userId = updates.userId;
    if (updates.addedAt !== undefined) setFields.addedAt = updates.addedAt;
    if (Object.keys(setFields).length > 0) {
      db.update(entityMembers)
        .set(setFields)
        .where(
          and(
            eq(entityMembers.entityId, info.entityId),
            eq(entityMembers.entityType, info.entityType),
            eq(entityMembers.memberId, memberId)
          )
        )
        .run();
    }
  } catch (e) {
    console.warn("[MemberDB] Failed to update member in DB:", e);
  }
}
