import { NextRequest, NextResponse } from "next/server"

import { invokeAuthHandler } from "@/lib/auth-handler-proxy"
import { getDashboardSessionSnapshot, resolveRequestOriginFromRequest } from "@/lib/dashboard-billing"
import {
  resolveSaasPlan,
} from "@/lib/stripe-saas-plans"
import {
  buildBrandedCheckoutCancelUrl,
  buildBrandedCheckoutSuccessUrl,
} from "@/lib/stripe-branding"

export const runtime = "nodejs"

type BillingPeriod = "monthly" | "annual"

type StripeSubscriptionUpgradeResponse = {
  url?: string
  redirect?: boolean
  error?: {
    message?: string
  }
}

export async function GET(request: NextRequest) {
  const session = await getDashboardSessionSnapshot(request)

  if (!session.authenticated) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "Sign in to create a subscription checkout session.",
      },
      { status: 401 },
    )
  }

  const requestedPlanSlug = request.nextUrl.searchParams.get("plan")?.trim() || ""
  const plan = resolveSaasPlan(requestedPlanSlug)
  const requestedPeriod = (request.nextUrl.searchParams.get("period") || "monthly").trim().toLowerCase()

  if (requestedPeriod !== "monthly" && requestedPeriod !== "annual") {
    return NextResponse.json(
      {
        error: "invalid_billing_period",
        message: "Unknown billing period. Use monthly or annual.",
      },
      { status: 400 },
    )
  }

  const billingPeriod: BillingPeriod = requestedPeriod === "annual" ? "annual" : "monthly"

  if (!plan) {
    return NextResponse.json(
      {
        error: "invalid_plan",
        message: "Unknown plan. Use starter, growth, or scale.",
      },
      { status: 400 },
    )
  }

  const origin = resolveRequestOriginFromRequest(request)

  const { response, data } = await invokeAuthHandler<StripeSubscriptionUpgradeResponse>({
    request,
    path: "/api/auth/subscription/upgrade",
    method: "POST",
    body: {
      plan: plan.slug,
      annual: billingPeriod === "annual",
      successUrl: buildBrandedCheckoutSuccessUrl({
        origin,
        flow: "subscription",
        planSlug: plan.slug,
        billingPeriod,
      }),
      cancelUrl: buildBrandedCheckoutCancelUrl({
        origin,
        flow: "subscription",
        planSlug: plan.slug,
        billingPeriod,
      }),
      disableRedirect: true,
    },
  })

  if (!response.ok || !data?.url) {
    return NextResponse.json(
      {
        error: "checkout_creation_failed",
        message: data?.error?.message || "Unable to create Stripe subscription checkout session.",
      },
      { status: response.status || 502 },
    )
  }

  return NextResponse.redirect(data.url, 302)
}
