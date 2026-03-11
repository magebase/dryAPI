CREATE TABLE IF NOT EXISTS hot_cold_pointers (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  storage_tier TEXT NOT NULL DEFAULT 'hot',
  hot_payload TEXT,
  r2_key TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  etag TEXT NOT NULL DEFAULT '',
  schema_version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_hot_cold_pointers_storage_tier_updated_at
ON hot_cold_pointers (storage_tier, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_hot_cold_pointers_r2_key
ON hot_cold_pointers (r2_key);

CREATE TABLE IF NOT EXISTS hot_cold_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload TEXT,
  r2_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  available_at INTEGER NOT NULL,
  last_error TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hot_cold_outbox_available_at
ON hot_cold_outbox (available_at ASC);

CREATE INDEX IF NOT EXISTS idx_hot_cold_outbox_entity
ON hot_cold_outbox (entity_type, entity_id);
