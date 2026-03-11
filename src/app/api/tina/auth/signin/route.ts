import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const DEFAULT_PROVIDER = "google"

export async function GET(request: NextRequest) {
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") || "/admin/index.html"
  const provider = process.env.TINA_BETTER_AUTH_PROVIDER || DEFAULT_PROVIDER

  const signInResponse = await fetch(new URL("/api/auth/sign-in/social", request.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: request.headers.get("cookie") || "",
      origin: request.nextUrl.origin,
      referer: request.nextUrl.origin,
    },
    body: JSON.stringify({
      provider,
      callbackURL: callbackUrl,
      disableRedirect: true,
    }),
    cache: "no-store",
  })

  const payload = (await signInResponse.json().catch(() => null)) as
    | { url?: string; error?: string }
    | null

  if (!signInResponse.ok || !payload?.url) {
    return NextResponse.json(
      {
        error:
          payload?.error ||
          `Unable to start Better Auth sign-in. Ensure provider \"${provider}\" is configured.`,
      },
      { status: signInResponse.status || 500 }
    )
  }

  const response = NextResponse.redirect(payload.url)
  const setCookie = signInResponse.headers.get("set-cookie")
  if (setCookie) {
    response.headers.set("set-cookie", setCookie)
  }

  return response
}
