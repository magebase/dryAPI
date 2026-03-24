ALTER TABLE subscription
  ALTER COLUMN createdat TYPE BIGINT USING createdat::bigint,
  ALTER COLUMN updatedat TYPE BIGINT USING updatedat::bigint,
  ALTER COLUMN createdat SET DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint,
  ALTER COLUMN updatedat SET DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint;

CREATE INDEX IF NOT EXISTS idx_better_auth_subscription_reference_id
ON subscription (referenceId);

CREATE INDEX IF NOT EXISTS idx_better_auth_subscription_customer_id
ON subscription (stripeCustomerId);

CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_subscription_stripe_subscription_id
ON subscription (stripeSubscriptionId);

CREATE INDEX IF NOT EXISTS idx_better_auth_subscription_status
ON subscription (status);