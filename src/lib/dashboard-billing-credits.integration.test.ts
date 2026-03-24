// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const resolveConfiguredBalanceMock = vi.fn()
const getSqlDbAsyncMock = vi.fn()

vi.mock("@/lib/configured-balance", () => ({
  resolveConfiguredBalance: (...args: unknown[]) => resolveConfiguredBalanceMock(...args),
}))

vi.mock("@/lib/cloudflare-db", () => ({
  HYPERDRIVE_BINDING_PRIORITY: ["HYPERDRIVE"],
  createCloudflareDbAccessors: () => ({
    getSqlDbAsync: (...args: unknown[]) => getSqlDbAsyncMock(...args),
  }),
}))

import {
  applyBillingCreditGrant,
  ensureSaasSubscriptionCycleBenefits,
  getLifetimeDepositedCredits,
  getStoredAutoTopUpSettings,
  getStoredCreditBalance,
  getStoredSubscriptionCredits,
  incrementStoredAutoTopUpMonthlySpent,
  syncDashboardTopUpFromStripeCheckout,
  updateStoredAutoTopUpSettings,
  upsertSaasMonthlyTokenBucket,
} from "@/lib/dashboard-billing-credits"

type ProfileRow = {
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

type CreditEventRow = {
  event_id: string
  customer_ref: string
  credits_delta: number
  source: string
  metadata_json: string
  created_at: number
}

type BucketRow = {
  bucket_id: string
  customer_ref: string
  plan_slug: string
  cycle_start_at: number
  cycle_expire_at: number
  tokens_granted: number
  tokens_remaining: number
  updated_at: number
}

type FakeState = {
  profileColumns: Set<string>
  profiles: Map<string, ProfileRow>
  events: Map<string, CreditEventRow>
  buckets: Map<string, BucketRow>
}

const FULL_PROFILE_COLUMNS = [
  "customer_ref",
  "balance_credits",
  "auto_top_up_enabled",
  "auto_top_up_threshold_credits",
  "auto_top_up_amount_credits",
  "auto_top_up_monthly_cap_credits",
  "auto_top_up_monthly_spent_credits",
  "auto_top_up_monthly_window_start_at",
  "updated_at",
] as const

type TestPreparedResult<T> = {
  results: T[]
}

type TestPreparedStatement = {
  bind: (...values: unknown[]) => TestPreparedStatement
  run: () => Promise<{ meta?: { changes?: number } }>
  all: <T>() => Promise<TestPreparedResult<T>>
}

type TestD1DatabaseLike = {
  prepare: (query: string) => TestPreparedStatement
  batch: (statements: TestPreparedStatement[]) => Promise<unknown[]>
}

async function runBatch(statements: TestPreparedStatement[]): Promise<unknown[]> {
  return Promise.all(statements.map((statement) => statement.run()))
}

function createState(): FakeState {
  return {
    profileColumns: new Set(FULL_PROFILE_COLUMNS),
    profiles: new Map(),
    events: new Map(),
    buckets: new Map(),
  }
}

function makeDefaultProfile(customerRef: string): ProfileRow {
  return {
    customer_ref: customerRef,
    balance_credits: 0,
    updated_at: 0,
    auto_top_up_enabled: 1,
    auto_top_up_threshold_credits: 5,
    auto_top_up_amount_credits: 25,
    auto_top_up_monthly_cap_credits: 250,
    auto_top_up_monthly_spent_credits: 0,
    auto_top_up_monthly_window_start_at: 0,
  }
}

function seedProfile(state: FakeState, overrides: Partial<ProfileRow> & Pick<ProfileRow, "customer_ref">) {
  state.profiles.set(overrides.customer_ref, {
    ...makeDefaultProfile(overrides.customer_ref),
    ...overrides,
  })
}

function setLegacyProfileSchema(state: FakeState) {
  state.profileColumns = new Set([
    "customer_ref",
    "balance_credits",
    "auto_top_up_enabled",
    "auto_top_up_threshold_credits",
    "updated_at",
  ])
}

function currentWindowStartMs(referenceIso: string) {
  const reference = new Date(referenceIso)
  return Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1, 0, 0, 0, 0)
}

function stubNow(referenceIso: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(referenceIso))
}

class FakePreparedStatement {
  constructor(
    private readonly state: FakeState,
    private readonly query: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...values: unknown[]): FakePreparedStatement {
    return new FakePreparedStatement(this.state, this.query, values)
  }

  async run(): Promise<{ meta?: { changes?: number } }> {
    const query = this.query.toLowerCase().replace(/\s+/g, " ").trim()

    if (query.includes("create table if not exists credit_balance_profiles")) {
      return { meta: { changes: 0 } }
    }

    if (query.includes("create table if not exists billing_credit_events")) {
      return { meta: { changes: 0 } }
    }

    if (query.includes("create table if not exists saas_monthly_token_buckets")) {
      return { meta: { changes: 0 } }
    }

    if (query.includes("alter table credit_balance_profiles add column auto_top_up_amount_credits")) {
      this.state.profileColumns.add("auto_top_up_amount_credits")
      for (const profile of this.state.profiles.values()) {
        if (profile.auto_top_up_amount_credits === undefined) {
          profile.auto_top_up_amount_credits = 25
        }
      }
      return { meta: { changes: 1 } }
    }

    if (query.includes("alter table credit_balance_profiles add column auto_top_up_monthly_cap_credits")) {
      this.state.profileColumns.add("auto_top_up_monthly_cap_credits")
      for (const profile of this.state.profiles.values()) {
        if (profile.auto_top_up_monthly_cap_credits === undefined) {
          profile.auto_top_up_monthly_cap_credits = 250
        }
      }
      return { meta: { changes: 1 } }
    }

    if (query.includes("alter table credit_balance_profiles add column auto_top_up_monthly_spent_credits")) {
      this.state.profileColumns.add("auto_top_up_monthly_spent_credits")
      for (const profile of this.state.profiles.values()) {
        if (profile.auto_top_up_monthly_spent_credits === undefined) {
          profile.auto_top_up_monthly_spent_credits = 0
        }
      }
      return { meta: { changes: 1 } }
    }

    if (query.includes("alter table credit_balance_profiles add column auto_top_up_monthly_window_start_at")) {
      this.state.profileColumns.add("auto_top_up_monthly_window_start_at")
      for (const profile of this.state.profiles.values()) {
        if (profile.auto_top_up_monthly_window_start_at === undefined) {
          profile.auto_top_up_monthly_window_start_at = 0
        }
      }
      return { meta: { changes: 1 } }
    }

    if (query.includes("insert into credit_balance_profiles (") && query.includes("auto_top_up_amount_credits")) {
      const [customerRef, balance, enabled, threshold, amount, cap, spent, windowStart, updatedAt] = this.params
      const existing = this.state.profiles.get(String(customerRef)) ?? makeDefaultProfile(String(customerRef))
      this.state.profiles.set(String(customerRef), {
        ...existing,
        customer_ref: String(customerRef),
        balance_credits: balance as number,
        auto_top_up_enabled: enabled as number,
        auto_top_up_threshold_credits: threshold as number,
        auto_top_up_amount_credits: amount as number,
        auto_top_up_monthly_cap_credits: cap as number,
        auto_top_up_monthly_spent_credits: spent as number,
        auto_top_up_monthly_window_start_at: windowStart as number,
        updated_at: updatedAt as number,
      })
      return { meta: { changes: 1 } }
    }

    if (query.includes("insert into credit_balance_profiles (") && query.includes("balance_credits") && !query.includes("auto_top_up_amount_credits")) {
      const [customerRef, balance, updatedAt] = this.params
      const existing = this.state.profiles.get(String(customerRef)) ?? makeDefaultProfile(String(customerRef))
      this.state.profiles.set(String(customerRef), {
        ...existing,
        customer_ref: String(customerRef),
        balance_credits: balance as number,
        updated_at: updatedAt as number,
      })
      return { meta: { changes: 1 } }
    }

    if (query.includes("update credit_balance_profiles set auto_top_up_monthly_spent_credits")) {
      const [spent, windowStart, updatedAt, customerRef] = this.params
      const existing = this.state.profiles.get(String(customerRef))
      if (!existing) {
        return { meta: { changes: 0 } }
      }
      existing.auto_top_up_monthly_spent_credits = spent as number
      existing.auto_top_up_monthly_window_start_at = windowStart as number
      existing.updated_at = updatedAt as number
      return { meta: { changes: 1 } }
    }

    if (query.includes("insert or ignore into billing_credit_events")) {
      const [eventId, customerRef, creditsDelta, source, metadataJson, createdAt] = this.params
      if (this.state.events.has(String(eventId))) {
        return { meta: { changes: 0 } }
      }
      this.state.events.set(String(eventId), {
        event_id: String(eventId),
        customer_ref: String(customerRef),
        credits_delta: Number(creditsDelta),
        source: String(source),
        metadata_json: String(metadataJson),
        created_at: Number(createdAt),
      })
      return { meta: { changes: 1 } }
    }

    if (query.includes("insert into saas_monthly_token_buckets")) {
      const [bucketId, customerRef, planSlug, cycleStartAt, cycleExpireAt, tokensGranted, tokensRemaining, updatedAt] = this.params
      const existing = this.state.buckets.get(String(bucketId))

      if (!existing) {
        this.state.buckets.set(String(bucketId), {
          bucket_id: String(bucketId),
          customer_ref: String(customerRef),
          plan_slug: String(planSlug),
          cycle_start_at: Number(cycleStartAt),
          cycle_expire_at: Number(cycleExpireAt),
          tokens_granted: Number(tokensGranted),
          tokens_remaining: Number(tokensRemaining),
          updated_at: Number(updatedAt),
        })
        return { meta: { changes: 1 } }
      }

      existing.customer_ref = String(customerRef)
      existing.plan_slug = String(planSlug)
      existing.cycle_start_at = Number(cycleStartAt)
      existing.cycle_expire_at = Number(cycleExpireAt)
      existing.tokens_granted = Number(tokensGranted)
      existing.tokens_remaining =
        existing.tokens_remaining > Number(tokensGranted)
          ? Number(tokensGranted)
          : existing.tokens_remaining
      existing.updated_at = Number(updatedAt)

      return { meta: { changes: 1 } }
    }

    throw new Error(`Unhandled run query: ${this.query}`)
  }

  async all<T>(): Promise<TestPreparedResult<T>> {
    const query = this.query.toLowerCase().replace(/\s+/g, " ").trim()

    if (query.startsWith("select column_name as name from information_schema.columns")) {
      return {
        results: Array.from(this.state.profileColumns).map((name) => ({ name })) as T[],
      }
    }

    if (query.includes("select balance_credits, updated_at") && query.includes("from credit_balance_profiles")) {
      const row = this.state.profiles.get(String(this.params[0]))
      return {
        results: row
          ? [
              {
                balance_credits: row.balance_credits,
                updated_at: row.updated_at,
              } as T,
            ]
          : [],
      }
    }

    if (query.includes("select customer_ref, balance_credits, updated_at") && query.includes("from credit_balance_profiles")) {
      const row = this.state.profiles.get(String(this.params[0]))
      return {
        results: row ? [row as T] : [],
      }
    }

    if (query.includes("sum(case when credits_delta > 0 then credits_delta else 0 end)")) {
      const customerRef = String(this.params[0])
      const total = Array.from(this.state.events.values())
        .filter((event) => event.customer_ref === customerRef && event.credits_delta > 0)
        .reduce((sum, event) => sum + event.credits_delta, 0)
      return {
        results: [{ lifetime_deposited_credits: total } as T],
      }
    }

    if (query.includes("sum(credits_delta)") && query.includes("dryapi-dashboard-subscription")) {
      const customerRef = String(this.params[0])
      const total = Array.from(this.state.events.values())
        .filter(
          (event) =>
            event.customer_ref === customerRef
            && event.source === "dryapi-dashboard-subscription",
        )
        .reduce((sum, event) => sum + event.credits_delta, 0)
      return {
        results: [{ total_subscription_grants: total } as T],
      }
    }

    if (query.includes("from saas_monthly_token_buckets")) {
      const bucket = this.state.buckets.get(String(this.params[0]))
      return {
        results: bucket ? [bucket as T] : [],
      }
    }

    throw new Error(`Unhandled all query: ${this.query}`)
  }
}

class FakeD1Database {
  constructor(private readonly state: FakeState) {}

  prepare(query: string): FakePreparedStatement {
    return new FakePreparedStatement(this.state, query)
  }

  async batch(statements: TestPreparedStatement[]): Promise<unknown[]> {
    return runBatch(statements)
  }
}

function createDb() {
  const state = createState()
  return {
    state,
    db: new FakeD1Database(state),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  resolveConfiguredBalanceMock.mockReset()
  getSqlDbAsyncMock.mockReset()
  resolveConfiguredBalanceMock.mockReturnValue(15)
  vi.useRealTimers()
})

describe("dashboard-billing-credits", () => {
  it("returns null when billing db resolution fails and rejects invalid customer refs", async () => {
    const { db } = createDb()
    await expect(getStoredCreditBalance("owner@dryapi.dev", { db })).resolves.toBeNull()

    await expect(getStoredCreditBalance("", { db })).rejects.toThrow(
      "A valid customer ref is required",
    )
  })

  it("treats null same-window monthly spend values as zero", async () => {
    const { state, db } = createDb()
    stubNow("2026-03-21T12:00:00.000Z")
    const windowStart = currentWindowStartMs("2026-03-21T12:00:00.000Z")
    seedProfile(state, {
      customer_ref: "owner@dryapi.dev",
      auto_top_up_monthly_spent_credits: null,
      auto_top_up_monthly_window_start_at: windowStart,
    })

    await expect(
      updateStoredAutoTopUpSettings(
        {
          customerRef: "owner@dryapi.dev",
          enabled: true,
          thresholdCredits: 5,
          amountCredits: 25,
          monthlyCapCredits: 100,
        },
        { db },
      ),
    ).resolves.toMatchObject({
      monthlySpentCredits: 0,
    })

    await expect(
      incrementStoredAutoTopUpMonthlySpent(
        {
          customerRef: "owner@dryapi.dev",
          spentDeltaCredits: 1,
        },
        { db },
      ),
    ).resolves.toMatchObject({
      monthlySpentCredits: 1,
    })
  })

  it("reads stored credit balances from the resolved billing db binding", async () => {
    const { state, db } = createDb()
    seedProfile(state, {
      customer_ref: "owner@dryapi.dev",
      balance_credits: "12.3456",
      updated_at: "1710835200000",
    })

    getSqlDbAsyncMock.mockResolvedValue(db)

    await expect(getStoredCreditBalance("owner@dryapi.dev", { db })).resolves.toEqual({
      balanceCredits: 12.346,
      updatedAt: new Date(1710835200000).toISOString(),
    })
  })

  it("applies billing credit grants through the resolved billing binding", async () => {
    const { db } = createDb()
    getSqlDbAsyncMock.mockResolvedValue(db)

    const first = await applyBillingCreditGrant({
      customerRef: "owner@dryapi.dev",
      eventId: "evt_env_1",
      creditsDelta: 5,
      source: "dryapi-dashboard-top-up",
      metadata: { source: "env" },
      initialBalanceCredits: 2,
    })

    const second = await applyBillingCreditGrant({
      customerRef: "owner@dryapi.dev",
      eventId: "evt_env_1",
      creditsDelta: 5,
      source: "dryapi-dashboard-top-up",
      metadata: { source: "env" },
      initialBalanceCredits: 2,
    })

    expect(first.applied).toBe(true)
    expect(first.balance?.balanceCredits).toBe(7)
    expect(second.applied).toBe(false)
    expect(second.balance?.balanceCredits).toBe(7)
  })

  it("uses the resolved billing binding for the remaining public helpers", async () => {
    const { state, db } = createDb()
    const windowStart = currentWindowStartMs("2026-03-21T12:00:00.000Z")
    seedProfile(state, {
      customer_ref: "owner@dryapi.dev",
      balance_credits: 20,
      updated_at: 1710835200000,
      auto_top_up_monthly_spent_credits: 1,
      auto_top_up_monthly_window_start_at: windowStart,
    })
    getSqlDbAsyncMock.mockResolvedValue(db)
    stubNow("2026-03-21T12:00:00.000Z")

    await expect(getStoredAutoTopUpSettings("owner@dryapi.dev", { db })).resolves.toMatchObject({
      thresholdCredits: 5,
    })

    await expect(
      updateStoredAutoTopUpSettings({
        customerRef: "owner@dryapi.dev",
        enabled: true,
        thresholdCredits: 8,
        amountCredits: 40,
        monthlyCapCredits: 300,
      }),
    ).resolves.toMatchObject({
      thresholdCredits: 8,
      monthlySpentCredits: 1,
    })

    await expect(
      incrementStoredAutoTopUpMonthlySpent({
        customerRef: "owner@dryapi.dev",
        spentDeltaCredits: 2,
      }),
    ).resolves.toMatchObject({
      monthlySpentCredits: 3,
    })

    await expect(getLifetimeDepositedCredits("owner@dryapi.dev")).resolves.toBe(0)
    await expect(getStoredSubscriptionCredits("owner@dryapi.dev")).resolves.toEqual({
      subscriptionCredits: 0,
      topUpCredits: 20,
    })

    await expect(
      upsertSaasMonthlyTokenBucket({
        bucketId: "bucket_env",
        customerRef: "owner@dryapi.dev",
        planSlug: "starter",
        cycleStartAtMs: 1,
        cycleExpireAtMs: 2,
        tokensGranted: 10,
      }),
    ).resolves.toMatchObject({
      bucketId: "bucket_env",
      tokensGranted: 10,
    })
  })

  it("handles invalid numeric strings and invalid dates in stored profile fields", async () => {
    const { state, db } = createDb()
    seedProfile(state, {
      customer_ref: "owner@dryapi.dev",
      balance_credits: 5,
      updated_at: 1e20,
      auto_top_up_threshold_credits: "not-a-number",
      auto_top_up_monthly_window_start_at: 1e20,
    })

    await expect(getStoredCreditBalance("owner@dryapi.dev", { db })).resolves.toEqual({
      balanceCredits: 5,
      updatedAt: null,
    })

    await expect(getStoredAutoTopUpSettings("owner@dryapi.dev", { db })).resolves.toMatchObject({
      thresholdCredits: 0,
      monthlyWindowStartAt: null,
    })
  })

  it("coerces invalid stored balances and subscription totals to zero", async () => {
    const { state, db } = createDb()
    seedProfile(state, {
      customer_ref: "owner@dryapi.dev",
      balance_credits: "not-a-number",
      updated_at: 1710835200000,
    })

    await expect(getStoredCreditBalance("owner@dryapi.dev", { db })).resolves.toEqual({
      balanceCredits: 0,
      updatedAt: new Date(1710835200000).toISOString(),
    })

    state.events.set("evt_sub_invalid", {
      event_id: "evt_sub_invalid",
      customer_ref: "owner@dryapi.dev",
      credits_delta: Number.NaN,
      source: "dryapi-dashboard-subscription",
      metadata_json: "{}",
      created_at: 0,
    })

    await expect(getStoredSubscriptionCredits("owner@dryapi.dev", { db })).resolves.toEqual({
      subscriptionCredits: 0,
      topUpCredits: 0,
    })
  })
  it("returns null for missing balances and missing auto-top-up rows", async () => {
    const { db } = createDb()

    await expect(getStoredCreditBalance("owner@dryapi.dev", { db })).resolves.toBeNull()
    await expect(getStoredAutoTopUpSettings("owner@dryapi.dev", { db })).resolves.toBeNull()
  })

  it("hydrates auto-top-up settings with defaults from sparse profile rows", async () => {
    const { state, db } = createDb()
    seedProfile(state, {
      customer_ref: "owner@dryapi.dev",
      balance_credits: "7.555",
      updated_at: "1710835200000",
      auto_top_up_enabled: null,
      auto_top_up_threshold_credits: null,
      auto_top_up_amount_credits: null,
      auto_top_up_monthly_cap_credits: -5,
      auto_top_up_monthly_spent_credits: null,
      auto_top_up_monthly_window_start_at: null,
    })

    await expect(getStoredAutoTopUpSettings("owner@dryapi.dev", { db })).resolves.toEqual({
      enabled: true,
      thresholdCredits: 0,
      amountCredits: 25,
      monthlyCapCredits: 0,
      monthlySpentCredits: 0,
      monthlyWindowStartAt: null,
    })
  })

  it("defaults the monthly cap when the stored cap is null", async () => {
    const { state, db } = createDb()
    seedProfile(state, {
      customer_ref: "owner@dryapi.dev",
      auto_top_up_monthly_cap_credits: null,
    })

    await expect(getStoredAutoTopUpSettings("owner@dryapi.dev", { db })).resolves.toMatchObject({
      monthlyCapCredits: 250,
    })
  })

  it("falls back when update settings receive non-finite credit values", async () => {
    const { db } = createDb()
    stubNow("2026-03-21T12:00:00.000Z")

    await expect(
      updateStoredAutoTopUpSettings(
        {
          customerRef: "owner@dryapi.dev",
          enabled: true,
          thresholdCredits: Number.POSITIVE_INFINITY,
          amountCredits: Number.NaN,
          monthlyCapCredits: Number.NEGATIVE_INFINITY,
        },
        { db },
      ),
    ).resolves.toEqual({
      enabled: true,
      thresholdCredits: 0,
      amountCredits: 25,
      monthlyCapCredits: 250,
      monthlySpentCredits: 0,
      monthlyWindowStartAt: new Date(currentWindowStartMs("2026-03-21T12:00:00.000Z")).toISOString(),
    })
  })
  it("adds missing auto-top-up columns to legacy schemas and uses configured balances for new rows", async () => {
    const { state, db } = createDb()
    setLegacyProfileSchema(state)
    resolveConfiguredBalanceMock.mockReturnValue(18.75)
    stubNow("2026-03-21T12:00:00.000Z")

    const updated = await updateStoredAutoTopUpSettings(
      {
        customerRef: "owner@dryapi.dev",
        enabled: true,
        thresholdCredits: 4.5,
        amountCredits: 25,
        monthlyCapCredits: 120,
      },
      { db },
    )

    expect(updated).toEqual({
      enabled: true,
      thresholdCredits: 4.5,
      amountCredits: 25,
      monthlyCapCredits: 120,
      monthlySpentCredits: 0,
      monthlyWindowStartAt: new Date(currentWindowStartMs("2026-03-21T12:00:00.000Z")).toISOString(),
    })
    expect(Array.from(state.profileColumns)).toEqual(
      expect.arrayContaining([
        "auto_top_up_amount_credits",
        "auto_top_up_monthly_cap_credits",
        "auto_top_up_monthly_spent_credits",
        "auto_top_up_monthly_window_start_at",
      ]),
    )

    const storedBalance = await getStoredCreditBalance("owner@dryapi.dev", { db })
    expect(storedBalance?.balanceCredits).toBe(18.75)
  })

  it("retains existing monthly spent inside the same billing window", async () => {
    const { state, db } = createDb()
    stubNow("2026-03-21T12:00:00.000Z")
    const windowStart = currentWindowStartMs("2026-03-21T12:00:00.000Z")

    seedProfile(state, {
      customer_ref: "owner@dryapi.dev",
      balance_credits: 40,
      updated_at: Date.now(),
      auto_top_up_enabled: 1,
      auto_top_up_threshold_credits: 5,
      auto_top_up_amount_credits: 25,
      auto_top_up_monthly_cap_credits: 250,
      auto_top_up_monthly_spent_credits: 12.5,
      auto_top_up_monthly_window_start_at: windowStart,
    })

    await expect(
      updateStoredAutoTopUpSettings(
        {
          customerRef: "owner@dryapi.dev",
          enabled: false,
          thresholdCredits: 6,
          amountCredits: 30,
          monthlyCapCredits: 300,
        },
        { db },
      ),
    ).resolves.toEqual({
      enabled: false,
      thresholdCredits: 6,
      amountCredits: 30,
      monthlyCapCredits: 300,
      monthlySpentCredits: 12.5,
      monthlyWindowStartAt: new Date(windowStart).toISOString(),
    })
  })

  it("returns null when updated profile rows disappear after write operations", async () => {
    const createSelectlessDb = (mode: "update" | "increment"): TestD1DatabaseLike => {
      let profileSelectCalls = 0

      return {
        prepare(query: string) {
          const normalized = query.toLowerCase().replace(/\s+/g, " ")
          const statement: TestPreparedStatement = {
            async run() {
              return { meta: { changes: 1 } }
            },
            async all<T>() {
              if (normalized.startsWith("select column_name as name from information_schema.columns")) {
                return { results: FULL_PROFILE_COLUMNS.map((name) => ({ name })) as T[] }
              }

              if (normalized.includes("select customer_ref, balance_credits, updated_at")) {
                profileSelectCalls += 1
                if (mode === "increment" && profileSelectCalls === 1) {
                  return {
                    results: [
                      {
                        customer_ref: "owner@dryapi.dev",
                        balance_credits: 10,
                        updated_at: Date.now(),
                        auto_top_up_enabled: 1,
                        auto_top_up_threshold_credits: 5,
                        auto_top_up_amount_credits: 25,
                        auto_top_up_monthly_cap_credits: 250,
                        auto_top_up_monthly_spent_credits: 2,
                        auto_top_up_monthly_window_start_at: currentWindowStartMs("2026-03-21T12:00:00.000Z"),
                      },
                    ] as T[],
                  }
                }

                return { results: [] as T[] }
              }

              return { results: [] as T[] }
            },
            bind(...values: unknown[]) {
              void values
              return statement
            },
          }

          return statement
        },
        batch(statements: TestPreparedStatement[]) {
          return runBatch(statements)
        },
      }
    }

    stubNow("2026-03-21T12:00:00.000Z")

    await expect(
      updateStoredAutoTopUpSettings(
        {
          customerRef: "owner@dryapi.dev",
          enabled: true,
          thresholdCredits: 5,
          amountCredits: 25,
          monthlyCapCredits: 100,
        },
        { db: createSelectlessDb("update") },
      ),
    ).resolves.toBeNull()

    await expect(
      incrementStoredAutoTopUpMonthlySpent(
        {
          customerRef: "owner@dryapi.dev",
          spentDeltaCredits: 1,
        },
        { db: createSelectlessDb("increment") },
      ),
    ).resolves.toBeNull()
  })
  it("returns null for missing db handles on exported helpers", async () => {
    await expect(getStoredAutoTopUpSettings("owner@dryapi.dev", { db: null })).resolves.toBeNull()
    await expect(
      updateStoredAutoTopUpSettings(
        {
          customerRef: "owner@dryapi.dev",
          enabled: true,
          thresholdCredits: 5,
          amountCredits: 25,
          monthlyCapCredits: 100,
        },
        { db: null },
      ),
    ).resolves.toBeNull()
    await expect(
      incrementStoredAutoTopUpMonthlySpent(
        {
          customerRef: "owner@dryapi.dev",
          spentDeltaCredits: 5,
        },
        { db: null },
      ),
    ).resolves.toBeNull()
    await expect(getLifetimeDepositedCredits("owner@dryapi.dev", { db: null })).resolves.toBeNull()
    await expect(getStoredSubscriptionCredits("owner@dryapi.dev", { db: null })).resolves.toBeNull()
    await expect(
      applyBillingCreditGrant(
        {
          customerRef: "owner@dryapi.dev",
          eventId: "evt_null",
          creditsDelta: 10,
          source: "test",
          metadata: {},
        },
        { db: null },
      ),
    ).resolves.toEqual({ applied: false, balance: null })
    await expect(
      upsertSaasMonthlyTokenBucket(
        {
          bucketId: "bucket_null",
          customerRef: "owner@dryapi.dev",
          planSlug: "starter",
          cycleStartAtMs: 1,
          cycleExpireAtMs: 2,
          tokensGranted: 10,
        },
        { db: null },
      ),
    ).resolves.toBeNull()
  })

  it("increments monthly spent, ignores negative deltas, and resets across billing windows", async () => {
    const { state, db } = createDb()
    stubNow("2026-03-21T12:00:00.000Z")
    const windowStart = currentWindowStartMs("2026-03-21T12:00:00.000Z")

    seedProfile(state, {
      customer_ref: "owner@dryapi.dev",
      balance_credits: 40,
      updated_at: Date.now(),
      auto_top_up_monthly_spent_credits: 10,
      auto_top_up_monthly_window_start_at: windowStart,
    })

    await expect(
      incrementStoredAutoTopUpMonthlySpent(
        {
          customerRef: "owner@dryapi.dev",
          spentDeltaCredits: -5,
        },
        { db },
      ),
    ).resolves.toMatchObject({
      monthlySpentCredits: 10,
    })

    await expect(
      incrementStoredAutoTopUpMonthlySpent(
        {
          customerRef: "owner@dryapi.dev",
          spentDeltaCredits: 3,
        },
        { db },
      ),
    ).resolves.toMatchObject({
      monthlySpentCredits: 13,
    })

    seedProfile(state, {
      customer_ref: "owner@dryapi.dev",
      auto_top_up_monthly_spent_credits: 50,
      auto_top_up_monthly_window_start_at: currentWindowStartMs("2026-02-01T00:00:00.000Z"),
    })

    await expect(
      incrementStoredAutoTopUpMonthlySpent(
        {
          customerRef: "owner@dryapi.dev",
          spentDeltaCredits: 4,
        },
        { db },
      ),
    ).resolves.toMatchObject({
      monthlySpentCredits: 4,
    })

    await expect(
      incrementStoredAutoTopUpMonthlySpent(
        {
          customerRef: "missing@dryapi.dev",
          spentDeltaCredits: 1,
        },
        { db },
      ),
    ).resolves.toBeNull()
  })

  it("defaults increment monthly spend when the stored window or spend is null", async () => {
    const { state, db } = createDb()
    stubNow("2026-03-21T12:00:00.000Z")
    const currentWindow = currentWindowStartMs("2026-03-21T12:00:00.000Z")

    seedProfile(state, {
      customer_ref: "owner@dryapi.dev",
      auto_top_up_monthly_spent_credits: 9,
      auto_top_up_monthly_window_start_at: null,
    })

    await expect(
      incrementStoredAutoTopUpMonthlySpent(
        {
          customerRef: "owner@dryapi.dev",
          spentDeltaCredits: 2,
        },
        { db },
      ),
    ).resolves.toMatchObject({
      monthlySpentCredits: 2,
    })

    seedProfile(state, {
      customer_ref: "owner@dryapi.dev",
      auto_top_up_monthly_spent_credits: null,
      auto_top_up_monthly_window_start_at: currentWindow,
    })

    await expect(
      incrementStoredAutoTopUpMonthlySpent(
        {
          customerRef: "owner@dryapi.dev",
          spentDeltaCredits: 2,
        },
        { db },
      ),
    ).resolves.toMatchObject({
      monthlySpentCredits: 2,
    })
  })

  it("applies credit grants idempotently and reports lifetime deposits", async () => {
    const { db } = createDb()

    const firstGrant = await applyBillingCreditGrant(
      {
        customerRef: "owner@dryapi.dev",
        eventId: "evt_topup_1",
        creditsDelta: 50,
        source: "dryapi-dashboard-top-up",
        metadata: { source: "topup" },
        initialBalanceCredits: 10,
      },
      { db },
    )

    const secondGrant = await applyBillingCreditGrant(
      {
        customerRef: "owner@dryapi.dev",
        eventId: "evt_topup_1",
        creditsDelta: 50,
        source: "dryapi-dashboard-top-up",
        metadata: { source: "topup" },
        initialBalanceCredits: 10,
      },
      { db },
    )

    await applyBillingCreditGrant(
      {
        customerRef: "owner@dryapi.dev",
        eventId: "evt_refund_1",
        creditsDelta: -10,
        source: "refund",
        metadata: { source: "refund" },
      },
      { db },
    )

    expect(firstGrant.applied).toBe(true)
    expect(firstGrant.balance?.balanceCredits).toBe(60)
    expect(secondGrant.applied).toBe(false)
    expect(secondGrant.balance?.balanceCredits).toBe(60)
    await expect(getLifetimeDepositedCredits("owner@dryapi.dev", { db })).resolves.toBe(50)
  })

  it("treats missing insert metadata as a duplicate credit event", async () => {
    const fallbackInsertDb: TestD1DatabaseLike = {
      prepare(query: string) {
        const normalized = query.toLowerCase().replace(/\s+/g, " ")
        const statement: TestPreparedStatement = {
          async run() {
            if (normalized.includes("insert or ignore into billing_credit_events")) {
              return {}
            }

            return { meta: { changes: 0 } }
          },
          async all<T>() {
            if (normalized.startsWith("select column_name as name from information_schema.columns")) {
              return { results: FULL_PROFILE_COLUMNS.map((name) => ({ name })) as T[] }
            }

            if (normalized.includes("select balance_credits, updated_at") && normalized.includes("from credit_balance_profiles")) {
              return {
                results: [
                  {
                    balance_credits: 7,
                    updated_at: 1710835200000,
                  },
                ] as T[],
              }
            }

            return { results: [] as T[] }
          },
          bind(...values: unknown[]) {
            void values
            return statement
          },
        }

        return statement
      },
      batch(statements: TestPreparedStatement[]) {
        return runBatch(statements)
      },
    }

    const result = await applyBillingCreditGrant(
      {
        customerRef: "owner@dryapi.dev",
        eventId: "evt_meta_missing",
        creditsDelta: 5,
        source: "dryapi-dashboard-top-up",
        metadata: { source: "duplicate" },
        initialBalanceCredits: 2,
      },
      { db: fallbackInsertDb },
    )

    expect(result.applied).toBe(false)
    expect(result.balance).toEqual({
      balanceCredits: 7,
      updatedAt: new Date(1710835200000).toISOString(),
    })
  })

  it("splits subscription and top-up balances for the dashboard", async () => {
    const { db } = createDb()

    await applyBillingCreditGrant(
      {
        customerRef: "owner@dryapi.dev",
        eventId: "evt_sub_1",
        creditsDelta: 20,
        source: "dryapi-dashboard-subscription",
        metadata: { plan: "starter" },
        initialBalanceCredits: 0,
      },
      { db },
    )

    await applyBillingCreditGrant(
      {
        customerRef: "owner@dryapi.dev",
        eventId: "evt_topup_2",
        creditsDelta: 30,
        source: "dryapi-dashboard-top-up",
        metadata: { source: "topup" },
      },
      { db },
    )

    await expect(getStoredSubscriptionCredits("owner@dryapi.dev", { db })).resolves.toEqual({
      subscriptionCredits: 20,
      topUpCredits: 30,
    })
  })

  it("returns zero lifetime deposits for malformed aggregate rows", async () => {
    const malformedAggregateDb: TestD1DatabaseLike = {
      prepare(query: string) {
        const normalized = query.toLowerCase().replace(/\s+/g, " ")
        const statement: TestPreparedStatement = {
          async run() {
            return { meta: { changes: 0 } }
          },
          async all<T>() {
            if (normalized.startsWith("select column_name as name from information_schema.columns")) {
              return { results: FULL_PROFILE_COLUMNS.map((name) => ({ name })) as T[] }
            }

            if (normalized.includes("sum(case when credits_delta > 0")) {
              return { results: [{ lifetime_deposited_credits: "not-a-number" }] as T[] }
            }

            return { results: [] as T[] }
          },
          bind(...values: unknown[]) {
            void values
            return statement
          },
        }

        return statement
      },
      batch(statements: TestPreparedStatement[]) {
        return runBatch(statements)
      },
    }

    await expect(getLifetimeDepositedCredits("owner@dryapi.dev", { db: malformedAggregateDb })).resolves.toBe(0)
  })
  it("upserts SaaS monthly token buckets and clamps remaining tokens on refresh", async () => {
    const { state, db } = createDb()

    const initial = await upsertSaasMonthlyTokenBucket(
      {
        bucketId: "bucket_1",
        customerRef: "owner@dryapi.dev",
        planSlug: "starter",
        cycleStartAtMs: 1_700_000_000_000,
        cycleExpireAtMs: 1_700_086_400_000,
        tokensGranted: 100,
      },
      { db },
    )

    const existing = state.buckets.get("bucket_1")
    if (!existing) {
      throw new Error("Expected bucket_1 to exist")
    }
    existing.tokens_remaining = 150

    const clamped = await upsertSaasMonthlyTokenBucket(
      {
        bucketId: "bucket_1",
        customerRef: "owner@dryapi.dev",
        planSlug: "starter",
        cycleStartAtMs: 1_700_000_000_000,
        cycleExpireAtMs: 1_700_086_400_000,
        tokensGranted: 80,
      },
      { db },
    )

    existing.tokens_remaining = 50

    const preserved = await upsertSaasMonthlyTokenBucket(
      {
        bucketId: "bucket_1",
        customerRef: "owner@dryapi.dev",
        planSlug: "starter",
        cycleStartAtMs: 1_700_000_000_000,
        cycleExpireAtMs: 1_700_086_400_000,
        tokensGranted: 80,
      },
      { db },
    )

    expect(initial).toMatchObject({
      bucketId: "bucket_1",
      tokensGranted: 100,
      tokensRemaining: 100,
    })
    expect(clamped).toMatchObject({
      tokensGranted: 80,
      tokensRemaining: 80,
    })
    expect(preserved).toMatchObject({
      tokensGranted: 80,
      tokensRemaining: 50,
    })
  })

  it("coerces invalid token bucket numeric fields to zero or null snapshots", async () => {
    const { state, db } = createDb()
    state.buckets.set("bucket_invalid", {
      bucket_id: "bucket_invalid",
      customer_ref: "owner@dryapi.dev",
      plan_slug: "starter",
      cycle_start_at: 1e20,
      cycle_expire_at: Number.NaN,
      tokens_granted: Number.NaN,
      tokens_remaining: Number.NaN,
      updated_at: 1e20,
    })

    await expect(
      upsertSaasMonthlyTokenBucket(
        {
          bucketId: "bucket_invalid",
          customerRef: "owner@dryapi.dev",
          planSlug: "starter",
          cycleStartAtMs: 1e20,
          cycleExpireAtMs: Number.NaN,
          tokensGranted: Number.NaN,
        },
        { db },
      ),
    ).resolves.toMatchObject({
      cycleStartAt: null,
      cycleExpireAt: null,
      tokensGranted: 0,
      tokensRemaining: 0,
    })
  })

  it("returns null subscription credit splits when no balance row exists", async () => {
    const { db } = createDb()

    await expect(getStoredSubscriptionCredits("owner@dryapi.dev", { db })).resolves.toBeNull()
  })

  it("returns null when the token bucket row cannot be read after upsert", async () => {
    const missingBucketDb: TestD1DatabaseLike = {
      prepare(query: string) {
        const normalized = query.toLowerCase().replace(/\s+/g, " ")
        const statement: TestPreparedStatement = {
          async run() {
            return { meta: { changes: 1 } }
          },
          async all<T>() {
            if (normalized.startsWith("select column_name as name from information_schema.columns")) {
              return { results: FULL_PROFILE_COLUMNS.map((name) => ({ name })) as T[] }
            }

            if (normalized.includes("from saas_monthly_token_buckets")) {
              return { results: [] as T[] }
            }

            return { results: [] as T[] }
          },
          bind(...values: unknown[]) {
            void values
            return statement
          },
        }

        return statement
      },
      batch(statements: TestPreparedStatement[]) {
        return runBatch(statements)
      },
    }

    await expect(
      upsertSaasMonthlyTokenBucket(
        {
          bucketId: "bucket_missing",
          customerRef: "owner@dryapi.dev",
          planSlug: "starter",
          cycleStartAtMs: 1,
          cycleExpireAtMs: 2,
          tokensGranted: 10,
        },
        { db: missingBucketDb },
      ),
    ).resolves.toBeNull()
  })

  it("grants SaaS subscription cycle benefits and rejects invalid cycle timestamps", async () => {
    const { db } = createDb()

    await expect(
      ensureSaasSubscriptionCycleBenefits(
        {
          customerRef: "owner@dryapi.dev",
          subscriptionId: "sub_1",
          planSlug: "starter",
          cycleStartIso: "not-a-date",
          cycleExpireIso: "2026-04-01T00:00:00.000Z",
          creditsGranted: 25,
          monthlyTokensGranted: 100,
          source: "dryapi-dashboard-subscription",
          metadata: { plan: "starter" },
          initialBalanceCredits: 5,
        },
        { db },
      ),
    ).rejects.toThrow("Valid cycle timestamps are required")

    const granted = await ensureSaasSubscriptionCycleBenefits(
      {
        customerRef: "owner@dryapi.dev",
        subscriptionId: "sub_1",
        planSlug: "starter",
        cycleStartIso: "2026-03-01T00:00:00.000Z",
        cycleExpireIso: "2026-04-01T00:00:00.000Z",
        creditsGranted: 25,
        monthlyTokensGranted: 100,
        source: "dryapi-dashboard-subscription",
        metadata: { plan: "starter" },
        initialBalanceCredits: 5,
      },
      { db },
    )

    const duplicate = await ensureSaasSubscriptionCycleBenefits(
      {
        customerRef: "owner@dryapi.dev",
        subscriptionId: "sub_1",
        planSlug: "starter",
        cycleStartIso: "2026-03-01T00:00:00.000Z",
        cycleExpireIso: "2026-04-01T00:00:00.000Z",
        creditsGranted: 25,
        monthlyTokensGranted: 100,
        source: "dryapi-dashboard-subscription",
        metadata: { plan: "starter" },
        initialBalanceCredits: 5,
      },
      { db },
    )

    const zeroGrant = await ensureSaasSubscriptionCycleBenefits(
      {
        customerRef: "owner@dryapi.dev",
        subscriptionId: "sub_zero",
        planSlug: "starter",
        cycleStartIso: "2026-04-01T00:00:00.000Z",
        cycleExpireIso: "2026-05-01T00:00:00.000Z",
        creditsGranted: 0,
        monthlyTokensGranted: 0,
        source: "dryapi-dashboard-subscription",
        metadata: { plan: "starter" },
      },
      { db },
    )

    expect(granted.appliedCredits).toBe(true)
    expect(granted.balance?.balanceCredits).toBe(30)
    expect(granted.bucket).toMatchObject({ tokensGranted: 100, tokensRemaining: 100 })
    expect(duplicate.appliedCredits).toBe(false)
    expect(duplicate.balance?.balanceCredits).toBe(30)
    expect(zeroGrant.appliedCredits).toBe(false)
    expect(zeroGrant.balance?.balanceCredits).toBe(30)
    expect(zeroGrant.bucket).toBeNull()
  })

  it("uses the configured default balance when Stripe checkout sync succeeds without an explicit initial balance", async () => {
    const { db } = createDb()
    resolveConfiguredBalanceMock.mockReturnValue(33)

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "cs_success_2",
            mode: "payment",
            payment_status: "paid",
            metadata: {
              source: "dryapi-dashboard-top-up",
              creditsGranted: "7",
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    )

    const result = await syncDashboardTopUpFromStripeCheckout({
      checkoutSessionId: "cs_success_2",
      customerRef: "owner@dryapi.dev",
      stripePrivateKey: "sk_test_123",
      db,
    })

    expect(result.applied).toBe(true)
    expect(result.balance?.balanceCredits).toBe(40)
  })

  it("syncs Stripe dashboard top-ups across all failure branches and remains idempotent", async () => {
    const { db } = createDb()

    await expect(
      syncDashboardTopUpFromStripeCheckout({
        checkoutSessionId: "cs_test_missing_key",
        customerRef: "owner@dryapi.dev",
        stripePrivateKey: "   ",
        db,
      }),
    ).resolves.toEqual({
      applied: false,
      balance: null,
      reason: "stripe_not_configured",
    })

    await expect(
      syncDashboardTopUpFromStripeCheckout({
        checkoutSessionId: "bad_session_id",
        customerRef: "owner@dryapi.dev",
        stripePrivateKey: "sk_test_123",
        db,
      }),
    ).rejects.toThrow("Invalid Stripe checkout session id")

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })))
    await expect(
      syncDashboardTopUpFromStripeCheckout({
        checkoutSessionId: "cs_test_fetch_fail",
        customerRef: "owner@dryapi.dev",
        stripePrivateKey: "sk_test_123",
        db,
      }),
    ).resolves.toMatchObject({ reason: "stripe_session_fetch_failed" })

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("invalid-json", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    )
    await expect(
      syncDashboardTopUpFromStripeCheckout({
        checkoutSessionId: "cs_test_invalid_payload",
        customerRef: "owner@dryapi.dev",
        stripePrivateKey: "sk_test_123",
        db,
      }),
    ).resolves.toMatchObject({ reason: "stripe_session_payload_invalid" })

    const failureCases = [
      {
        reason: "stripe_session_not_payment",
        payload: { id: "cs_case_1", mode: "setup", payment_status: "paid", metadata: { source: "dryapi-dashboard-top-up", creditsGranted: "20" } },
      },
      {
        reason: "stripe_session_not_paid",
        payload: { id: "cs_case_2", mode: "payment", payment_status: "unpaid", metadata: { source: "dryapi-dashboard-top-up", creditsGranted: "20" } },
      },
      {
        reason: "stripe_session_not_top_up",
        payload: { id: "cs_case_3", mode: "payment", payment_status: "paid", metadata: { source: "other-source", creditsGranted: "20" } },
      },
      {
        reason: "stripe_session_customer_mismatch",
        payload: { id: "cs_case_4", mode: "payment", payment_status: "paid", customer_details: { email: "other@dryapi.dev" }, metadata: { source: "dryapi-dashboard-top-up", creditsGranted: "20" } },
      },
      {
        reason: "stripe_session_missing_credits",
        payload: { id: "cs_case_5", mode: "payment", payment_status: "paid", customer_email: "owner@dryapi.dev", metadata: { source: "dryapi-dashboard-top-up", creditsGranted: "0" } },
      },
      {
        reason: "stripe_session_not_top_up",
        payload: { id: "cs_case_6", mode: "payment", payment_status: "paid" },
      },
    ]

    for (const testCase of failureCases) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify(testCase.payload), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
      )

      await expect(
        syncDashboardTopUpFromStripeCheckout({
          checkoutSessionId: testCase.payload.id,
          customerRef: "owner@dryapi.dev",
          stripePrivateKey: "sk_test_123",
          db,
        }),
      ).resolves.toMatchObject({ reason: testCase.reason })
    }

    const successPayload = {
      id: "cs_success_1",
      mode: "payment",
      payment_status: "paid",
      customer_details: {
        email: "owner@dryapi.dev",
      },
      metadata: {
        source: "dryapi-dashboard-top-up",
        creditsGranted: "50",
      },
    }

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(successPayload), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    )

    const first = await syncDashboardTopUpFromStripeCheckout({
      checkoutSessionId: "cs_success_1",
      customerRef: "owner@dryapi.dev",
      stripePrivateKey: "sk_test_123",
      initialBalanceCredits: 10,
      db,
    })

    const second = await syncDashboardTopUpFromStripeCheckout({
      checkoutSessionId: "cs_success_1",
      customerRef: "owner@dryapi.dev",
      stripePrivateKey: "sk_test_123",
      initialBalanceCredits: 10,
      db,
    })

    const stored = await getStoredCreditBalance("owner@dryapi.dev", { db })

    expect(first.applied).toBe(true)
    expect(first.balance?.balanceCredits).toBe(60)
    expect(second.applied).toBe(false)
    expect(stored?.balanceCredits).toBe(60)
  })
})