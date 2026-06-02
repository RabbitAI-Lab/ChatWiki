import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import fs from "fs";
import path from "path";

const DB_PATH = "./data.db";
const WAL_PATH = DB_PATH + "-wal";
const SHM_PATH = DB_PATH + "-shm";
const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

// ── Run all migrations ──
function runMigrations(db: Database.Database) {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith(".sql"))
    .sort();
  
  console.log(`[db] Running ${files.length} migrations...`);
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    db.exec(sql);
    console.log(`[db]   ✓ ${file}`);
  }
}

function checkIntegrity(db: Database.Database): boolean {
  try {
    const result = db.pragma("integrity_check") as Array<{ integrity_check: string }>;
    return result.length === 1 && result[0].integrity_check === "ok";
  } catch {
    return false;
  }
}

function tryApplyPragmas(db: Database.Database): boolean {
  try {
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    return true;
  } catch {
    return false;
  }
}

// ── Initialize database ──
function initDatabase(): Database.Database {
  const db = new Database(DB_PATH);

  if (tryApplyPragmas(db) && checkIntegrity(db)) {
    // Ensure new migrations are applied to existing databases
    // Run each migration file individually so that one failure doesn't block others
    try {
      const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith(".sql"))
        .sort();
      for (const file of migrationFiles) {
        try {
          const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
          // Split by semicolons and run each statement individually
          const statements = sql.split(";").map(s => s.trim()).filter(s => s.length > 0);
          for (const stmt of statements) {
            try {
              db.exec(stmt);
            } catch {
              // Individual statement may fail if table/index already exists — that's ok
            }
          }
        } catch {
          // File read error — skip
        }
      }
    } catch { /* directory read error */ }
    console.log("[db] Integrity check passed.");
    return db;
  }

  console.warn("[db] Integrity check FAILED, recreating database...");
  db.close();

  // Delete all DB files
  for (const p of [DB_PATH, WAL_PATH, SHM_PATH]) {
    try { fs.unlinkSync(p); } catch { /* ok */ }
  }

  // Recreate
  const newDb = new Database(DB_PATH);
  newDb.pragma("journal_mode = WAL");
  newDb.pragma("foreign_keys = ON");

  runMigrations(newDb);
  
  console.log("[db] Database recreated successfully.");
  return newDb;
}

const sqlite = initDatabase();

export const db = drizzle(sqlite, { schema });

// ── Run seed after drizzle is created (dynamic import to avoid circular dependency) ──
import("./seed").then(({ seed }) => seed()).catch((err) => console.error("[seed] Error:", err));

// ── Graceful shutdown ──
function shutdown() {
  try {
    sqlite.pragma("wal_checkpoint(TRUNCATE)");
    sqlite.close();
  } catch { /* ok */ }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
