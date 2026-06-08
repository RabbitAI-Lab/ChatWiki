-- Phase 4: User management - add disabled flag for soft-delete
-- 0 = active, 1 = disabled (cannot login)

ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;
