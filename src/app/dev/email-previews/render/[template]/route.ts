import { render } from "@react-email/render"
import { NextRequest, NextResponse } from "next/server"

import { resolveEmailPreview } from "@/emails/preview-catalog"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    template: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
  }

  const { template } = await context.params
  const brandKey = request.nextUrl.searchParams.get("brand")
  const format = request.nextUrl.searchParams.get("format")

  const preview = await resolveEmailPreview(template, brandKey)
  if (!preview) {
    return NextResponse.json({ ok: false, error: "Unknown template" }, { status: 404 })
  }

  if (format === "text") {
    const text = await render(preview.element, {
      plainText: true,
    })

    return new Response(text, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    })
  }

  const html = await render(preview.element)

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}