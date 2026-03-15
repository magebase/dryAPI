import { NextRequest, NextResponse } from "next/server"

import { getUnkeyClient } from "@/lib/unkey"

export const runtime = "nodejs"

export async function GET(request: NextRequest, { params }: { params: { keyId: string } }) {
  const client = getUnkeyClient()
  if (!client) return NextResponse.json({ error: "unkey_not_configured" }, { status: 501 })

  try {
    const q = `SELECT MAX(time) as last_used, COUNT(*) as total_24h FROM key_verifications_v1 WHERE keyId = '${params.keyId}' AND time >= now() - INTERVAL 24 HOUR`
    const res = await client.analytics.getVerifications({ query: q })
    return NextResponse.json(res)
  } catch (err: any) {
    return NextResponse.json({ error: "unkey_error", detail: err?.message ?? String(err) }, { status: 500 })
  }
}
