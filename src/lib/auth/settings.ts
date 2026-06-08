import { db } from "@/db";
import { systemSettings, users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Read a system setting by key. Returns null if not found.
 */
export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);
  return row?.value ?? null;
}

/**
 * Write a system setting. Creates or updates atomically via upsert.
 */
export async function setSetting(key: string, value: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .insert(systemSettings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value, updatedAt: now },
    });
}

/**
 * Write multiple settings at once.
 */
export async function bulkSetSettings(entries: Array<{ key: string; value: string }>): Promise<void> {
  for (const { key, value } of entries) {
    await setSetting(key, value);
  }
}

/**
 * Check if the system has been initialized (admin user created).
 */
export async function isInitialized(): Promise<boolean> {
  return (await getSetting("admin_user_id")) !== null;
}

/**
 * Get the admin user ID. Returns null if not initialized.
 */
export async function getAdminUserId(): Promise<string | null> {
  return getSetting("admin_user_id");
}

/**
 * Check if a user is an admin.
 * First checks the users.role field; falls back to admin_user_id for backward compatibility.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (row) return row.role === "admin";
  // Fallback for users not yet migrated
  return (await getAdminUserId()) === userId;
}

/**
 * Check if registration is open. Defaults to true.
 */
export async function isOpenRegistration(): Promise<boolean> {
  return (await getSetting("open_registration")) !== "false";
}

/**
 * Check if invite codes are required for registration. Defaults to false.
 */
export async function isInviteCodeRequired(): Promise<boolean> {
  return (await getSetting("require_invite_code")) === "true";
}

/**
 * Check if email verification is required for login. Defaults to false.
 */
export async function isEmailVerificationRequired(): Promise<boolean> {
  return (await getSetting("require_email_verification")) === "true";
}

/**
 * Get the general registration key (shared, unlimited-use).
 * Returns null if not set.
 */
export async function getGeneralRegistrationKey(): Promise<string | null> {
  return getSetting("general_registration_key");
}

/**
 * Check whether the supplied value matches the general registration key.
 */
export async function isValidGeneralRegistrationKey(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const stored = await getGeneralRegistrationKey();
  return stored !== null && stored === value;
}

/**
 * Set or clear the general registration key.
 */
export async function setGeneralRegistrationKey(key: string | null): Promise<void> {
  if (key === null) {
    // Clear: store empty marker so we can distinguish "unset" later if needed
    await setSetting("general_registration_key", "");
    return;
  }
  await setSetting("general_registration_key", key);
}

/**
 * Get the brand name. Defaults to "RabbitDocs".
 */
export async function getBrandName(): Promise<string> {
  return (await getSetting("brand_name")) || "RabbitDocs";
}
