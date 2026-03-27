-- Convert Better Auth organization tables from BIGINT epoch-ms to TIMESTAMPTZ.
-- This keeps the app schema aligned with the Date values Better Auth inserts.

DO $$
BEGIN
  -- organization: createdAt
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization'
      AND column_name = 'createdAt' AND data_type = 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE organization
      ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING to_timestamp("createdAt" / 1000.0)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization'
      AND column_name = 'createdat' AND data_type = 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE organization
      ALTER COLUMN createdat TYPE TIMESTAMPTZ USING to_timestamp(createdat / 1000.0)';
  END IF;

  -- member: createdAt
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'member'
      AND column_name = 'createdAt' AND data_type = 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE member
      ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING to_timestamp("createdAt" / 1000.0)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'member'
      AND column_name = 'createdat' AND data_type = 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE member
      ALTER COLUMN createdat TYPE TIMESTAMPTZ USING to_timestamp(createdat / 1000.0)';
  END IF;

  -- invitation: expiresAt, createdAt
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invitation'
      AND column_name = 'expiresAt' AND data_type = 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE invitation
      ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ USING to_timestamp("expiresAt" / 1000.0),
      ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING to_timestamp("createdAt" / 1000.0)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invitation'
      AND column_name = 'expiresat' AND data_type = 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE invitation
      ALTER COLUMN expiresat TYPE TIMESTAMPTZ USING to_timestamp(expiresat / 1000.0),
      ALTER COLUMN createdat TYPE TIMESTAMPTZ USING to_timestamp(createdat / 1000.0)';
  END IF;
END $$;