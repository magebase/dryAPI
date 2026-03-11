import { NextRequest, NextResponse } from "next/server"

import { verifyCloudflareAccess } from "@/lib/cloudflare-access"
import { getCrmDashboardData } from "@/lib/crm-data"
import { exportLeads } from "@/lib/crm-export"
import { isCrmDashboardEnabled } from "@/lib/feature-flags"

export const runtime = "nodejs"

type ExportFormat = "csv" | "hubspot" | "salesforce" | "zoho"

function resolveFormat(value: string | null): ExportFormat {
  const format = (value || "csv").trim().toLowerCase()

  if (format === "csv" || format === "hubspot" || format === "salesforce" || format === "zoho") {
    return format
  }

  return "csv"
}

export async function GET(request: NextRequest) {
  if (!isCrmDashboardEnabled()) {
    return NextResponse.json({ error: "CRM dashboard is disabled." }, { status: 404 })
  }

  const auth = await verifyCloudflareAccess(request)

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const format = resolveFormat(request.nextUrl.searchParams.get("format"))
  const dashboard = await getCrmDashboardData()
  const payload = exportLeads(dashboard.leads, format)

  const extension = format === "csv" ? "csv" : "json"
  const contentType = format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8"

  return new NextResponse(payload, {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename=genfix-leads-${format}.${extension}`,
    },
  })
}
