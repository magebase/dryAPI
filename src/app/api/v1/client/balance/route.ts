import { NextRequest, NextResponse } from "next/server"

import { requireApiTokenIfConfigured } from "@/app/api/v1/client/_shared"
import { ensureCurrentUserSubscriptionBenefits } from "@/lib/auth-subscription-benefits"
import { resolveConfiguredBalance } from "@/lib/configured-balance"
import { getDashboardSessionSnapshot } from "@/lib/dashboard-billing"
import { getStoredCreditBalance } from "@/lib/dashboard-billing-credits"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const unauthorized = requireApiTokenIfConfigured(request)
  if (unauthorized) {
    return unauthorized
  }

  const session = await getDashboardSessionSnapshot(request)
  if (session.email) {
    await ensureCurrentUserSubscriptionBenefits(session.email).catch(() => null)
  }

  const stored = session.email ? await getStoredCreditBalance(session.email).catch(() => null) : null
  const balance = stored?.balanceCredits ?? resolveConfiguredBalance()
  const updatedAt = stored?.updatedAt || new Date().toISOString()

  return NextResponse.json({
    data: {
      balance,
      credits: balance,
      currency: "credits",
      updated_at: updatedAt,
    },
    balance,
    credits: balance,
  })
}
