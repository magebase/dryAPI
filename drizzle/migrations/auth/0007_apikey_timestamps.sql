-- Convert Better Auth API key timestamps from BIGINT epoch-ms to TIMESTAMPTZ.
-- Better Auth's api-key plugin models these fields as Date values.

DO $$
BEGIN
  -- apikey: lastRefillAt, lastRequest, expiresAt, createdAt, updatedAt
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'apikey'
      AND column_name = 'createdAt' AND data_type = 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE apikey
      ALTER COLUMN "lastRefillAt" TYPE TIMESTAMPTZ USING to_timestamp("lastRefillAt" / 1000.0),
      ALTER COLUMN "lastRequest" TYPE TIMESTAMPTZ USING to_timestamp("lastRequest" / 1000.0),
      ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ USING to_timestamp("expiresAt" / 1000.0),
      ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING to_timestamp("createdAt" / 1000.0),
      ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ USING to_timestamp("updatedAt" / 1000.0)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'apikey'
      AND column_name = 'createdat' AND data_type = 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE apikey
      ALTER COLUMN lastrefillat TYPE TIMESTAMPTZ USING to_timestamp(lastrefillat / 1000.0),
      ALTER COLUMN lastrequest TYPE TIMESTAMPTZ USING to_timestamp(lastrequest / 1000.0),
      ALTER COLUMN expiresat TYPE TIMESTAMPTZ USING to_timestamp(expiresat / 1000.0),
      ALTER COLUMN createdat TYPE TIMESTAMPTZ USING to_timestamp(createdat / 1000.0),
      ALTER COLUMN updatedat TYPE TIMESTAMPTZ USING to_timestamp(updatedat / 1000.0)';
  END IF;
END $$;