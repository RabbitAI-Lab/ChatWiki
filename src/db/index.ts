import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import * as schema from "./schema";
import fs from "fs";
import os from "os";
import path from "path";

// ── Global singleton to survive HMR hot reloads ──
const globalForDb = globalThis as typeof globalThis & {
  __pgliteClient?: PGlite;
  __pgliteDrizzle?: ReturnType<typeof drizzle<typeof schema>>;
  __pgliteReady?: Promise<void>;
  __pgliteReadyFlag?: boolean;
};

// ── Lazy path computation ──
let _rabbitdocsHome: string | undefined;
function getRabbitdocsHome(): string {
  if (!_rabbitdocsHome) {
    _rabbitdocsHome = process.env.RABBITDOCS_HOME || path.join(os.homedir(), ".rabbitdocs");
  }
  return _rabbitdocsHome;
}

let _dataDir: string | undefined;
function getDataDir(): string {
  if (!_dataDir) {
    _dataDir = path.join(getRabbitdocsHome(), "pgdata");
  }
  return _dataDir;
}

function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/**
 * Eagerly create PGlite + Drizzle instances (both synchronous).
 * The actual PG backend readiness is deferred to initDb().
 */
function ensureInstance(): void {
  if (globalForDb.__pgliteDrizzle) return;
  if (isBuildPhase()) return;

  const dataDir = getDataDir();
  const home = getRabbitdocsHome();

  if (!fs.existsSync(home)) {
    fs.mkdirSync(home, { recursive: true });
  }

  // Clean up stale postmaster.pid left by ungraceful shutdown
  const pidFile = path.join(dataDir, "postmaster.pid");
  if (fs.existsSync(pidFile)) {
    try {
      fs.unlinkSync(pidFile);
      console.log("[db] Cleaned up stale postmaster.pid");
    } catch { /* ignore */ }
  }

  console.log(`[db] Creating PGlite instance at ${dataDir}...`);
  const client = new PGlite(dataDir);
  const drizzleInstance = drizzle(client, { schema });

  globalForDb.__pgliteClient = client;
  globalForDb.__pgliteDrizzle = drizzleInstance;
}

// ── Create instance eagerly at module load time ──
// PGlite constructor is synchronous; waitReady is async and handled in initDb().
// This ensures the Proxy always has a real Drizzle instance to delegate to.
ensureInstance();

/**
 * Initialize the database (called from instrumentation.ts at server startup).
 * Waits for PGlite backend readiness, runs migrations and seed.
 */
export async function initDb(): Promise<void> {
  if (isBuildPhase()) return;
  // Ensure instance exists (may already be created by ensureInstance above)
  ensureInstance();
  // Already fully initialized
  if (globalForDb.__pgliteReadyFlag) return;
  // Already initializing — wait for the same promise
  if (globalForDb.__pgliteReady) return globalForDb.__pgliteReady;

  globalForDb.__pgliteReady = (async () => {
    try {
      const client = globalForDb.__pgliteClient!;

      console.log("[db] Waiting for PGlite backend readiness...");
      await client.waitReady;
      console.log("[db] PGlite backend ready.");

      // Run migrations with fault-tolerant runner
      const migrationsDir = path.join(process.cwd(), "drizzle");
      if (fs.existsSync(migrationsDir)) {
        const journalPath = path.join(migrationsDir, "meta", "_journal.json");
        if (fs.existsSync(journalPath)) {
          await runMigrationsFaultTolerant(client, migrationsDir);
        }
      }

      // ── Ad-hoc schema patches (idempotent, safe for all environments) ──
      try {
        const patches = [
          "ALTER TABLE entities ADD COLUMN IF NOT EXISTS publish_status TEXT",
          "ALTER TABLE todos ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0 NOT NULL",
        ];
        for (const sql of patches) {
          await client.query(sql);
        }
        console.log("[db] Schema patches applied.");
      } catch (err) {
        console.error("[db] Schema patch failed:", err);
      }

      // Run seed
      try {
        const { seed } = await import("./seed");
        await seed();
      } catch (err) {
        console.error("[seed] Error:", err);
      }

      // Reset serial sequences as safety measure (covers edge cases
      // like DB restore, manual edits, or migration oddities)
      try {
        const { resetSerialSequences } = await import("@/lib/db-dump");
        await resetSerialSequences();
      } catch (err) {
        console.error("[db] Sequence reset failed:", err);
      }

      // Initialize data root from DB config
      try {
        const { initDataRootFromDb } = await import("@/lib/fs/core");
        await initDataRootFromDb();
      } catch { /* ok */ }

      globalForDb.__pgliteReadyFlag = true;
      console.log("[db] Database initialized successfully.");
    } catch (err) {
      console.error("[db] Failed to initialize:", err);
      globalForDb.__pgliteReady = undefined;
      throw err;
    }
  })();

  return globalForDb.__pgliteReady;
}

/**
 * The Drizzle DB instance. Always available after module load.
 * During build phase, returns undefined (Turbopack type-checking).
 * At runtime, delegates directly to the real drizzle instance.
 *
 * Note: actual queries will fail until initDb() completes (PGlite
 * backend not ready), but the chain builder API (db.select().from()...)
 * works immediately.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    if (isBuildPhase()) return undefined;
    // Ensure instance exists (safety net for edge cases)
    ensureInstance();
    return Reflect.get(globalForDb.__pgliteDrizzle!, prop, receiver);
  },
});

// ── Graceful shutdown ──
async function shutdown() {
  try {
    if (globalForDb.__pgliteClient) {
      await globalForDb.__pgliteClient.close();
    }
  } catch { /* ok */ }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

/** Get the raw PGlite client for direct SQL queries (e.g., admin dump/restore). */
export function getRawClient(): PGlite {
  if (!globalForDb.__pgliteClient) throw new Error("[db] Database not initialized.");
  return globalForDb.__pgliteClient;
}

/** Database data directory path (for info purposes). */
export { getDataDir as dbPath };

/** PostgreSQL error codes that indicate "already exists" — safe to skip. */
const IGNORABLE_PG_ERROR_CODES = new Set([
  "42P07", // duplicate_table (relation already exists)
  "42701", // duplicate_column (column already exists)
  "42P16", // duplicate_object (e.g. constraint already exists)
  "42710", // duplicate_function
]);

/**
 * Fault-tolerant migration runner.
 *
 * Behaves like Drizzle's built-in migrator but catches ignorable
 * "already exists" errors per-statement instead of aborting
 * the entire migration batch.
 */
async function runMigrationsFaultTolerant(
  client: PGlite,
  migrationsFolder: string,
): Promise<void> {
  const migrationEntries = readMigrationFiles({ migrationsFolder });
  if (migrationEntries.length === 0) return;

  console.log(`[db] Running ${migrationEntries.length} migration(s)...`);

  // Ensure the drizzle migrations tracking table exists
  await client.query(
    `CREATE SCHEMA IF NOT EXISTS drizzle`,
  );
  await client.query(
    `CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )`,
  );

  // Get the latest applied migration timestamp
  const { rows: lastRows } = await client.query<{ created_at: string }>(
    `SELECT created_at FROM drizzle."__drizzle_migrations" ORDER BY created_at DESC LIMIT 1`,
  );
  const lastAppliedAt = lastRows[0] ? Number(lastRows[0].created_at) : -1;

  let applied = 0;
  let skipped = 0;
  let warned = 0;

  for (const entry of migrationEntries) {
    if (entry.folderMillis <= lastAppliedAt) {
      skipped++;
      continue;
    }

    // Run each statement individually with error tolerance
    for (const stmt of entry.sql) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      try {
        await client.query(trimmed);
      } catch (err: unknown) {
        const pgErr = err as { code?: string; severity?: string; message?: string; [k: string]: unknown };
        if (pgErr.code && IGNORABLE_PG_ERROR_CODES.has(pgErr.code)) {
          console.warn(
            `[db] Migration warning (ignored): [${pgErr.code}] ${pgErr.message?.slice(0, 120)}`,
          );
          warned++;
        } else {
          throw err;
        }
      }
    }

    // Record the migration as applied
    await client.query(
      `INSERT INTO drizzle."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)`,
      [entry.hash, entry.folderMillis],
    );
    applied++;
  }

  console.log(
    `[db] Migrations done: ${applied} applied, ${skipped} skipped, ${warned} warnings.`,
  );
}
