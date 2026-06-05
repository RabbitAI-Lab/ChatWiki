/**
 * 数据迁移脚本：将现有数据从 "default" 目录迁移到管理员用户目录，
 * 并为 chats 表回填 userId。
 *
 * 用法: npx tsx scripts/migrate-user-directories.ts
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import os from "os";

const RABBITDOCS_HOME =
  process.env.RABBITDOCS_HOME ||
  path.join(os.homedir(), ".rabbitdocs");
const DB_PATH = path.join(RABBITDOCS_HOME, "data.db");
const DATA_ROOT_ARG = process.argv[2]; // 可选: 自定义 data root

function getDataRoot(): string {
  if (DATA_ROOT_ARG) return DATA_ROOT_ARG;
  // 尝试从 storageConfig 读取
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const row = db.prepare("SELECT storage_path FROM storage_config LIMIT 1").get() as { storage_path: string } | undefined;
    db.close();
    if (row?.storage_path) return row.storage_path;
  } catch { /* ignore */ }
  // 回退到本地 ./data 目录
  const localData = path.join(process.cwd(), "data");
  if (fs.existsSync(localData)) return localData;
  return path.join(RABBITDOCS_HOME, "data");
}

function main() {
  console.log("=== ChatWiki 数据迁移: 目录 + userId ===\n");

  const dataRoot = getDataRoot();
  console.log(`Data root: ${dataRoot}`);

  const defaultDir = path.join(dataRoot, "personal", "default");
  if (!fs.existsSync(defaultDir)) {
    console.log("'personal/default' 目录不存在，无需迁移目录。");
  } else {
    // 找到 admin 用户
    let db: Database.Database;
    try {
      db = new Database(DB_PATH);
    } catch {
      console.log("无法打开数据库，跳过 userId 回填。");
      // 仍然尝试目录迁移
      db = null!;
    }

    let adminUserId: string | undefined;
    if (db) {
      const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1").get() as { id: string } | undefined;
      if (admin) {
        adminUserId = admin.id;
        console.log(`Admin user: ${adminUserId}`);
      } else {
        console.log("未找到 admin 用户，尝试用 settings 中的 admin_user_id...");
        const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'admin_user_id' LIMIT 1").get() as { value: string } | undefined;
        if (setting) {
          adminUserId = setting.value;
          console.log(`Admin user (from settings): ${adminUserId}`);
        }
      }

      // 回填 chats.userId
      if (adminUserId) {
        const updated = db.prepare("UPDATE chats SET user_id = ? WHERE user_id IS NULL").run(adminUserId);
        console.log(`\n回填 chats.userId: ${updated.changes} 条记录已更新为 admin ID.`);
      }

      db.close();
    }

    // 迁移目录: personal/default -> personal/{adminUserId}
    if (adminUserId) {
      const targetDir = path.join(dataRoot, "personal", adminUserId);
      if (fs.existsSync(targetDir)) {
        console.log(`\n目标目录 ${targetDir} 已存在，跳过目录迁移。`);
      } else {
        // 确保 personal 目录存在
        fs.mkdirSync(path.join(dataRoot, "personal"), { recursive: true });
        fs.renameSync(defaultDir, targetDir);
        console.log(`\n目录迁移完成: personal/default -> personal/${adminUserId}`);
      }
    } else {
      console.log("\n未找到 admin 用户 ID，跳过目录迁移。");
    }
  }

  console.log("\n=== 迁移完成 ===");
}

main();
