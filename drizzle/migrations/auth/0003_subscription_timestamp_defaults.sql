PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

CREATE TABLE subscription_new (
  id TEXT PRIMARY KEY NOT NULL,
  plan TEXT NOT NULL,
  referenceId TEXT NOT NULL,
  stripeCustomerId TEXT,
  stripeSubscriptionId TEXT,
  status TEXT NOT NULL DEFAULT 'incomplete',
  periodStart INTEGER,
  periodEnd INTEGER,
  trialStart INTEGER,
  trialEnd INTEGER,
  cancelAtPeriodEnd INTEGER NOT NULL DEFAULT 0,
  cancelAt INTEGER,
  canceledAt INTEGER,
  endedAt INTEGER,
  seats INTEGER,
  billingInterval TEXT,
  stripeScheduleId TEXT,
  limits TEXT,
  createdAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000),
  updatedAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

INSERT INTO subscription_new (
  id,
  plan,
  referenceId,
  stripeCustomerId,
  stripeSubscriptionId,
  status,
  periodStart,
  periodEnd,
  trialStart,
  trialEnd,
  cancelAtPeriodEnd,
  cancelAt,
  canceledAt,
  endedAt,
  seats,
  billingInterval,
  stripeScheduleId,
  limits,
  createdAt,
  updatedAt
)
SELECT
  id,
  plan,
  referenceId,
  stripeCustomerId,
  stripeSubscriptionId,
  status,
  periodStart,
  periodEnd,
  trialStart,
  trialEnd,
  cancelAtPeriodEnd,
  cancelAt,
  canceledAt,
  endedAt,
  seats,
  billingInterval,
  stripeScheduleId,
  limits,
  COALESCE(createdAt, CAST(strftime('%s', 'now') AS INTEGER) * 1000),
  COALESCE(updatedAt, CAST(strftime('%s', 'now') AS INTEGER) * 1000)
FROM subscription;

DROP TABLE subscription;
ALTER TABLE subscription_new RENAME TO subscription;

CREATE INDEX IF NOT EXISTS idx_better_auth_subscription_reference_id
ON subscription (referenceId);

CREATE INDEX IF NOT EXISTS idx_better_auth_subscription_customer_id
ON subscription (stripeCustomerId);

CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_subscription_stripe_subscription_id
ON subscription (stripeSubscriptionId);

CREATE INDEX IF NOT EXISTS idx_better_auth_subscription_status
ON subscription (status);

COMMIT;

PRAGMA foreign_keys = ON;