import { NextRequest, NextResponse } from "next/server"

import { getBetterAuthSession, isTinaEditorEmailAllowed } from "@/lib/tina-editor-auth"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const { session, setCookieHeader } = await getBetterAuthSession(request)
  const email = session?.user?.email

  if (!email || !isTinaEditorEmailAllowed(email)) {
    const response = NextResponse.json({ user: null }, { status: 401 })
    if (setCookieHeader) {
      response.headers.set("set-cookie", setCookieHeader)
    }

    return response
  }

  const response = NextResponse.json(
    {
      user: {
        email,
        name: session.user?.name || email,
      },
    },
    { status: 200 }
  )

  if (setCookieHeader) {
    response.headers.set("set-cookie", setCookieHeader)
  }

  return response
}
