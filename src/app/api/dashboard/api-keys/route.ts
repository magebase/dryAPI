import { NextRequest, NextResponse } from "next/server"

import { getDashboardSessionSnapshot } from "@/lib/dashboard-billing"
import { createDashboardApiKey, listDashboardApiKeysForRequest } from "@/lib/dashboard-api-keys-store"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const session = await getDashboardSessionSnapshot(request)
  if (!session.authenticated || !session.email) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "Sign in to manage API keys.",
      },
      { status: 401 },
    )
  }

  try {
    const data = await listDashboardApiKeysForRequest(request, session.email)
    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "api_keys_list_failed", detail: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getDashboardSessionSnapshot(request)
  if (!session.authenticated || !session.email) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "Sign in to create API keys.",
      },
      { status: 401 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === "string" ? body.name : undefined
  const prefix = typeof body.prefix === "string" ? body.prefix : undefined
  const permissions = Array.isArray(body.permissions) ? body.permissions : undefined
  const roles = Array.isArray(body.roles) ? body.roles : undefined
  const expires = typeof body.expires === "number" ? body.expires : undefined
  const meta = body.meta && typeof body.meta === "object" && !Array.isArray(body.meta) ? body.meta : undefined

  try {
    const created = await createDashboardApiKey(request, {
      userEmail: session.email,
      name,
      prefix,
      permissions,
      roles,
      expires,
      meta,
    })

    return NextResponse.json({
      data: {
        ...created.record,
        key: created.key,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "api_key_create_failed", detail: message }, { status: 500 })
  }
}
