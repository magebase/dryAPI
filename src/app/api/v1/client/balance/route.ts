import { NextRequest, NextResponse } from "next/server"

import { requireApiTokenIfConfigured, resolveConfiguredBalance } from "@/app/api/v1/client/_shared"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const unauthorized = requireApiTokenIfConfigured(request)
  if (unauthorized) {
    return unauthorized
  }

  const balance = resolveConfiguredBalance()

  return NextResponse.json({
    data: {
      balance,
      credits: balance,
      currency: "credits",
      updated_at: new Date().toISOString(),
    },
    balance,
    credits: balance,
  })
}
