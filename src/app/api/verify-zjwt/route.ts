import { NextRequest, NextResponse } from "next/server"

import { verifyCloudflareAccess } from "@/lib/cloudflare-access"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const auth = await verifyCloudflareAccess(request)

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  return NextResponse.json({
    ok: true,
    email: auth.email,
    subject: typeof auth.payload.sub === "string" ? auth.payload.sub : null,
  })
}
