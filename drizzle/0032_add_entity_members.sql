-- Entity members: DB index for fast membership queries
-- Replaces the O(N*M) filesystem scan in findMemberEntityIds()

CREATE TABLE IF NOT EXISTS entity_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  member_id TEXT NOT NULL,
  user_id TEXT,
  account_name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  added_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entity_members_user_type ON entity_members(user_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_members_entity ON entity_members(entity_id, entity_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_members_unique ON entity_members(entity_id, entity_type, member_id);
