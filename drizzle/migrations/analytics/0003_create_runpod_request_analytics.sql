CREATE TABLE IF NOT EXISTS runpod_request_analytics (
  job_id TEXT PRIMARY KEY NOT NULL,
  surface TEXT NOT NULL,
  endpoint_id TEXT NOT NULL,
  model_slug TEXT,
  status TEXT NOT NULL,
  worker_type TEXT,
  price_key TEXT,
  bandit_arm_id TEXT,
  pricing_source TEXT,
  revenue_usd REAL NOT NULL DEFAULT 0,
  provider_cost_usd REAL NOT NULL DEFAULT 0,
  gross_profit_usd REAL NOT NULL DEFAULT 0,
  gross_margin REAL NOT NULL DEFAULT 0,
  execution_seconds REAL NOT NULL DEFAULT 0,
  queue_seconds REAL NOT NULL DEFAULT 0,
  billed_runtime_seconds REAL NOT NULL DEFAULT 0,
  effective_unit_cost_usd REAL NOT NULL DEFAULT 0,
  min_price_usd REAL NOT NULL DEFAULT 0,
  recommended_price_usd REAL NOT NULL DEFAULT 0,
  min_profit_multiple REAL NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runpod_request_analytics_created_at
ON runpod_request_analytics (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_runpod_request_analytics_surface_created_at
ON runpod_request_analytics (surface, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_runpod_request_analytics_price_key_created_at
ON runpod_request_analytics (price_key, created_at DESC);