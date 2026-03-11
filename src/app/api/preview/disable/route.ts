import { draftMode } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

function sanitizeSlug(raw: string | null): string {
  if (!raw || raw.trim().length === 0) {
    return "/"
  }

  if (!raw.startsWith("/")) {
    return `/${raw}`
  }

  return raw
}

export async function GET(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = sanitizeSlug(request.nextUrl.searchParams.get("slug"))
  redirectUrl.searchParams.delete("tina")
  redirectUrl.searchParams.delete("slug")

  try {
    const preview = await draftMode()
    preview.disable()
  } catch {
    // Some non-Node runtimes may not fully support draft mode cookies.
  }

  return NextResponse.redirect(redirectUrl)
}
