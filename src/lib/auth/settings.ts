import { db } from "@/db";
import { systemSettings, users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Read a system setting by key. Returns null if not found.
 */
export function getSetting(key: string): string | null {
  const row = db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .get();
  return row?.value ?? null;
}

/**
 * Write a system setting. Creates or updates.
 */
export function setSetting(key: string, value: string): void {
  const now = new Date().toISOString();
  const existing = db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .get();

  if (existing) {
    db.update(systemSettings)
      .set({ value, updatedAt: now })
      .where(eq(systemSettings.key, key))
      .run();
  } else {
    db.insert(systemSettings)
      .values({ key, value, updatedAt: now })
      .run();
  }
}

/**
 * Write multiple settings at once.
 */
export function bulkSetSettings(entries: Array<{ key: string; value: string }>): void {
  for (const { key, value } of entries) {
    setSetting(key, value);
  }
}

/**
 * Check if the system has been initialized (admin user created).
 */
export function isInitialized(): boolean {
  return getSetting("admin_user_id") !== null;
}

/**
 * Get the admin user ID. Returns null if not initialized.
 */
export function getAdminUserId(): string | null {
  return getSetting("admin_user_id");
}

/**
 * Check if a user is an admin.
 * First checks the users.role field; falls back to admin_user_id for backward compatibility.
 */
export function isAdmin(userId: string): boolean {
  const row = db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (row) return row.role === "admin";
  // Fallback for users not yet migrated
  return getAdminUserId() === userId;
}

/**
 * Check if registration is open. Defaults to true.
 */
export function isOpenRegistration(): boolean {
  return getSetting("open_registration") !== "false";
}

/**
 * Check if invite codes are required for registration. Defaults to false.
 */
export function isInviteCodeRequired(): boolean {
  return getSetting("require_invite_code") === "true";
}

/**
 * Check if email verification is required for login. Defaults to false.
 */
export function isEmailVerificationRequired(): boolean {
  return getSetting("require_email_verification") === "true";
}

/**
 * Get the general registration key (shared, unlimited-use).
 * Returns null if not set.
 */
export function getGeneralRegistrationKey(): string | null {
  return getSetting("general_registration_key");
}

/**
 * Check whether the supplied value matches the general registration key.
 */
export function isValidGeneralRegistrationKey(value: string | undefined): boolean {
  if (!value) return false;
  const stored = getGeneralRegistrationKey();
  return stored !== null && stored === value;
}

/**
 * Set or clear the general registration key.
 */
export function setGeneralRegistrationKey(key: string | null): void {
  if (key === null) {
    // Clear: store empty marker so we can distinguish "unset" later if needed
    setSetting("general_registration_key", "");
    return;
  }
  setSetting("general_registration_key", key);
}

/**
 * Get the brand name. Defaults to "RabbitDocs".
 */
export function getBrandName(): string {
  return getSetting("brand_name") || "RabbitDocs";
}
