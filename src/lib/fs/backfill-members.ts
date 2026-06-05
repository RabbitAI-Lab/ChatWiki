/**
 * 成员关系回填模块
 *
 * 从文件系统中的 .project.json / .workspace.json 扫描成员数据，
 * 回填到 entity_members 表。用于 DB 缓存初始化。
 */
import fs from "node:fs";
import path from "node:path";

import { db, getSqlite } from "@/db";
import { entityMembers } from "@/db/schema";
import { getDataRoot } from "./core";
import { sql } from "drizzle-orm";
import type { ProjectMeta } from "../types";

/**
 * 回填 entity_members 表。
 *
 * 幂等：如果表已有数据则跳过。
 * 事务：批量插入，失败回滚。
 */
export function backfillEntityMembers(): void {
  // 幂等检查: 如果表已有数据则跳过
  const existing = db
    .select({ count: sql<number>`count(*)` })
    .from(entityMembers)
    .get();
  if (existing && existing.count > 0) {
    console.log(`[backfill] entity_members already has ${existing.count} rows, skipping.`);
    return;
  }

  const dataRoot = getDataRoot();
  const personalDir = path.join(dataRoot, "personal");
  if (!fs.existsSync(personalDir)) {
    console.log("[backfill] No personal directory, nothing to backfill.");
    return;
  }

  let inserted = 0;

  // 使用事务批量插入
  const sqlite = getSqlite();
  const insertMany = sqlite.transaction(() => {
    const ownerDirs = fs
      .readdirSync(personalDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const ownerDir of ownerDirs) {
      const ownerId = ownerDir.name;

      for (const [entityDir, entityType, metaFileName] of [
        ["projects", "project", ".project.json"],
        ["workspace", "workspace", ".workspace.json"],
      ] as const) {
        const entityPath = path.join(personalDir, ownerId, entityDir);
        if (!fs.existsSync(entityPath)) continue;

        const entities = fs
          .readdirSync(entityPath, { withFileTypes: true })
          .filter((d) => d.isDirectory() || d.isSymbolicLink());

        for (const entity of entities) {
          const metaPath = path.join(entityPath, entity.name, metaFileName);
          if (!fs.existsSync(metaPath)) continue;
          try {
            const raw = fs.readFileSync(metaPath, "utf-8");
            const meta = JSON.parse(raw) as ProjectMeta;
            if (!meta.members?.length) continue;

            for (const member of meta.members) {
              if (!member.userId) continue; // 只索引有 userId 的成员
              try {
                db.insert(entityMembers)
                  .values({
                    entityId: meta.id,
                    entityType,
                    memberId: member.id,
                    userId: member.userId,
                    accountName: member.accountName,
                    ownerId,
                    addedAt: member.addedAt,
                    createdAt: new Date().toISOString(),
                  })
                  .onConflictDoNothing()
                  .run();
                inserted++;
              } catch {
                // duplicate — skip
              }
            }
          } catch {
            // skip invalid meta
          }
        }
      }
    }
  });

  insertMany();
  console.log(`[backfill] entity_members: inserted ${inserted} member records.`);
}
