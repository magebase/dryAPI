import { NextRequest, NextResponse } from "next/server"

import { invokeAuthHandler } from "@/lib/auth-handler-proxy"
import { getDashboardSessionSnapshot, resolveRequestOriginFromRequest } from "@/lib/dashboard-billing"

export const runtime = "nodejs"

type StripeBillingPortalResponse = {
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
        message: "Sign in to access billing portal.",
      },
      { status: 401 },
    )
  }

  const origin = resolveRequestOriginFromRequest(request)
  const { response, data } = await invokeAuthHandler<StripeBillingPortalResponse>({
    request,
    path: "/api/auth/subscription/billing-portal",
    method: "POST",
    body: {
      returnUrl: `${origin}/dashboard/billing`,
      disableRedirect: true,
    },
  })

  if (!response.ok || !data?.url) {
    return NextResponse.json(
      {
        error: "portal_creation_failed",
        message: data?.error?.message || "Unable to create Stripe billing portal session.",
      },
      { status: response.status || 502 },
    )
  }

  return NextResponse.redirect(data.url, 302)
}
