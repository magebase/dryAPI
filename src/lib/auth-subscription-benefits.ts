import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"

import {
  ensureSaasSubscriptionCycleBenefits,
} from "@/lib/dashboard-billing-credits"
import { D1_BINDING_PRIORITY, resolveD1Binding } from "@/lib/d1-bindings"
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
  all: <T>() => Promise<D1PreparedResult<T>>
}

type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatement
}

type AuthUserRow = {
  id: string
  email: string
}

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
    const { env } = await getCloudflareContext({ async: true })
    return resolveD1Binding<D1DatabaseLike>(env as Record<string, unknown>, D1_BINDING_PRIORITY.auth)
  } catch {
    return null
  }
}

async function getUserByReferenceId(referenceId: string): Promise<AuthUserRow | null> {
  const normalizedReferenceId = referenceId.trim()
  if (!normalizedReferenceId) {
    return null
  }

  const db = await resolveAuthDb()
  if (!db) {
    return null
  }

  const response = await db
    .prepare(
      `
      SELECT id, email
      FROM user
      WHERE id = ?
      LIMIT 1
      `,
    )
    .bind(normalizedReferenceId)
    .all<AuthUserRow>()

  return response.results[0] ?? null
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
      SELECT s.id, s.plan, s.status, s.referenceId
      FROM subscription s
      INNER JOIN user u ON u.id = s.referenceId
      WHERE lower(u.email) = ?
      ORDER BY s.updatedAt DESC, s.createdAt DESC
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

async function syncBenefitsForUser(email: string, subscription: AuthSubscriptionRow) {
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
    customerRef: email,
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

  return syncBenefitsForUser(email, subscription)
}

export async function resolveCurrentUserSubscriptionPlanSummary(
  email: string,
  options?: { db?: D1DatabaseLike | null },
): Promise<CurrentUserSubscriptionPlanSummary | null> {
  const subscription = await getLatestActiveSubscriptionForEmail(email, options)
  if (!subscription) {
    return null
  }

  return resolveCurrentUserSubscriptionPlanSummaryFromSubscription(subscription)
}

export async function syncSubscriptionBenefitsForReferenceId(referenceId: string) {
  const user = await getUserByReferenceId(referenceId)
  if (!user?.email) {
    return {
      appliedCredits: false,
      balance: null,
      bucket: null,
      reason: "user_not_found",
    }
  }

  const subscription = await getLatestActiveSubscriptionForEmail(user.email)
  if (!subscription) {
    return {
      appliedCredits: false,
      balance: null,
      bucket: null,
      reason: "no_active_subscription",
    }
  }

  return syncBenefitsForUser(user.email, subscription)
}