import { NextRequest, NextResponse } from "next/server"

import { getDashboardSessionSnapshot } from "@/lib/dashboard-billing"
import {
  deleteDashboardApiKey,
  getDashboardApiKeyForRequest,
  rerollDashboardApiKey,
  setDashboardApiKeyEnabled,
} from "@/lib/dashboard-api-keys-store"

export const runtime = "nodejs"

type KeyRouteContext = {
  params: Promise<{
    keyId: string
  }>
}

export async function GET(request: NextRequest, context: KeyRouteContext) {
  const { keyId } = await context.params
  const session = await getDashboardSessionSnapshot(request)
  if (!session.authenticated || !session.email) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to view API keys." }, { status: 401 })
  }

  try {
    const record = await getDashboardApiKeyForRequest(request, { userEmail: session.email, keyId })
    if (!record) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }

    return NextResponse.json({ data: record })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "api_key_get_failed", detail: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: KeyRouteContext) {
  const { keyId } = await context.params
  const session = await getDashboardSessionSnapshot(request)
  if (!session.authenticated || !session.email) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to delete API keys." }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const permanent = body?.permanent === true

  try {
    const result = await deleteDashboardApiKey(request, {
      userEmail: session.email,
      keyId,
      permanent,
    })

    return NextResponse.json({ data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "api_key_delete_failed", detail: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: KeyRouteContext) {
  const { keyId } = await context.params
  const session = await getDashboardSessionSnapshot(request)
  if (!session.authenticated || !session.email) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to update API keys." }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : undefined

  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "invalid_request", detail: "enabled must be a boolean" }, { status: 400 })
  }

  try {
    const record = await setDashboardApiKeyEnabled(request, {
      userEmail: session.email,
      keyId,
      enabled,
    })
    if (!record) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }

    return NextResponse.json({ data: record })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "api_key_update_failed", detail: message }, { status: 500 })
  }
}

// POST will reroll (rotate) the key. Body: { expiration: number }
export async function POST(request: NextRequest, context: KeyRouteContext) {
  const { keyId } = await context.params
  const session = await getDashboardSessionSnapshot(request)
  if (!session.authenticated || !session.email) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to rotate API keys." }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const expiration = typeof body?.expiration === "number" ? body.expiration : 0

  try {
    const rotated = await rerollDashboardApiKey(request, {
      userEmail: session.email,
      keyId,
      expirationMs: expiration,
    })
    if (!rotated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        ...rotated.record,
        key: rotated.key,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "api_key_rotate_failed", detail: message }, { status: 500 })
  }
}
