CREATE TABLE IF NOT EXISTS dashboard_api_keys (
  key_id TEXT PRIMARY KEY NOT NULL,
  user_email TEXT NOT NULL,
  name TEXT,
  key_start TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  permissions_json TEXT NOT NULL DEFAULT '[]',
  roles_json TEXT NOT NULL DEFAULT '[]',
  meta_json TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_dashboard_api_keys_user_email
ON dashboard_api_keys (user_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dashboard_api_keys_enabled
ON dashboard_api_keys (enabled, expires_at);
