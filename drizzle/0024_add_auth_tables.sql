-- Phase 0: Authentication tables

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  account_type TEXT NOT NULL DEFAULT 'personal',
  enterprise_id TEXT,
  positions TEXT,
  satoken_login_id TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE invite_codes (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_by_id TEXT REFERENCES users(id),
  used_by_id TEXT UNIQUE REFERENCES users(id),
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE email_verifications (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE passkeys (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  sign_count INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  device_name TEXT,
  aaguid TEXT,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE TABLE cli_authorization_codes (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE cli_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL DEFAULT 'CLI Token',
  token TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  key_field TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_passkeys_user_id ON passkeys(user_id);
CREATE INDEX idx_cli_tokens_user_id ON cli_tokens(user_id);
CREATE INDEX idx_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_invite_codes_created_by_id ON invite_codes(created_by_id);
