CREATE TABLE token_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  model_id INTEGER NOT NULL,
  chat_id INTEGER,
  backend TEXT NOT NULL DEFAULT 'sdk',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_input_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd INTEGER NOT NULL DEFAULT 0,
  context_size INTEGER,
  context_used INTEGER,
  duration_ms INTEGER DEFAULT 0,
  num_turns INTEGER DEFAULT 1,
  project_id TEXT,
  workspace_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_token_usage_user_time ON token_usage_logs(user_id, created_at);
CREATE INDEX idx_token_usage_time ON token_usage_logs(created_at);
