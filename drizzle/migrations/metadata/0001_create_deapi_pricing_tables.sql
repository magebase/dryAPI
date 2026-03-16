CREATE TABLE IF NOT EXISTS deapi_pricing_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  source TEXT NOT NULL,
  synced_at INTEGER NOT NULL,
  source_urls_json TEXT NOT NULL DEFAULT '[]',
  categories_json TEXT NOT NULL DEFAULT '[]',
  models_json TEXT NOT NULL DEFAULT '[]',
  total_permutations INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deapi_pricing_snapshots_synced_at
ON deapi_pricing_snapshots (synced_at DESC);

CREATE TABLE IF NOT EXISTS deapi_pricing_permutations (
  id TEXT PRIMARY KEY NOT NULL,
  snapshot_id TEXT NOT NULL,
  category TEXT NOT NULL,
  source_url TEXT NOT NULL,
  model TEXT NOT NULL,
  model_label TEXT NOT NULL DEFAULT '',
  params_json TEXT NOT NULL DEFAULT '{}',
  price_text TEXT NOT NULL DEFAULT '',
  price_usd REAL,
  credits REAL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  excerpts_json TEXT NOT NULL DEFAULT '[]',
  descriptions_json TEXT NOT NULL DEFAULT '[]',
  scraped_at TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (snapshot_id) REFERENCES deapi_pricing_snapshots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deapi_pricing_permutations_snapshot
ON deapi_pricing_permutations (snapshot_id);

CREATE INDEX IF NOT EXISTS idx_deapi_pricing_permutations_category_model
ON deapi_pricing_permutations (category, model);
