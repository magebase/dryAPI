import "server-only"

import {
  createCloudflareDbAccessors,
  HYPERDRIVE_BINDING_PRIORITY,
} from "@/lib/cloudflare-db"
import {
  dashboardSubscriptionCacheScope,
  readDashboardReadCache,
} from "@/lib/dashboard-read-cache"
import {
  ensureSaasSubscriptionCycleBenefits,
} from "@/lib/dashboard-billing-credits"
import {
  resolveCurrentMonthlyTokenCycleStartIso,
  resolveMonthlyTokenExpiryIso,
  resolveSaasPlan,
} from "@/lib/stripe-saas-plans"

type D1PreparedResult<T> = {
  results: T[]
}

type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement
  all: <T = Record<string, unknown>>() => Promise<D1PreparedResult<T>>
  run: () => Promise<{ rowCount: number; meta?: { changes?: number } }>
  first: <T = Record<string, unknown>>(column?: string) => Promise<T | null>
}

type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatement
}

const { getSqlDbAsync } = createCloudflareDbAccessors(
  HYPERDRIVE_BINDING_PRIORITY,
  {},
)

type AuthSubscriptionRow = {
  id: string
  plan: string
  status: string
  referenceId: string
}

export type CurrentUserSubscriptionPlanSummary = {
  slug: string
  label: string
  status: string
  monthlyCredits: number
  discountPercent: number
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"])

async function resolveAuthDb(): Promise<D1DatabaseLike | null> {
  try {
    return await getSqlDbAsync()
  } catch {
    return null
  }
}

async function getLatestActiveSubscriptionForReferenceId(
  referenceId: string,
  options?: { db?: D1DatabaseLike | null },
): Promise<AuthSubscriptionRow | null> {
  const normalizedReferenceId = referenceId.trim().toLowerCase()
  if (!normalizedReferenceId) {
    return null
  }

  const db = options?.db ?? (await resolveAuthDb())
  if (!db) {
    return null
  }

  const response = await db
    .prepare(
      `
      SELECT id, plan, status, referenceid AS "referenceId"
      FROM subscription
      WHERE referenceid = ?
      ORDER BY updatedat DESC, createdat DESC
      LIMIT 1
      `,
    )
    .bind(normalizedReferenceId)
    .all<AuthSubscriptionRow>()

  return response.results.find((row) => ACTIVE_SUBSCRIPTION_STATUSES.has((row.status || "").toLowerCase())) ?? null
}

async function getLatestActiveSubscriptionForEmail(
  email: string,
  options?: { db?: D1DatabaseLike | null },
): Promise<AuthSubscriptionRow | null> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    return null
  }

  const db = options?.db ?? (await resolveAuthDb())
  if (!db) {
    return null
  }

  const response = await db
    .prepare(
      `
      SELECT s.id, s.plan, s.status, s.referenceid AS "referenceId"
      FROM subscription s
      INNER JOIN "user" u ON u.id = s.referenceid
      WHERE lower(u.email) = ?
      ORDER BY s.updatedat DESC, s.createdat DESC
      `,
    )
    .bind(normalizedEmail)
    .all<AuthSubscriptionRow>()

  return response.results.find((row) => ACTIVE_SUBSCRIPTION_STATUSES.has((row.status || "").toLowerCase())) ?? null
}

function resolveCurrentUserSubscriptionPlanSummaryFromSubscription(
  subscription: AuthSubscriptionRow,
): CurrentUserSubscriptionPlanSummary | null {
  const plan = resolveSaasPlan(subscription.plan)
  if (!plan) {
    return null
  }

  return {
    slug: plan.slug,
    label: plan.label,
    status: subscription.status.trim().toLowerCase(),
    monthlyCredits: plan.monthlyCredits,
    discountPercent: plan.discountPercent,
  }
}

async function syncBenefitsForReferenceId(referenceId: string, subscription: AuthSubscriptionRow) {
  const plan = resolveSaasPlan(subscription.plan)
  if (!plan) {
    return {
      appliedCredits: false,
      balance: null,
      bucket: null,
      reason: "plan_not_mapped",
    }
  }

  const cycleStartIso = resolveCurrentMonthlyTokenCycleStartIso()
  const cycleExpireIso = resolveMonthlyTokenExpiryIso()

  const result = await ensureSaasSubscriptionCycleBenefits({
    customerRef: referenceId,
    subscriptionId: subscription.id,
    planSlug: plan.slug,
    cycleStartIso,
    cycleExpireIso,
    creditsGranted: plan.monthlyCredits,
    monthlyTokensGranted: plan.monthlyTokens,
    source: "dryapi-dashboard-subscription",
    metadata: {
      source: "dryapi-dashboard-subscription",
      subscriptionId: subscription.id,
      planSlug: plan.slug,
      planLabel: plan.label,
      monthlyCreditsGranted: plan.monthlyCredits,
      monthlyTokensGranted: plan.monthlyTokens,
      monthlyTokenCycleStart: cycleStartIso,
      monthlyTokenExpiresAt: cycleExpireIso,
    },
  })

  return {
    ...result,
    reason: null,
  }
}

export async function ensureCurrentUserSubscriptionBenefits(email: string) {
  const subscription = await getLatestActiveSubscriptionForEmail(email)
  if (!subscription) {
    return {
      appliedCredits: false,
      balance: null,
      bucket: null,
      reason: "no_active_subscription",
    }
  }

  return syncBenefitsForReferenceId(email, subscription)
}

export async function resolveCurrentUserSubscriptionPlanSummary(
  email: string,
  options?: { db?: D1DatabaseLike | null },
): Promise<CurrentUserSubscriptionPlanSummary | null> {
  if (!options?.db) {
    return readDashboardReadCache({
      scope: dashboardSubscriptionCacheScope(email),
      key: "plan-summary",
      ttlSeconds: 30,
      loader: async () => {
        const subscription = await getLatestActiveSubscriptionForEmail(email)
        if (!subscription) {
          return null
        }

        return resolveCurrentUserSubscriptionPlanSummaryFromSubscription(subscription)
      },
    })
  }

  const subscription = await getLatestActiveSubscriptionForEmail(email, options)
  if (!subscription) {
    return null
  }

  return resolveCurrentUserSubscriptionPlanSummaryFromSubscription(subscription)
}

export async function syncSubscriptionBenefitsForReferenceId(referenceId: string) {
  const normalizedReferenceId = referenceId.trim()
  if (!normalizedReferenceId) {
    return {
      appliedCredits: false,
      balance: null,
      bucket: null,
      reason: "reference_id_required",
    }
  }

  const subscription = await getLatestActiveSubscriptionForReferenceId(normalizedReferenceId)
  if (!subscription) {
    return {
      appliedCredits: false,
      balance: null,
      bucket: null,
      reason: "no_active_subscription",
    }
  }

  return syncBenefitsForReferenceId(normalizedReferenceId.toLowerCase(), subscription)
}