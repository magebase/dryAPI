CREATE TABLE IF NOT EXISTS moderation_rejections (
  id TEXT PRIMARY KEY NOT NULL,
  channel TEXT NOT NULL,
  source_path TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  categories TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_moderation_rejections_created_at
ON moderation_rejections (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_rejections_channel_created_at
ON moderation_rejections (channel, created_at DESC);
