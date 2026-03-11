import { NextRequest, NextResponse } from "next/server"

import { getBetterAuthSession, signTinaEditorToken } from "@/lib/tina-editor-auth"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const { session, setCookieHeader } = await getBetterAuthSession(request)
  const idToken = await signTinaEditorToken({
    email: session?.user?.email,
    name: session?.user?.name,
  })

  if (!idToken) {
    const response = NextResponse.json({ id_token: null }, { status: 401 })
    if (setCookieHeader) {
      response.headers.set("set-cookie", setCookieHeader)
    }

    return response
  }

  const response = NextResponse.json({ id_token: idToken }, { status: 200 })
  if (setCookieHeader) {
    response.headers.set("set-cookie", setCookieHeader)
  }

  return response
}
