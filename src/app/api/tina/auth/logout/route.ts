import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const signOutResponse = await fetch(new URL("/api/auth/sign-out", request.url), {
    method: "POST",
    headers: {
      cookie: request.headers.get("cookie") || "",
      origin: request.nextUrl.origin,
      referer: request.nextUrl.origin,
    },
    cache: "no-store",
  })

  const response = NextResponse.json({ ok: signOutResponse.ok }, { status: signOutResponse.ok ? 200 : 500 })

  const setCookie = signOutResponse.headers.get("set-cookie")
  if (setCookie) {
    response.headers.set("set-cookie", setCookie)
  }

  return response
}
