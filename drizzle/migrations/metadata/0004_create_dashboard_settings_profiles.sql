CREATE TABLE IF NOT EXISTS dashboard_settings_profiles (
  user_email TEXT PRIMARY KEY NOT NULL,
  general_json TEXT NOT NULL DEFAULT '{}',
  security_json TEXT NOT NULL DEFAULT '{}',
  webhooks_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dashboard_settings_profiles_updated_at
ON dashboard_settings_profiles (updated_at DESC);
