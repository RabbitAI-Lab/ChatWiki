import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

const MAX_KEYS_PER_USER = 5;

/**
 * Create a new API key for a user. Returns the full key (only shown once).
 */
export async function createApiKey(
  userId: string,
  name?: string
): Promise<{ id: string; key: string; prefix: string }> {
  // 检查非系统 key 数量
  const existing = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));

  const nonSystemCount = existing.filter((k) => k.isSystem !== true).length;
  if (nonSystemCount >= MAX_KEYS_PER_USER) {
    throw new Error(`Maximum ${MAX_KEYS_PER_USER} API keys allowed`);
  }

  const key = `atm_${crypto.randomUUID().replace(/-/g, "")}`;
  const prefix = key.slice(0, 8);
  const now = new Date().toISOString();

  await db.insert(apiKeys)
    .values({
      id: crypto.randomUUID(),
      name: name || "API Key",
      keyField: key,
      prefix,
      userId,
      isSystem: false,
      createdAt: now,
    });

  return { id: "", key, prefix };
}

/**
 * Create a system API key for MCP authentication. Not deletable by users.
 */
export async function createSystemKey(userId: string): Promise<{ id: string; key: string; prefix: string }> {
  const key = `atm_${crypto.randomUUID().replace(/-/g, "")}`;
  const prefix = key.slice(0, 8);
  const now = new Date().toISOString();

  await db.insert(apiKeys)
    .values({
      id: crypto.randomUUID(),
      name: "System Key (MCP)",
      keyField: key,
      prefix,
      userId,
      isSystem: true,
      createdAt: now,
    });

  return { id: "", key, prefix };
}

/**
 * Validate an API key. Returns user ID and key info, or null if invalid.
 */
export async function validateApiKey(
  plainKey: string
): Promise<{ userId: string; id: string; name: string | null } | null> {
  if (!plainKey.startsWith("atm_")) return null;

  const [row] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyField, plainKey))
    .limit(1);

  if (!row) return null;

  return {
    userId: row.userId,
    id: row.id,
    name: row.name,
  };
}

/**
 * Delete an API key. System keys cannot be deleted.
 */
export async function deleteApiKey(id: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.id, id))
    .limit(1);

  if (!row || row.userId !== userId || row.isSystem === true) {
    return false;
  }

  await db.delete(apiKeys).where(eq(apiKeys.id, id));
  return true;
}

/**
 * Get the system API key for a user. Returns the full row or null.
 */
export async function getSystemKey(userId: string) {
  const [row] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isSystem, true)))
    .limit(1);
  return row ?? null;
}

/**
 * Regenerate the system API key for a user: delete old → create new.
 * Returns the new key info (full key shown only once).
 */
export async function regenerateSystemKey(userId: string): Promise<{ key: string; prefix: string; createdAt: string }> {
  // Delete existing system key
  await db.delete(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isSystem, true)));

  // Create new system key
  const key = `atm_${crypto.randomUUID().replace(/-/g, "")}`;
  const prefix = key.slice(0, 8);
  const now = new Date().toISOString();

  await db.insert(apiKeys)
    .values({
      id: crypto.randomUUID(),
      name: "System Key (MCP)",
      keyField: key,
      prefix,
      userId,
      isSystem: true,
      createdAt: now,
    });

  return { key, prefix, createdAt: now };
}

/**
 * List all API keys for a user. Key values are masked.
 */
export async function listApiKeys(userId: string) {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      isSystem: apiKeys.isSystem,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));
}
