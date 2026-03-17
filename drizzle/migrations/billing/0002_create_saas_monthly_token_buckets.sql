CREATE TABLE IF NOT EXISTS saas_monthly_token_buckets (
  bucket_id TEXT PRIMARY KEY NOT NULL,
  customer_ref TEXT NOT NULL,
  plan_slug TEXT NOT NULL,
  cycle_start_at INTEGER NOT NULL,
  cycle_expire_at INTEGER NOT NULL,
  tokens_granted INTEGER NOT NULL DEFAULT 0,
  tokens_remaining INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_monthly_token_buckets_customer_ref
ON saas_monthly_token_buckets (customer_ref);

CREATE INDEX IF NOT EXISTS idx_saas_monthly_token_buckets_cycle_expire_at
ON saas_monthly_token_buckets (cycle_expire_at);
