-- Convert BIGINT epoch-ms timestamp columns to TIMESTAMPTZ for core auth tables.
-- Handles both camelCase (production, drizzle-kit DDL) and lowercase (dev, raw SQL DDL).
-- Idempotent: each block guards on data_type = 'bigint'.

DO $$
BEGIN
  -- user: createdAt, updatedAt
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user'
      AND column_name = 'createdAt' AND data_type = 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE "user"
      ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING to_timestamp("createdAt" / 1000.0),
      ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ USING to_timestamp("updatedAt" / 1000.0)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user'
      AND column_name = 'createdat' AND data_type = 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE "user"
      ALTER COLUMN createdat TYPE TIMESTAMPTZ USING to_timestamp(createdat / 1000.0),
      ALTER COLUMN updatedat TYPE TIMESTAMPTZ USING to_timestamp(updatedat / 1000.0)';
  END IF;

  -- user: banExpires
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user'
      AND column_name = 'banExpires' AND data_type = 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE "user"
      ALTER COLUMN "banExpires" TYPE TIMESTAMPTZ USING to_timestamp("banExpires" / 1000.0)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user'
      AND column_name = 'banexpires' AND data_type = 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE "user"
      ALTER COLUMN banexpires TYPE TIMESTAMPTZ USING to_timestamp(banexpires / 1000.0)';
  END IF;

  -- session: expiresAt, createdAt, updatedAt
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'session'
      AND column_name = 'expiresAt' AND data_type = 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE session
      ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ USING to_timestamp("expiresAt" / 1000.0),
      ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING to_timestamp("createdAt" / 1000.0),
      ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ USING to_timestamp("updatedAt" / 1000.0)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'session'
      AND column_name = 'expiresat' AND data_type = 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE session
      ALTER COLUMN expiresat TYPE TIMESTAMPTZ USING to_timestamp(expiresat / 1000.0),
      ALTER COLUMN createdat TYPE TIMESTAMPTZ USING to_timestamp(createdat / 1000.0),
      ALTER COLUMN updatedat TYPE TIMESTAMPTZ USING to_timestamp(updatedat / 1000.0)';
  END IF;

  -- account: createdAt, updatedAt
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'account'
      AND column_name = 'createdAt' AND data_type = 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE account
      ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING to_timestamp("createdAt" / 1000.0),
      ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ USING to_timestamp("updatedAt" / 1000.0)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'account'
      AND column_name = 'createdat' AND data_type = 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE account
      ALTER COLUMN createdat TYPE TIMESTAMPTZ USING to_timestamp(createdat / 1000.0),
      ALTER COLUMN updatedat TYPE TIMESTAMPTZ USING to_timestamp(updatedat / 1000.0)';
  END IF;

  -- account: accessTokenExpiresAt, refreshTokenExpiresAt
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'account'
      AND column_name = 'accessTokenExpiresAt' AND data_type = 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE account
      ALTER COLUMN "accessTokenExpiresAt" TYPE TIMESTAMPTZ USING to_timestamp("accessTokenExpiresAt" / 1000.0),
      ALTER COLUMN "refreshTokenExpiresAt" TYPE TIMESTAMPTZ USING to_timestamp("refreshTokenExpiresAt" / 1000.0)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'account'
      AND column_name = 'accesstokenexpiresat' AND data_type = 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE account
      ALTER COLUMN accesstokenexpiresat TYPE TIMESTAMPTZ USING to_timestamp(accesstokenexpiresat / 1000.0),
      ALTER COLUMN refreshtokenexpiresat TYPE TIMESTAMPTZ USING to_timestamp(refreshtokenexpiresat / 1000.0)';
  END IF;

  -- verification: expiresAt, createdAt, updatedAt
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'verification'
      AND column_name = 'expiresAt' AND data_type = 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE verification
      ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ USING to_timestamp("expiresAt" / 1000.0),
      ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING to_timestamp("createdAt" / 1000.0),
      ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ USING to_timestamp("updatedAt" / 1000.0)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'verification'
      AND column_name = 'expiresat' AND data_type = 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE verification
      ALTER COLUMN expiresat TYPE TIMESTAMPTZ USING to_timestamp(expiresat / 1000.0),
      ALTER COLUMN createdat TYPE TIMESTAMPTZ USING to_timestamp(createdat / 1000.0),
      ALTER COLUMN updatedat TYPE TIMESTAMPTZ USING to_timestamp(updatedat / 1000.0)';
  END IF;

END $$;
