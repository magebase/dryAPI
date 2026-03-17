ALTER TABLE user ADD COLUMN normalizedEmail TEXT;
ALTER TABLE user ADD COLUMN role TEXT DEFAULT 'user';
ALTER TABLE user ADD COLUMN banned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user ADD COLUMN banReason TEXT;
ALTER TABLE user ADD COLUMN banExpires INTEGER;
ALTER TABLE user ADD COLUMN twoFactorEnabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user ADD COLUMN stripeCustomerId TEXT;
ALTER TABLE user ADD COLUMN lastLoginMethod TEXT;

ALTER TABLE session ADD COLUMN impersonatedBy TEXT;
ALTER TABLE session ADD COLUMN activeOrganizationId TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_user_normalized_email
ON user (normalizedEmail);

CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_user_stripe_customer_id
ON user (stripeCustomerId);

CREATE INDEX IF NOT EXISTS idx_better_auth_session_active_org_id
ON session (activeOrganizationId);

CREATE TABLE IF NOT EXISTS twoFactor (
  id TEXT PRIMARY KEY NOT NULL,
  secret TEXT NOT NULL,
  backupCodes TEXT NOT NULL,
  userId TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_better_auth_two_factor_user_id
ON twoFactor (userId);

CREATE INDEX IF NOT EXISTS idx_better_auth_two_factor_secret
ON twoFactor (secret);

CREATE TABLE IF NOT EXISTS organization (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  logo TEXT,
  metadata TEXT,
  stripeCustomerId TEXT,
  createdAt INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_organization_slug
ON organization (slug);

CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_organization_stripe_customer_id
ON organization (stripeCustomerId);

CREATE INDEX IF NOT EXISTS idx_better_auth_organization_name
ON organization (name);

CREATE TABLE IF NOT EXISTS member (
  id TEXT PRIMARY KEY NOT NULL,
  organizationId TEXT NOT NULL,
  userId TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (organizationId) REFERENCES organization(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_better_auth_member_organization_id
ON member (organizationId);

CREATE INDEX IF NOT EXISTS idx_better_auth_member_user_id
ON member (userId);

CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_member_org_user
ON member (organizationId, userId);

CREATE TABLE IF NOT EXISTS invitation (
  id TEXT PRIMARY KEY NOT NULL,
  organizationId TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expiresAt INTEGER NOT NULL,
  inviterId TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (organizationId) REFERENCES organization(id) ON DELETE CASCADE,
  FOREIGN KEY (inviterId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_better_auth_invitation_organization_id
ON invitation (organizationId);

CREATE INDEX IF NOT EXISTS idx_better_auth_invitation_email
ON invitation (email);

CREATE TABLE IF NOT EXISTS apikey (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  start TEXT,
  prefix TEXT,
  key TEXT NOT NULL,
  userId TEXT,
  organizationId TEXT,
  refillInterval INTEGER,
  refillAmount INTEGER,
  lastRefillAt INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  rateLimitEnabled INTEGER NOT NULL DEFAULT 1,
  rateLimitTimeWindow INTEGER NOT NULL DEFAULT 86400,
  rateLimitMax INTEGER NOT NULL DEFAULT 10,
  requestCount INTEGER NOT NULL DEFAULT 0,
  remaining INTEGER,
  lastRequest INTEGER,
  expiresAt INTEGER,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  permissions TEXT,
  metadata TEXT,
  configId TEXT NOT NULL DEFAULT 'default',
  referenceId TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_apikey_key
ON apikey (key);

CREATE INDEX IF NOT EXISTS idx_better_auth_apikey_config_id
ON apikey (configId);

CREATE INDEX IF NOT EXISTS idx_better_auth_apikey_reference_id
ON apikey (referenceId);

CREATE INDEX IF NOT EXISTS idx_better_auth_apikey_expires_at
ON apikey (expiresAt);

CREATE TABLE IF NOT EXISTS ssoProvider (
  id TEXT PRIMARY KEY NOT NULL,
  issuer TEXT NOT NULL,
  oidcConfig TEXT,
  samlConfig TEXT,
  userId TEXT,
  providerId TEXT NOT NULL,
  organizationId TEXT,
  domain TEXT NOT NULL,
  domainVerified INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE SET NULL,
  FOREIGN KEY (organizationId) REFERENCES organization(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_sso_provider_id
ON ssoProvider (providerId);

CREATE INDEX IF NOT EXISTS idx_better_auth_sso_domain
ON ssoProvider (domain);

CREATE INDEX IF NOT EXISTS idx_better_auth_sso_organization_id
ON ssoProvider (organizationId);

CREATE TABLE IF NOT EXISTS subscription (
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
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_better_auth_subscription_reference_id
ON subscription (referenceId);

CREATE INDEX IF NOT EXISTS idx_better_auth_subscription_customer_id
ON subscription (stripeCustomerId);

CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_subscription_stripe_subscription_id
ON subscription (stripeSubscriptionId);

CREATE INDEX IF NOT EXISTS idx_better_auth_subscription_status
ON subscription (status);