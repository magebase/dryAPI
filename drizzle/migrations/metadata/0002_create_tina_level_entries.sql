CREATE TABLE IF NOT EXISTS tina_level_entries (
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (namespace, key)
);

CREATE INDEX IF NOT EXISTS idx_tina_level_entries_namespace_updated_at
ON tina_level_entries (namespace, updated_at DESC);
