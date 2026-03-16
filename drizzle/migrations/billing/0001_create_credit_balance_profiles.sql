CREATE TABLE IF NOT EXISTS credit_balance_profiles (
  customer_ref TEXT PRIMARY KEY NOT NULL,
  balance_credits REAL NOT NULL DEFAULT 0,
  auto_top_up_enabled INTEGER NOT NULL DEFAULT 1,
  auto_top_up_threshold_credits REAL NOT NULL DEFAULT 5,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_balance_profiles_updated_at
ON credit_balance_profiles (updated_at DESC);
