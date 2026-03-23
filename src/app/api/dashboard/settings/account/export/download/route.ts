import { NextResponse } from "next/server"

import {
  verifyAccountExportDownloadToken,
} from "@/lib/account-export-tokens"
import { readPrivateObjectFromR2 } from "@/lib/r2-storage"

function sanitizeContentDispositionFileName(fileName: string): string {
  return fileName.replace(/["\\\r\n]/g, "_")
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const downloadToken = requestUrl.searchParams.get("downloadToken")?.trim() || ""

  if (!downloadToken) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: "A valid download token is required.",
      },
      { status: 400 },
    )
  }

  try {
    const payload = await verifyAccountExportDownloadToken(downloadToken)
    const object = await readPrivateObjectFromR2(payload.zipKey)

    if (!object) {
      return NextResponse.json(
        {
          error: "export_not_found",
          message: "The requested account export is no longer available.",
        },
        { status: 404 },
      )
    }

    const headers = new Headers()
    headers.set("Cache-Control", "no-store")
    headers.set("Content-Type", object.httpMetadata?.contentType || "application/zip")
    headers.set(
      "Content-Disposition",
      `attachment; filename="${sanitizeContentDispositionFileName(payload.zipFileName)}"`,
    )
    headers.set("X-Content-Type-Options", "nosniff")

    return new Response(object.body, {
      status: 200,
      headers,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "export_download_failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 403 },
    )
  }
}