import { NextRequest, NextResponse } from "next/server"

import { getUnkeyClient } from "@/lib/unkey"
import { env } from "@/env/server"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const client = getUnkeyClient()
  if (!client) {
    return NextResponse.json(
      { error: "unkey_not_configured", message: "UNKEY_ROOT_KEY is not set" },
      { status: 501 },
    )
  }

  const apiId = env.UNKEY_API_ID || "dryapi"

  try {
    const res = await client.apis.listKeys({ apiId, limit: 200 })
    return NextResponse.json(res)
  } catch (err: any) {
    return NextResponse.json({ error: "unkey_error", detail: err?.message ?? String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const client = getUnkeyClient()
  if (!client) {
    return NextResponse.json(
      { error: "unkey_not_configured", message: "UNKEY_ROOT_KEY is not set" },
      { status: 501 },
    )
  }

  const apiId = env.UNKEY_API_ID || "dryapi"

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === "string" ? body.name : undefined
  const prefix = typeof body.prefix === "string" ? body.prefix : undefined
  const permissions = Array.isArray(body.permissions) ? body.permissions : undefined
  const roles = Array.isArray(body.roles) ? body.roles : undefined

  try {
    const created = await client.keys.createKey({
      apiId,
      name,
      prefix,
      permissions,
      roles,
      enabled: true,
      recoverable: true,
    })

    return NextResponse.json(created)
  } catch (err: any) {
    return NextResponse.json({ error: "unkey_error", detail: err?.message ?? String(err) }, { status: 500 })
  }
}
