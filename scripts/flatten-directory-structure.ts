/**
 * 数据迁移脚本：将文件系统目录从 personal/{accountId}/projects/{id} 扁平化为 projects/{id}
 *
 * 变更前: data/personal/{accountId}/projects/{projectId}/docs/...
 *         data/personal/{accountId}/workspace/{workspaceId}/docs/...
 *
 * 变更后: data/projects/{projectId}/docs/...
 *         data/workspace/{workspaceId}/docs/...
 *
 * 注意: 数据库中的元数据不需要修改（readMetaFromDb 只按 entityId 查询）。
 *       symlink 会被清理（新架构不再使用 symlink）。
 *
 * 用法: npx tsx scripts/flatten-directory-structure.ts [--dry-run]
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import os from "os";

const RABBITDOCS_HOME =
  process.env.RABBITDOCS_HOME ||
  path.join(os.homedir(), ".rabbitdocs");
const DB_PATH = path.join(RABBITDOCS_HOME, "data.db");
const DATA_ROOT_ARG = process.argv.find((a) => !a.startsWith("--"));
const DRY_RUN = process.argv.includes("--dry-run");

function getDataRoot(): string {
  if (DATA_ROOT_ARG) return DATA_ROOT_ARG;
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const row = db.prepare("SELECT storage_path FROM storage_config LIMIT 1").get() as { storage_path: string } | undefined;
    db.close();
    if (row?.storage_path) return row.storage_path;
  } catch { /* ignore */ }
  const localData = path.join(process.cwd(), "data");
  if (fs.existsSync(localData)) return localData;
  return path.join(RABBITDOCS_HOME, "data");
}

function safeMove(oldPath: string, newPath: string): void {
  if (DRY_RUN) {
    console.log(`  [DRY] mv ${oldPath} -> ${newPath}`);
    return;
  }
  // Ensure target parent dir exists
  fs.mkdirSync(path.dirname(newPath), { recursive: true });
  // If target already exists, skip (idempotent)
  if (fs.existsSync(newPath)) {
    console.log(`  [SKIP] Target already exists: ${newPath}`);
    return;
  }
  fs.renameSync(oldPath, newPath);
  console.log(`  [MOVE] ${oldPath} -> ${newPath}`);
}

function isSymlink(p: string): boolean {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function main(): void {
  console.log("=== ChatWiki 目录扁平化迁移 ===\n");
  if (DRY_RUN) console.log("[DRY-RUN 模式] 仅输出，不执行实际操作\n");

  const dataRoot = getDataRoot();
  console.log(`Data root: ${dataRoot}`);

  const personalDir = path.join(dataRoot, "personal");
  if (!fs.existsSync(personalDir)) {
    console.log("'personal' 目录不存在，无需迁移。");
    return;
  }

  // ── 1. 迁移 projects ──
  console.log("\n── 步骤 1: 迁移 projects ──");
  const projectsTarget = path.join(dataRoot, "projects");
  let projectCount = 0;

  const accountDirs = fs.readdirSync(personalDir);
  for (const accountId of accountDirs) {
    const accountPath = path.join(personalDir, accountId);
    if (!fs.statSync(accountPath).isDirectory()) continue;

    const projectsDir = path.join(accountPath, "projects");
    if (!fs.existsSync(projectsDir)) continue;

    const projectDirs = fs.readdirSync(projectsDir);
    for (const projectId of projectDirs) {
      const oldPath = path.join(projectsDir, projectId);
      if (!fs.statSync(oldPath).isDirectory()) continue;
      if (isSymlink(oldPath)) {
        // 成员项目的 symlink — 直接删除
        if (DRY_RUN) {
          console.log(`  [DRY] rm symlink ${oldPath}`);
        } else {
          fs.unlinkSync(oldPath);
          console.log(`  [DEL-SYMLINK] ${oldPath}`);
        }
        continue;
      }

      const newPath = path.join(projectsTarget, projectId);
      safeMove(oldPath, newPath);
      projectCount++;
    }
  }
  console.log(`迁移了 ${projectCount} 个项目。`);

  // ── 2. 迁移 workspaces ──
  console.log("\n── 步骤 2: 迁移 workspace ──");
  const workspaceTarget = path.join(dataRoot, "workspace");
  let workspaceCount = 0;

  for (const accountId of accountDirs) {
    const accountPath = path.join(personalDir, accountId);
    if (!fs.statSync(accountPath).isDirectory()) continue;

    const workspaceDir = path.join(accountPath, "workspace");
    if (!fs.existsSync(workspaceDir)) continue;

    const wsDirs = fs.readdirSync(workspaceDir);
    for (const wsId of wsDirs) {
      const oldPath = path.join(workspaceDir, wsId);
      if (!fs.statSync(oldPath).isDirectory()) continue;

      const newPath = path.join(workspaceTarget, wsId);
      safeMove(oldPath, newPath);
      workspaceCount++;
    }
  }
  console.log(`迁移了 ${workspaceCount} 个工作空间。`);

  // ── 3. 清理空目录和残留 symlink ──
  console.log("\n── 步骤 3: 清理残留目录 ──");
  if (!DRY_RUN) {
    // 清理 personal 下所有空的 projects/workspace 子目录
    for (const accountId of accountDirs) {
      const accountPath = path.join(personalDir, accountId);
      if (!fs.statSync(accountPath).isDirectory()) continue;

      for (const sub of ["projects", "workspace"]) {
        const subPath = path.join(accountPath, sub);
        if (fs.existsSync(subPath)) {
          try {
            // Remove symlinks first
            const entries = fs.readdirSync(subPath);
            for (const entry of entries) {
              const entryPath = path.join(subPath, entry);
              if (isSymlink(entryPath)) {
                fs.unlinkSync(entryPath);
                console.log(`  [DEL-SYMLINK] ${entryPath}`);
              }
            }
            // Try to remove dir if empty
            const remaining = fs.readdirSync(subPath);
            if (remaining.length === 0) {
              fs.rmdirSync(subPath);
              console.log(`  [RMDIR] ${subPath}`);
            }
          } catch (e) {
            console.warn(`  [WARN] Cannot clean ${subPath}: ${(e as Error).message}`);
          }
        }
      }

      // Try to remove account dir if empty
      try {
        const remaining = fs.readdirSync(accountPath);
        if (remaining.length === 0) {
          fs.rmdirSync(accountPath);
          console.log(`  [RMDIR] ${accountPath}`);
        }
      } catch { /* ignore */ }
    }

    // Try to remove personal dir if empty
    try {
      const remaining = fs.readdirSync(personalDir);
      if (remaining.length === 0) {
        fs.rmdirSync(personalDir);
        console.log(`  [RMDIR] ${personalDir}`);
      } else {
        console.log(`  [INFO] personal 目录仍有内容: ${remaining.join(", ")}`);
      }
    } catch { /* ignore */ }
  } else {
    console.log("  [DRY] 跳过清理步骤");
  }

  // ── 4. 验证 ──
  console.log("\n── 步骤 4: 验证 ──");
  if (fs.existsSync(projectsTarget)) {
    const projects = fs.readdirSync(projectsTarget).filter((d) =>
      fs.statSync(path.join(projectsTarget, d)).isDirectory()
    );
    console.log(`  data/projects/ 下有 ${projects.length} 个项目目录`);
  }
  if (fs.existsSync(workspaceTarget)) {
    const workspaces = fs.readdirSync(workspaceTarget).filter((d) =>
      fs.statSync(path.join(workspaceTarget, d)).isDirectory()
    );
    console.log(`  data/workspace/ 下有 ${workspaces.length} 个工作空间目录`);
  }

  console.log("\n=== 迁移完成 ===");
  if (DRY_RUN) {
    console.log("这是 DRY-RUN 模式，未执行实际操作。去掉 --dry-run 参数执行实际迁移。");
  }
}

main();
