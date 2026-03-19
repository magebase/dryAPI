import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"

import { resolveConfiguredBalance } from "@/lib/configured-balance"
import { D1_BINDING_PRIORITY, resolveD1Binding } from "@/lib/d1-bindings"

type D1PreparedResult<T> = {
  results: T[]
}

type D1RunResult = {
  meta?: {
    changes?: number
  }
}

type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement
  all: <T>() => Promise<D1PreparedResult<T>>
  run: () => Promise<D1RunResult>
}

type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatement
}

type CreditBalanceRow = {
  balance_credits: number
  updated_at: number
}

type CreditBalanceProfileRow = {
  customer_ref: string
  balance_credits: number | string | null
  updated_at: number | string | null
  auto_top_up_enabled: number | string | null
  auto_top_up_threshold_credits: number | string | null
  auto_top_up_amount_credits: number | string | null
  auto_top_up_monthly_cap_credits: number | string | null
  auto_top_up_monthly_spent_credits: number | string | null
  auto_top_up_monthly_window_start_at: number | string | null
}

type D1TableInfoRow = {
  name: string
}

type CreditDepositAggregateRow = {
  lifetime_deposited_credits: number | string | null
}

type SaasMonthlyTokenBucketRow = {
  bucket_id: string
  customer_ref: string
  plan_slug: string
  cycle_start_at: number
  cycle_expire_at: number
  tokens_granted: number
  tokens_remaining: number
  updated_at: number
}

type StripeCheckoutSessionPayload = {
  id?: string
  mode?: string
  status?: string
  payment_status?: string
  customer_email?: string | null
  customer_details?: {
    email?: string | null
  } | null
  metadata?: Record<string, unknown> | null
}

export type CreditBalanceSnapshot = {
  balanceCredits: number
  updatedAt: string | null
}

export type StoredSubscriptionCreditsSnapshot = {
  subscriptionCredits: number
  topUpCredits: number
}

export type BillingSafeguardSnapshot = {
  minimumTopUpCredits: number
  blockingThresholdCredits: number
  maximumNegativeCredits: number
}

export type AutoTopUpSettingsSnapshot = {
  enabled: boolean
  thresholdCredits: number
  amountCredits: number
  monthlyCapCredits: number
  monthlySpentCredits: number
  monthlyWindowStartAt: string | null
}

export const BILLING_SAFEGUARDS: BillingSafeguardSnapshot = {
  minimumTopUpCredits: 10,
  blockingThresholdCredits: 0,
  maximumNegativeCredits: -100,
}

export type SaasMonthlyTokenBucketSnapshot = {
  bucketId: string
  customerRef: string
  planSlug: string
  cycleStartAt: string | null
  cycleExpireAt: string | null
  tokensGranted: number
  tokensRemaining: number
  updatedAt: string | null
}

const CREATE_BALANCE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS credit_balance_profiles (
  customer_ref TEXT PRIMARY KEY NOT NULL,
  balance_credits REAL NOT NULL DEFAULT 0,
  auto_top_up_enabled INTEGER NOT NULL DEFAULT 1,
  auto_top_up_threshold_credits REAL NOT NULL DEFAULT 5,
  auto_top_up_amount_credits REAL NOT NULL DEFAULT 25,
  auto_top_up_monthly_cap_credits REAL NOT NULL DEFAULT 250,
  auto_top_up_monthly_spent_credits REAL NOT NULL DEFAULT 0,
  auto_top_up_monthly_window_start_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
)
`

const CREATE_EVENTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS billing_credit_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  customer_ref TEXT NOT NULL,
  credits_delta REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'stripe_checkout',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
)
`

const CREATE_SAAS_BUCKETS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS saas_monthly_token_buckets (
  bucket_id TEXT PRIMARY KEY NOT NULL,
  customer_ref TEXT NOT NULL,
  plan_slug TEXT NOT NULL,
  cycle_start_at INTEGER NOT NULL,
  cycle_expire_at INTEGER NOT NULL,
  tokens_granted INTEGER NOT NULL DEFAULT 0,
  tokens_remaining INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
)
`

function sanitizeCustomerRef(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (normalized.length < 3 || !normalized.includes("@")) {
    throw new Error("A valid customer ref is required")
  }

  return normalized
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function toIsoFromMs(value: number | null | undefined): string | null {
  if (!value || !Number.isFinite(value)) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

async function resolveBillingDb(): Promise<D1DatabaseLike | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    return resolveD1Binding<D1DatabaseLike>(env as Record<string, unknown>, D1_BINDING_PRIORITY.billing)
  } catch {
    return null
  }
}

async function ensureBillingTables(db: D1DatabaseLike): Promise<void> {
  await db.prepare(CREATE_BALANCE_TABLE_SQL).run()
  await db.prepare(CREATE_EVENTS_TABLE_SQL).run()
  await db.prepare(CREATE_SAAS_BUCKETS_TABLE_SQL).run()
  await ensureBalanceProfileColumns(db)
}

async function listTableColumnNames(db: D1DatabaseLike, tableName: string): Promise<Set<string>> {
  const response = await db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all<D1TableInfoRow>()

  return new Set(response.results.map((row) => row.name))
}

async function ensureBalanceProfileColumns(db: D1DatabaseLike): Promise<void> {
  const columns = await listTableColumnNames(db, "credit_balance_profiles")

  const statements: string[] = []

  if (!columns.has("auto_top_up_amount_credits")) {
    statements.push("ALTER TABLE credit_balance_profiles ADD COLUMN auto_top_up_amount_credits REAL NOT NULL DEFAULT 25")
  }

  if (!columns.has("auto_top_up_monthly_cap_credits")) {
    statements.push("ALTER TABLE credit_balance_profiles ADD COLUMN auto_top_up_monthly_cap_credits REAL NOT NULL DEFAULT 250")
  }

  if (!columns.has("auto_top_up_monthly_spent_credits")) {
    statements.push("ALTER TABLE credit_balance_profiles ADD COLUMN auto_top_up_monthly_spent_credits REAL NOT NULL DEFAULT 0")
  }

  if (!columns.has("auto_top_up_monthly_window_start_at")) {
    statements.push("ALTER TABLE credit_balance_profiles ADD COLUMN auto_top_up_monthly_window_start_at INTEGER NOT NULL DEFAULT 0")
  }

  for (const statement of statements) {
    await db.prepare(statement).run()
  }
}

async function selectBalanceRow(db: D1DatabaseLike, customerRef: string): Promise<CreditBalanceRow | null> {
  const response = await db
    .prepare(
      `
      SELECT balance_credits, updated_at
      FROM credit_balance_profiles
      WHERE customer_ref = ?
      LIMIT 1
      `,
    )
    .bind(customerRef)
    .all<CreditBalanceRow>()

  return response.results[0] ?? null
}

async function selectBalanceProfileRow(
  db: D1DatabaseLike,
  customerRef: string,
): Promise<CreditBalanceProfileRow | null> {
  const response = await db
    .prepare(
      `
      SELECT customer_ref, balance_credits, updated_at,
             auto_top_up_enabled,
             auto_top_up_threshold_credits,
             auto_top_up_amount_credits,
             auto_top_up_monthly_cap_credits,
             auto_top_up_monthly_spent_credits,
             auto_top_up_monthly_window_start_at
      FROM credit_balance_profiles
      WHERE customer_ref = ?
      LIMIT 1
      `,
    )
    .bind(customerRef)
    .all<CreditBalanceProfileRow>()

  return response.results[0] ?? null
}

function toBooleanInteger(value: boolean): number {
  return value ? 1 : 0
}

function toSafeCredits(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Number(Math.max(0, value).toFixed(3))
}

function resolveCurrentMonthWindowStartAtMs(referenceMs = Date.now()): number {
  const now = new Date(referenceMs)
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
}

function toAutoTopUpSettingsSnapshot(row: CreditBalanceProfileRow): AutoTopUpSettingsSnapshot {
  const enabledRaw = toFiniteNumber(row.auto_top_up_enabled)
  const thresholdCredits = toSafeCredits(
    toFiniteNumber(row.auto_top_up_threshold_credits) ?? 0,
    BILLING_SAFEGUARDS.blockingThresholdCredits,
  )
  const amountCredits = toSafeCredits(
    toFiniteNumber(row.auto_top_up_amount_credits) ?? 25,
    25,
  )
  const monthlyCapCredits = toSafeCredits(
    toFiniteNumber(row.auto_top_up_monthly_cap_credits) ?? 250,
    250,
  )
  const monthlySpentCredits = toSafeCredits(
    toFiniteNumber(row.auto_top_up_monthly_spent_credits) ?? 0,
    0,
  )
  const monthlyWindowStartAt = toIsoFromMs(toFiniteNumber(row.auto_top_up_monthly_window_start_at))

  return {
    enabled: enabledRaw === null ? true : enabledRaw !== 0,
    thresholdCredits,
    amountCredits,
    monthlyCapCredits,
    monthlySpentCredits,
    monthlyWindowStartAt,
  }
}

async function upsertBalanceRow(
  db: D1DatabaseLike,
  input: {
    customerRef: string
    balanceCredits: number
    updatedAtMs: number
  },
): Promise<void> {
  await db
    .prepare(
      `
      INSERT INTO credit_balance_profiles (
        customer_ref,
        balance_credits,
        auto_top_up_enabled,
        auto_top_up_threshold_credits,
        updated_at
      ) VALUES (?, ?, 1, 5, ?)
      ON CONFLICT(customer_ref) DO UPDATE SET
        balance_credits = excluded.balance_credits,
        updated_at = excluded.updated_at
      `,
    )
    .bind(input.customerRef, input.balanceCredits, input.updatedAtMs)
    .run()
}

export async function getStoredCreditBalance(
  customerRef: string,
  options?: { db?: D1DatabaseLike | null },
): Promise<CreditBalanceSnapshot | null> {
  const normalizedCustomerRef = sanitizeCustomerRef(customerRef)
  const db = options?.db ?? (await resolveBillingDb())
  if (!db) {
    return null
  }

  await ensureBillingTables(db)

  const row = await selectBalanceRow(db, normalizedCustomerRef)
  if (!row) {
    return null
  }

  return {
    balanceCredits: Number((toFiniteNumber(row.balance_credits) ?? 0).toFixed(3)),
    updatedAt: toIsoFromMs(toFiniteNumber(row.updated_at)),
  }
}

export async function getStoredAutoTopUpSettings(
  customerRef: string,
  options?: { db?: D1DatabaseLike | null },
): Promise<AutoTopUpSettingsSnapshot | null> {
  const normalizedCustomerRef = sanitizeCustomerRef(customerRef)
  const db = options?.db ?? (await resolveBillingDb())
  if (!db) {
    return null
  }

  await ensureBillingTables(db)

  const row = await selectBalanceProfileRow(db, normalizedCustomerRef)
  if (!row) {
    return null
  }

  return toAutoTopUpSettingsSnapshot(row)
}

export async function updateStoredAutoTopUpSettings(
  input: {
    customerRef: string
    enabled: boolean
    thresholdCredits: number
    amountCredits: number
    monthlyCapCredits: number
  },
  options?: { db?: D1DatabaseLike | null },
): Promise<AutoTopUpSettingsSnapshot | null> {
  const normalizedCustomerRef = sanitizeCustomerRef(input.customerRef)
  const db = options?.db ?? (await resolveBillingDb())
  if (!db) {
    return null
  }

  await ensureBillingTables(db)

  const now = Date.now()
  const currentWindowStartAtMs = resolveCurrentMonthWindowStartAtMs(now)
  const current = await selectBalanceProfileRow(db, normalizedCustomerRef)
  const existingWindowStartAtMs = toFiniteNumber(current?.auto_top_up_monthly_window_start_at) ?? 0
  const monthlySpentCredits =
    existingWindowStartAtMs === currentWindowStartAtMs
      ? toSafeCredits(toFiniteNumber(current?.auto_top_up_monthly_spent_credits) ?? 0, 0)
      : 0

  const currentBalanceCredits = toFiniteNumber(current?.balance_credits) ?? resolveConfiguredBalance()

  await db
    .prepare(
      `
      INSERT INTO credit_balance_profiles (
        customer_ref,
        balance_credits,
        auto_top_up_enabled,
        auto_top_up_threshold_credits,
        auto_top_up_amount_credits,
        auto_top_up_monthly_cap_credits,
        auto_top_up_monthly_spent_credits,
        auto_top_up_monthly_window_start_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(customer_ref) DO UPDATE SET
        auto_top_up_enabled = excluded.auto_top_up_enabled,
        auto_top_up_threshold_credits = excluded.auto_top_up_threshold_credits,
        auto_top_up_amount_credits = excluded.auto_top_up_amount_credits,
        auto_top_up_monthly_cap_credits = excluded.auto_top_up_monthly_cap_credits,
        auto_top_up_monthly_spent_credits = excluded.auto_top_up_monthly_spent_credits,
        auto_top_up_monthly_window_start_at = excluded.auto_top_up_monthly_window_start_at,
        updated_at = excluded.updated_at
      `,
    )
    .bind(
      normalizedCustomerRef,
      Number(currentBalanceCredits.toFixed(3)),
      toBooleanInteger(input.enabled),
      toSafeCredits(input.thresholdCredits, BILLING_SAFEGUARDS.blockingThresholdCredits),
      toSafeCredits(input.amountCredits, 25),
      toSafeCredits(input.monthlyCapCredits, 250),
      monthlySpentCredits,
      currentWindowStartAtMs,
      now,
    )
    .run()

  const updated = await selectBalanceProfileRow(db, normalizedCustomerRef)
  if (!updated) {
    return null
  }

  return toAutoTopUpSettingsSnapshot(updated)
}

export async function incrementStoredAutoTopUpMonthlySpent(
  input: {
    customerRef: string
    spentDeltaCredits: number
  },
  options?: { db?: D1DatabaseLike | null },
): Promise<AutoTopUpSettingsSnapshot | null> {
  const normalizedCustomerRef = sanitizeCustomerRef(input.customerRef)
  const db = options?.db ?? (await resolveBillingDb())
  if (!db) {
    return null
  }

  await ensureBillingTables(db)

  const profile = await selectBalanceProfileRow(db, normalizedCustomerRef)
  if (!profile) {
    return null
  }

  const now = Date.now()
  const currentWindowStartAtMs = resolveCurrentMonthWindowStartAtMs(now)
  const existingWindowStartAtMs = toFiniteNumber(profile.auto_top_up_monthly_window_start_at) ?? 0
  const existingSpent =
    existingWindowStartAtMs === currentWindowStartAtMs
      ? toSafeCredits(toFiniteNumber(profile.auto_top_up_monthly_spent_credits) ?? 0, 0)
      : 0

  const nextSpent = toSafeCredits(existingSpent + Math.max(0, input.spentDeltaCredits), existingSpent)

  await db
    .prepare(
      `
      UPDATE credit_balance_profiles
      SET auto_top_up_monthly_spent_credits = ?,
          auto_top_up_monthly_window_start_at = ?,
          updated_at = ?
      WHERE customer_ref = ?
      `,
    )
    .bind(nextSpent, currentWindowStartAtMs, now, normalizedCustomerRef)
    .run()

  const updated = await selectBalanceProfileRow(db, normalizedCustomerRef)
  if (!updated) {
    return null
  }

  return toAutoTopUpSettingsSnapshot(updated)
}

export async function getLifetimeDepositedCredits(
  customerRef: string,
  options?: { db?: D1DatabaseLike | null },
): Promise<number | null> {
  const normalizedCustomerRef = sanitizeCustomerRef(customerRef)
  const db = options?.db ?? (await resolveBillingDb())
  if (!db) {
    return null
  }

  await ensureBillingTables(db)

  const response = await db
    .prepare(
      `
      SELECT COALESCE(SUM(CASE WHEN credits_delta > 0 THEN credits_delta ELSE 0 END), 0) AS lifetime_deposited_credits
      FROM billing_credit_events
      WHERE customer_ref = ?
      `,
    )
    .bind(normalizedCustomerRef)
    .all<CreditDepositAggregateRow>()

  const lifetimeDepositedCredits = toFiniteNumber(response.results[0]?.lifetime_deposited_credits)
  if (lifetimeDepositedCredits === null) {
    return 0
  }

  return Number(Math.max(0, lifetimeDepositedCredits).toFixed(3))
}

export async function getStoredSubscriptionCredits(
  customerRef: string,
  options?: { db?: D1DatabaseLike | null },
): Promise<StoredSubscriptionCreditsSnapshot | null> {
  const normalizedCustomerRef = sanitizeCustomerRef(customerRef)
  const db = options?.db ?? (await resolveBillingDb())
  if (!db) {
    return null
  }

  await ensureBillingTables(db)

  const balanceRow = await selectBalanceRow(db, normalizedCustomerRef)
  if (!balanceRow) {
    return null
  }

  const totalBalance = Number((toFiniteNumber(balanceRow.balance_credits) ?? 0).toFixed(3))

  // Sum all subscription cycle grants for this user.
  // Note: source for subscription grants is 'dryapi-dashboard-subscription'
  const response = await db
    .prepare(
      `
      SELECT COALESCE(SUM(credits_delta), 0) AS total_subscription_grants
      FROM billing_credit_events
      WHERE customer_ref = ? AND source = 'dryapi-dashboard-subscription'
      `,
    )
    .bind(normalizedCustomerRef)
    .all<{ total_subscription_grants: number | string | null }>()

  const totalSubscriptionGrants = toFiniteNumber(response.results[0]?.total_subscription_grants) ?? 0

  // We treat subscription credits as "first out" (already handled by total balance reduction)
  // but for the UI split, we'll assume subscription credits remain until they are exhausted by the total balance.
  // This is a naive split: subscriptionCredits = min(totalBalance, totalSubscriptionGrants)
  // topUpCredits = totalBalance - subscriptionCredits
  const subscriptionCredits = Number(Math.min(totalBalance, totalSubscriptionGrants).toFixed(3))
  const topUpCredits = Number(Math.max(0, totalBalance - subscriptionCredits).toFixed(3))

  return {
    subscriptionCredits,
    topUpCredits,
  }
}

async function recordCreditEventAndApplyDelta(
  input: {
    customerRef: string
    eventId: string
    creditsDelta: number
    source: string
    metadata: Record<string, unknown>
    initialBalanceCredits: number
  },
  options?: { db?: D1DatabaseLike | null },
): Promise<{ applied: boolean; balance: CreditBalanceSnapshot | null }> {
  const normalizedCustomerRef = sanitizeCustomerRef(input.customerRef)
  const db = options?.db ?? (await resolveBillingDb())
  if (!db) {
    return { applied: false, balance: null }
  }

  await ensureBillingTables(db)

  const now = Date.now()
  const eventInsert = await db
    .prepare(
      `
      INSERT OR IGNORE INTO billing_credit_events (
        event_id,
        customer_ref,
        credits_delta,
        source,
        metadata_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      input.eventId,
      normalizedCustomerRef,
      Number(input.creditsDelta.toFixed(3)),
      input.source,
      JSON.stringify(input.metadata),
      now,
    )
    .run()

  const wasInserted = Number(eventInsert?.meta?.changes ?? 0) > 0
  if (wasInserted) {
    const currentBalance = await selectBalanceRow(db, normalizedCustomerRef)
    const previous = currentBalance?.balance_credits ?? input.initialBalanceCredits
    const nextBalance = Number((previous + input.creditsDelta).toFixed(3))

    await upsertBalanceRow(db, {
      customerRef: normalizedCustomerRef,
      balanceCredits: nextBalance,
      updatedAtMs: now,
    })
  }

  const stored = await getStoredCreditBalance(normalizedCustomerRef, { db })
  return {
    applied: wasInserted,
    balance: stored,
  }
}

export async function applyBillingCreditGrant(
  input: {
    customerRef: string
    eventId: string
    creditsDelta: number
    source: string
    metadata: Record<string, unknown>
    initialBalanceCredits?: number
  },
  options?: { db?: D1DatabaseLike | null },
): Promise<{ applied: boolean; balance: CreditBalanceSnapshot | null }> {
  return recordCreditEventAndApplyDelta(
    {
      customerRef: input.customerRef,
      eventId: input.eventId,
      creditsDelta: input.creditsDelta,
      source: input.source,
      metadata: input.metadata,
      initialBalanceCredits: input.initialBalanceCredits ?? resolveConfiguredBalance(),
    },
    options,
  )
}

export async function upsertSaasMonthlyTokenBucket(
  input: {
    bucketId: string
    customerRef: string
    planSlug: string
    cycleStartAtMs: number
    cycleExpireAtMs: number
    tokensGranted: number
  },
  options?: { db?: D1DatabaseLike | null },
): Promise<SaasMonthlyTokenBucketSnapshot | null> {
  const normalizedCustomerRef = sanitizeCustomerRef(input.customerRef)
  const db = options?.db ?? (await resolveBillingDb())
  if (!db) {
    return null
  }

  await ensureBillingTables(db)

  const now = Date.now()
  const tokensGranted = Math.max(0, Math.round(input.tokensGranted))

  await db
    .prepare(
      `
      INSERT INTO saas_monthly_token_buckets (
        bucket_id,
        customer_ref,
        plan_slug,
        cycle_start_at,
        cycle_expire_at,
        tokens_granted,
        tokens_remaining,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(bucket_id) DO UPDATE SET
        customer_ref = excluded.customer_ref,
        plan_slug = excluded.plan_slug,
        cycle_start_at = excluded.cycle_start_at,
        cycle_expire_at = excluded.cycle_expire_at,
        tokens_granted = excluded.tokens_granted,
        tokens_remaining = CASE
          WHEN saas_monthly_token_buckets.tokens_remaining > excluded.tokens_granted THEN excluded.tokens_granted
          ELSE saas_monthly_token_buckets.tokens_remaining
        END,
        updated_at = excluded.updated_at
      `,
    )
    .bind(
      input.bucketId,
      normalizedCustomerRef,
      input.planSlug,
      input.cycleStartAtMs,
      input.cycleExpireAtMs,
      tokensGranted,
      tokensGranted,
      now,
    )
    .run()

  const response = await db
    .prepare(
      `
      SELECT bucket_id, customer_ref, plan_slug, cycle_start_at, cycle_expire_at,
             tokens_granted, tokens_remaining, updated_at
      FROM saas_monthly_token_buckets
      WHERE bucket_id = ?
      LIMIT 1
      `,
    )
    .bind(input.bucketId)
    .all<SaasMonthlyTokenBucketRow>()

  const row = response.results[0]
  if (!row) {
    return null
  }

  return {
    bucketId: row.bucket_id,
    customerRef: row.customer_ref,
    planSlug: row.plan_slug,
    cycleStartAt: toIsoFromMs(toFiniteNumber(row.cycle_start_at)),
    cycleExpireAt: toIsoFromMs(toFiniteNumber(row.cycle_expire_at)),
    tokensGranted: Math.max(0, Math.round(toFiniteNumber(row.tokens_granted) ?? 0)),
    tokensRemaining: Math.max(0, Math.round(toFiniteNumber(row.tokens_remaining) ?? 0)),
    updatedAt: toIsoFromMs(toFiniteNumber(row.updated_at)),
  }
}

export async function ensureSaasSubscriptionCycleBenefits(
  input: {
    customerRef: string
    subscriptionId: string
    planSlug: string
    cycleStartIso: string
    cycleExpireIso: string
    creditsGranted: number
    monthlyTokensGranted: number
    source: string
    metadata: Record<string, unknown>
    initialBalanceCredits?: number
  },
  options?: { db?: D1DatabaseLike | null },
): Promise<{
  appliedCredits: boolean
  balance: CreditBalanceSnapshot | null
  bucket: SaasMonthlyTokenBucketSnapshot | null
}> {
  const cycleStartAtMs = new Date(input.cycleStartIso).getTime()
  const cycleExpireAtMs = new Date(input.cycleExpireIso).getTime()

  if (Number.isNaN(cycleStartAtMs) || Number.isNaN(cycleExpireAtMs)) {
    throw new Error("Valid cycle timestamps are required")
  }

  const grantResult = input.creditsGranted > 0
    ? await applyBillingCreditGrant(
        {
          customerRef: input.customerRef,
          eventId: `subscription_cycle:${input.subscriptionId}:${input.cycleStartIso}`,
          creditsDelta: Number(input.creditsGranted.toFixed(3)),
          source: input.source,
          metadata: input.metadata,
          initialBalanceCredits: input.initialBalanceCredits,
        },
        options,
      )
    : { applied: false, balance: await getStoredCreditBalance(input.customerRef, options) }

  const bucket = input.monthlyTokensGranted > 0
    ? await upsertSaasMonthlyTokenBucket(
        {
          bucketId: `subscription_cycle:${input.subscriptionId}:${input.cycleStartIso}`,
          customerRef: input.customerRef,
          planSlug: input.planSlug,
          cycleStartAtMs,
          cycleExpireAtMs,
          tokensGranted: input.monthlyTokensGranted,
        },
        options,
      )
    : null

  return {
    appliedCredits: grantResult.applied,
    balance: grantResult.balance,
    bucket,
  }
}

function readCheckoutEmail(payload: StripeCheckoutSessionPayload): string | null {
  const direct = payload.customer_email?.trim()
  if (direct) {
    return direct.toLowerCase()
  }

  const nested = payload.customer_details?.email?.trim()
  if (nested) {
    return nested.toLowerCase()
  }

  return null
}

function readCheckoutCreditsGranted(metadata: Record<string, unknown> | null | undefined): number | null {
  if (!metadata || typeof metadata !== "object") {
    return null
  }

  const raw = metadata.creditsGranted
  const parsed = toFiniteNumber(raw)
  if (parsed === null || parsed <= 0) {
    return null
  }

  return Number(parsed.toFixed(3))
}

function normalizeStripeCheckoutSessionId(value: string): string {
  const normalized = value.trim()
  if (!normalized.startsWith("cs_")) {
    throw new Error("Invalid Stripe checkout session id")
  }

  return normalized
}

export async function syncDashboardTopUpFromStripeCheckout(input: {
  checkoutSessionId: string
  customerEmail: string
  stripePrivateKey: string
  initialBalanceCredits?: number
  db?: D1DatabaseLike | null
}): Promise<{ applied: boolean; balance: CreditBalanceSnapshot | null; reason?: string }> {
  const stripePrivateKey = input.stripePrivateKey.trim()
  if (!stripePrivateKey) {
    return {
      applied: false,
      balance: null,
      reason: "stripe_not_configured",
    }
  }

  const normalizedCustomerRef = sanitizeCustomerRef(input.customerEmail)
  const checkoutSessionId = normalizeStripeCheckoutSessionId(input.checkoutSessionId)

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(checkoutSessionId)}`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${stripePrivateKey}`,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    return {
      applied: false,
      balance: null,
      reason: "stripe_session_fetch_failed",
    }
  }

  const payload = (await response.json().catch(() => null)) as StripeCheckoutSessionPayload | null
  if (!payload) {
    return {
      applied: false,
      balance: null,
      reason: "stripe_session_payload_invalid",
    }
  }

  if (payload.mode !== "payment") {
    return {
      applied: false,
      balance: null,
      reason: "stripe_session_not_payment",
    }
  }

  if (payload.payment_status !== "paid") {
    return {
      applied: false,
      balance: null,
      reason: "stripe_session_not_paid",
    }
  }

  const metadata = payload.metadata || {}
  const source = typeof metadata.source === "string" ? metadata.source.trim() : ""
  if (source !== "dryapi-dashboard-top-up") {
    return {
      applied: false,
      balance: null,
      reason: "stripe_session_not_top_up",
    }
  }

  const checkoutEmail = readCheckoutEmail(payload)
  if (checkoutEmail && checkoutEmail !== normalizedCustomerRef) {
    return {
      applied: false,
      balance: null,
      reason: "stripe_session_customer_mismatch",
    }
  }

  const creditsDelta = readCheckoutCreditsGranted(metadata)
  if (creditsDelta === null) {
    return {
      applied: false,
      balance: null,
      reason: "stripe_session_missing_credits",
    }
  }

  const eventResult = await recordCreditEventAndApplyDelta(
    {
      customerRef: normalizedCustomerRef,
      eventId: `stripe_checkout_session:${checkoutSessionId}`,
      creditsDelta,
      source,
      metadata,
      initialBalanceCredits: input.initialBalanceCredits ?? resolveConfiguredBalance(),
    },
    { db: input.db },
  )

  return {
    applied: eventResult.applied,
    balance: eventResult.balance,
  }
}