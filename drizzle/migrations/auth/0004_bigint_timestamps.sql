-- Migrate all timestamp/epoch-ms columns from INTEGER to BIGINT across auth tables.
-- The previous schema used INTEGER which overflows for millisecond Unix timestamps > ~2.1B.
--
-- Handles both camelCase-named columns (production, created via drizzle-kit quoted DDL)
-- and lowercase-named columns (dev DBs created via unquoted migration SQL).
-- Each block uses EXECUTE and data_type guards so it is idempotent and safe to re-run.

DO $$
BEGIN

  -- ── user ─────────────────────────────────────────────────────────────────
  -- timestamp: createdAt / createdat
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user' AND column_name='createdAt' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE "user" ALTER COLUMN "createdAt" TYPE BIGINT USING "createdAt"::bigint, ALTER COLUMN "updatedAt" TYPE BIGINT USING "updatedAt"::bigint';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user' AND column_name='createdat' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE "user" ALTER COLUMN createdat TYPE BIGINT USING createdat::bigint, ALTER COLUMN updatedat TYPE BIGINT USING updatedat::bigint';
  END IF;
  -- banExpires / banexpires
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user' AND column_name='banExpires' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE "user" ALTER COLUMN "banExpires" TYPE BIGINT USING "banExpires"::bigint';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user' AND column_name='banexpires' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE "user" ALTER COLUMN banexpires TYPE BIGINT USING banexpires::bigint';
  END IF;
  -- boolean columns: emailVerified, banned, twoFactorEnabled
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user' AND column_name='emailVerified' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE "user" ALTER COLUMN "emailVerified" DROP DEFAULT, ALTER COLUMN "emailVerified" TYPE BOOLEAN USING CASE WHEN "emailVerified" = 0 THEN FALSE ELSE TRUE END, ALTER COLUMN "emailVerified" SET DEFAULT FALSE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user' AND column_name='emailverified' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE "user" ALTER COLUMN emailverified DROP DEFAULT, ALTER COLUMN emailverified TYPE BOOLEAN USING CASE WHEN emailverified = 0 THEN FALSE ELSE TRUE END, ALTER COLUMN emailverified SET DEFAULT FALSE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user' AND column_name='banned' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE "user" ALTER COLUMN banned DROP DEFAULT, ALTER COLUMN banned TYPE BOOLEAN USING CASE WHEN banned = 0 THEN FALSE ELSE TRUE END, ALTER COLUMN banned SET DEFAULT FALSE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user' AND column_name='twoFactorEnabled' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE "user" ALTER COLUMN "twoFactorEnabled" DROP DEFAULT, ALTER COLUMN "twoFactorEnabled" TYPE BOOLEAN USING CASE WHEN "twoFactorEnabled" = 0 THEN FALSE ELSE TRUE END, ALTER COLUMN "twoFactorEnabled" SET DEFAULT FALSE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user' AND column_name='twofactorenabled' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE "user" ALTER COLUMN twofactorenabled DROP DEFAULT, ALTER COLUMN twofactorenabled TYPE BOOLEAN USING CASE WHEN twofactorenabled = 0 THEN FALSE ELSE TRUE END, ALTER COLUMN twofactorenabled SET DEFAULT FALSE';
  END IF;

  -- ── session ───────────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='session' AND column_name='expiresAt' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE session ALTER COLUMN "expiresAt" TYPE BIGINT USING "expiresAt"::bigint, ALTER COLUMN "createdAt" TYPE BIGINT USING "createdAt"::bigint, ALTER COLUMN "updatedAt" TYPE BIGINT USING "updatedAt"::bigint';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='session' AND column_name='expiresat' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE session ALTER COLUMN expiresat TYPE BIGINT USING expiresat::bigint, ALTER COLUMN createdat TYPE BIGINT USING createdat::bigint, ALTER COLUMN updatedat TYPE BIGINT USING updatedat::bigint';
  END IF;

  -- ── account ───────────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='account' AND column_name='createdAt' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE account ALTER COLUMN "createdAt" TYPE BIGINT USING "createdAt"::bigint, ALTER COLUMN "updatedAt" TYPE BIGINT USING "updatedAt"::bigint';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='account' AND column_name='createdat' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE account ALTER COLUMN createdat TYPE BIGINT USING createdat::bigint, ALTER COLUMN updatedat TYPE BIGINT USING updatedat::bigint';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='account' AND column_name='accessTokenExpiresAt' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE account ALTER COLUMN "accessTokenExpiresAt" TYPE BIGINT USING "accessTokenExpiresAt"::bigint, ALTER COLUMN "refreshTokenExpiresAt" TYPE BIGINT USING "refreshTokenExpiresAt"::bigint';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='account' AND column_name='accesstokenexpiresat' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE account ALTER COLUMN accesstokenexpiresat TYPE BIGINT USING accesstokenexpiresat::bigint, ALTER COLUMN refreshtokenexpiresat TYPE BIGINT USING refreshtokenexpiresat::bigint';
  END IF;

  -- ── verification ──────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verification' AND column_name='expiresAt' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE verification ALTER COLUMN "expiresAt" TYPE BIGINT USING "expiresAt"::bigint, ALTER COLUMN "createdAt" TYPE BIGINT USING "createdAt"::bigint, ALTER COLUMN "updatedAt" TYPE BIGINT USING "updatedAt"::bigint';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='verification' AND column_name='expiresat' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE verification ALTER COLUMN expiresat TYPE BIGINT USING expiresat::bigint, ALTER COLUMN createdat TYPE BIGINT USING createdat::bigint, ALTER COLUMN updatedat TYPE BIGINT USING updatedat::bigint';
  END IF;

  -- ── organization ──────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organization' AND column_name='createdAt' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE organization ALTER COLUMN "createdAt" TYPE BIGINT USING "createdAt"::bigint';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organization' AND column_name='createdat' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE organization ALTER COLUMN createdat TYPE BIGINT USING createdat::bigint';
  END IF;

  -- ── member ────────────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='member' AND column_name='createdAt' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE member ALTER COLUMN "createdAt" TYPE BIGINT USING "createdAt"::bigint';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='member' AND column_name='createdat' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE member ALTER COLUMN createdat TYPE BIGINT USING createdat::bigint';
  END IF;

  -- ── invitation ────────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='invitation' AND column_name='expiresAt' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE invitation ALTER COLUMN "expiresAt" TYPE BIGINT USING "expiresAt"::bigint, ALTER COLUMN "createdAt" TYPE BIGINT USING "createdAt"::bigint';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='invitation' AND column_name='expiresat' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE invitation ALTER COLUMN expiresat TYPE BIGINT USING expiresat::bigint, ALTER COLUMN createdat TYPE BIGINT USING createdat::bigint';
  END IF;

  -- ── apikey ────────────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='apikey' AND column_name='createdAt' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE apikey ALTER COLUMN "createdAt" TYPE BIGINT USING "createdAt"::bigint, ALTER COLUMN "updatedAt" TYPE BIGINT USING "updatedAt"::bigint, ALTER COLUMN "expiresAt" TYPE BIGINT USING "expiresAt"::bigint, ALTER COLUMN "lastRefillAt" TYPE BIGINT USING "lastRefillAt"::bigint, ALTER COLUMN "lastRequest" TYPE BIGINT USING "lastRequest"::bigint';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='apikey' AND column_name='createdat' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE apikey ALTER COLUMN createdat TYPE BIGINT USING createdat::bigint, ALTER COLUMN updatedat TYPE BIGINT USING updatedat::bigint, ALTER COLUMN expiresat TYPE BIGINT USING expiresat::bigint, ALTER COLUMN lastrefillat TYPE BIGINT USING lastrefillat::bigint, ALTER COLUMN lastrequest TYPE BIGINT USING lastrequest::bigint';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='apikey' AND column_name='enabled' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE apikey ALTER COLUMN enabled DROP DEFAULT, ALTER COLUMN enabled TYPE BOOLEAN USING CASE WHEN enabled = 0 THEN FALSE ELSE TRUE END, ALTER COLUMN enabled SET DEFAULT TRUE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='apikey' AND column_name='rateLimitEnabled' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE apikey ALTER COLUMN "rateLimitEnabled" DROP DEFAULT, ALTER COLUMN "rateLimitEnabled" TYPE BOOLEAN USING CASE WHEN "rateLimitEnabled" = 0 THEN FALSE ELSE TRUE END, ALTER COLUMN "rateLimitEnabled" SET DEFAULT TRUE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='apikey' AND column_name='ratelimitenabled' AND data_type='integer') THEN
    EXECUTE 'ALTER TABLE apikey ALTER COLUMN ratelimitenabled DROP DEFAULT, ALTER COLUMN ratelimitenabled TYPE BOOLEAN USING CASE WHEN ratelimitenabled = 0 THEN FALSE ELSE TRUE END, ALTER COLUMN ratelimitenabled SET DEFAULT TRUE';
  END IF;

END $$;
