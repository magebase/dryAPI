import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"

import { verifyCloudflareAccess } from "@/lib/cloudflare-access"
import {
  deleteCmsResourceRecord,
  getCmsResourceRecord,
  isCmsResourceName,
  updateCmsResourceRecord,
} from "@/lib/cms-store"

export const runtime = "nodejs"

function getPayload(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    payload.data &&
    typeof payload.data === "object"
  ) {
    return payload.data as Record<string, unknown>
  }

  return (payload as Record<string, unknown>) ?? {}
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ resource: string; id: string }> }
) {
  const auth = await verifyCloudflareAccess(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { resource, id } = await context.params

  if (!isCmsResourceName(resource)) {
    return NextResponse.json({ error: "Unknown resource" }, { status: 404 })
  }

  const record = await getCmsResourceRecord(resource, id)

  if (!record) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 })
  }

  return NextResponse.json(record)
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ resource: string; id: string }> }
) {
  const auth = await verifyCloudflareAccess(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { resource, id } = await context.params

  if (!isCmsResourceName(resource)) {
    return NextResponse.json({ error: "Unknown resource" }, { status: 404 })
  }

  try {
    const rawPayload = await request.json()
    const record = await updateCmsResourceRecord(resource, id, getPayload(rawPayload))

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 })
    }

    return NextResponse.json(record)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 })
    }

    return NextResponse.json({ error: "Unable to update record" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ resource: string; id: string }> }
) {
  return PUT(request, context)
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ resource: string; id: string }> }
) {
  const auth = await verifyCloudflareAccess(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { resource, id } = await context.params

  if (!isCmsResourceName(resource)) {
    return NextResponse.json({ error: "Unknown resource" }, { status: 404 })
  }

  const record = await deleteCmsResourceRecord(resource, id)

  if (!record) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 })
  }

  return NextResponse.json(record)
}
