import { NextRequest, NextResponse } from "next/server"

import { getUnkeyClient } from "@/lib/unkey"

export const runtime = "nodejs"

export async function GET(request: NextRequest, { params }: { params: { keyId: string } }) {
  const client = getUnkeyClient()
  if (!client) return NextResponse.json({ error: "unkey_not_configured" }, { status: 501 })

  try {
    const res = await client.keys.getKey({ keyId: params.keyId })
    return NextResponse.json(res)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "unkey_error", detail: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { keyId: string } }) {
  const client = getUnkeyClient()
  if (!client) return NextResponse.json({ error: "unkey_not_configured" }, { status: 501 })

  const body = await request.json().catch(() => ({}))
  const permanent = body?.permanent === true

  try {
    const res = await client.keys.deleteKey({ keyId: params.keyId, permanent })
    return NextResponse.json(res)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "unkey_error", detail: message }, { status: 500 })
  }
}

// POST will reroll (rotate) the key. Body: { expiration: number }
export async function POST(request: NextRequest, { params }: { params: { keyId: string } }) {
  const client = getUnkeyClient()
  if (!client) return NextResponse.json({ error: "unkey_not_configured" }, { status: 501 })

  const body = await request.json().catch(() => ({}))
  const expiration = typeof body?.expiration === "number" ? body.expiration : 0

  try {
    const res = await client.keys.rerollKey({ keyId: params.keyId, expiration })
    return NextResponse.json(res)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "unkey_error", detail: message }, { status: 500 })
  }
}
