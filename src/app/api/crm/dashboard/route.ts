import { NextRequest, NextResponse } from "next/server"

import { verifyCloudflareAccess } from "@/lib/cloudflare-access"
import { getCrmDashboardData } from "@/lib/crm-data"
import { isCrmDashboardEnabled } from "@/lib/feature-flags"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  if (!isCrmDashboardEnabled()) {
    return NextResponse.json({ error: "CRM dashboard is disabled." }, { status: 404 })
  }

  const auth = await verifyCloudflareAccess(request)

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const data = await getCrmDashboardData()
  return NextResponse.json(data, { status: 200 })
}
