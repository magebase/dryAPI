import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { verifyCloudflareAccess } from "@/lib/cloudflare-access"
import {
  isCrmDashboardEnabled,
  isCrmWorkflowAutomationsEnabled,
  isWorkflowKindEnabled,
} from "@/lib/feature-flags"

export const runtime = "nodejs"

const workflowDispatchSchema = z.object({
  kind: z.string().trim().min(1),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
})

function resolveDispatchConfig() {
  const dispatchUrl =
    process.env.CRM_AUTOMATION_DISPATCH_URL?.trim()
    || process.env.WORKFLOW_CHAT_ESCALATION_WEBHOOK_URL?.trim()
    || ""
  const token =
    process.env.CRM_AUTOMATION_API_TOKEN?.trim()
    || process.env.WORKFLOW_CHAT_ESCALATION_WEBHOOK_TOKEN?.trim()
    || ""

  return {
    dispatchUrl,
    token,
  }
}

export async function POST(request: NextRequest) {
  if (!isCrmDashboardEnabled()) {
    return NextResponse.json({ error: "CRM dashboard is disabled." }, { status: 404 })
  }

  if (!isCrmWorkflowAutomationsEnabled()) {
    return NextResponse.json({ error: "CRM workflow automation is disabled." }, { status: 403 })
  }

  const auth = await verifyCloudflareAccess(request)

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const parsed = workflowDispatchSchema.safeParse(await request.json().catch(() => ({})))

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workflow dispatch payload." }, { status: 400 })
  }

  if (!isWorkflowKindEnabled(parsed.data.kind)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Workflow kind '${parsed.data.kind}' is disabled by env configuration.`,
      },
      { status: 403 }
    )
  }

  const config = resolveDispatchConfig()

  if (!config.dispatchUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing CRM_AUTOMATION_DISPATCH_URL (or WORKFLOW_CHAT_ESCALATION_WEBHOOK_URL fallback).",
      },
      { status: 400 }
    )
  }

  const headers: HeadersInit = {
    "content-type": "application/json",
  }

  if (config.token) {
    headers.authorization = `Bearer ${config.token}`
    headers["x-workflow-internal-token"] = config.token
  }

  const response = await fetch(config.dispatchUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      kind: parsed.data.kind,
      payload: parsed.data.payload,
    }),
  })

  const responseText = await response.text().catch(() => "")
  let responseJson: Record<string, unknown> = {}

  if (responseText) {
    try {
      responseJson = JSON.parse(responseText) as Record<string, unknown>
    } catch {
      responseJson = {
        raw: responseText,
      }
    }
  }

  if (!response.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `Workflow dispatch failed (${response.status}).`,
        details: responseJson,
      },
      { status: 502 }
    )
  }

  return NextResponse.json(
    {
      ok: true,
      ...responseJson,
    },
    { status: 202 }
  )
}
