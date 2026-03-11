import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { verifyCloudflareAccess } from "@/lib/cloudflare-access"
import { isCrmDashboardEnabled, isCrmMailingListSyncEnabled } from "@/lib/feature-flags"

export const runtime = "nodejs"

const mailingListSchema = z.object({
  email: z.string().trim().email(),
  firstName: z.string().trim().optional().default(""),
  lastName: z.string().trim().optional().default(""),
  company: z.string().trim().optional().default(""),
  tags: z.array(z.string().trim()).optional().default([]),
})

const DEFAULT_BREVO_MARKETING_LIST_NAME = "GenFix CRM Leads"

type BrevoListRecord = {
  id: number
  name: string
}

type BrevoListResponse = {
  lists?: BrevoListRecord[]
}

type BrevoFolderRecord = {
  id: number
  name: string
}

type BrevoFolderResponse = {
  folders?: BrevoFolderRecord[]
}

const DEFAULT_BREVO_MARKETING_FOLDER_NAME = "GenFix CRM"

async function resolveBrevoMarketingFolderId({
  apiKey,
}: {
  apiKey: string
}): Promise<number> {
  const configuredFolderRaw = process.env.BREVO_MARKETING_FOLDER_ID?.trim() || ""
  if (configuredFolderRaw) {
    const configuredFolderId = Number(configuredFolderRaw)
    if (!Number.isFinite(configuredFolderId)) {
      throw new Error("BREVO_MARKETING_FOLDER_ID must be a number when set.")
    }
    return configuredFolderId
  }

  const folderName = process.env.BREVO_MARKETING_FOLDER_NAME?.trim() || DEFAULT_BREVO_MARKETING_FOLDER_NAME

  const folderLookupResponse = await fetch("https://api.brevo.com/v3/contacts/folders?limit=50&offset=0", {
    method: "GET",
    headers: {
      "api-key": apiKey,
      accept: "application/json",
    },
    cache: "no-store",
  })

  if (!folderLookupResponse.ok) {
    const details = await folderLookupResponse.text().catch(() => "")
    throw new Error(`Brevo folder lookup failed (${folderLookupResponse.status}). ${details}`)
  }

  const folderLookupBody = (await folderLookupResponse.json().catch(() => ({}))) as BrevoFolderResponse
  const existing = (folderLookupBody.folders || []).find(
    (folder) => folder.name.trim().toLowerCase() === folderName.toLowerCase()
  )

  if (existing && Number.isFinite(existing.id)) {
    return existing.id
  }

  const folderCreateResponse = await fetch("https://api.brevo.com/v3/contacts/folders", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      name: folderName,
    }),
  })

  const folderCreateText = await folderCreateResponse.text().catch(() => "")
  const folderCreateBody = folderCreateText ? (JSON.parse(folderCreateText) as { id?: number }) : {}

  if (!folderCreateResponse.ok || !Number.isFinite(folderCreateBody.id)) {
    throw new Error(`Brevo folder create failed (${folderCreateResponse.status}). ${folderCreateText}`)
  }

  return Number(folderCreateBody.id)
}

async function resolveBrevoMarketingListId({
  apiKey,
}: {
  apiKey: string
}): Promise<number> {
  const configuredIdRaw = process.env.BREVO_MARKETING_LIST_ID?.trim() || ""

  if (configuredIdRaw) {
    const configuredId = Number(configuredIdRaw)
    if (Number.isFinite(configuredId)) {
      return configuredId
    }

    throw new Error("BREVO_MARKETING_LIST_ID must be a number.")
  }

  const listName = process.env.BREVO_MARKETING_LIST_NAME?.trim() || DEFAULT_BREVO_MARKETING_LIST_NAME
  const folderId = await resolveBrevoMarketingFolderId({ apiKey })

  const listLookupResponse = await fetch("https://api.brevo.com/v3/contacts/lists?limit=50&offset=0", {
    method: "GET",
    headers: {
      "api-key": apiKey,
      accept: "application/json",
    },
    cache: "no-store",
  })

  if (!listLookupResponse.ok) {
    const details = await listLookupResponse.text().catch(() => "")
    throw new Error(`Brevo list lookup failed (${listLookupResponse.status}). ${details}`)
  }

  const lookupBody = (await listLookupResponse.json().catch(() => ({}))) as BrevoListResponse
  const existing = (lookupBody.lists || []).find((list) => list.name.trim().toLowerCase() === listName.toLowerCase())

  if (existing && Number.isFinite(existing.id)) {
    return existing.id
  }

  const createResponse = await fetch("https://api.brevo.com/v3/contacts/lists", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      name: listName,
      folderId,
    }),
  })

  const createText = await createResponse.text().catch(() => "")
  const createBody = createText ? (JSON.parse(createText) as { id?: number }) : {}

  if (!createResponse.ok || !Number.isFinite(createBody.id)) {
    throw new Error(`Brevo list create failed (${createResponse.status}). ${createText}`)
  }

  return Number(createBody.id)
}

export async function POST(request: NextRequest) {
  if (!isCrmDashboardEnabled()) {
    return NextResponse.json({ error: "CRM dashboard is disabled." }, { status: 404 })
  }

  if (!isCrmMailingListSyncEnabled()) {
    return NextResponse.json({ error: "CRM mailing list sync is disabled." }, { status: 403 })
  }

  const auth = await verifyCloudflareAccess(request)

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const parsed = mailingListSchema.safeParse(await request.json().catch(() => ({})))

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid mailing-list payload." }, { status: 400 })
  }

  const apiKey = process.env.BREVO_API_KEY?.trim() || ""
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing BREVO_API_KEY.",
      },
      { status: 400 }
    )
  }

  let listId = 0

  try {
    listId = await resolveBrevoMarketingListId({ apiKey })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to resolve Brevo marketing list ID.",
      },
      { status: 502 }
    )
  }

  const response = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      email: parsed.data.email,
      updateEnabled: true,
      listIds: [listId],
      attributes: {
        FIRSTNAME: parsed.data.firstName,
        LASTNAME: parsed.data.lastName,
        COMPANY: parsed.data.company,
      },
      tags: parsed.data.tags,
    }),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => "")
    return NextResponse.json(
      {
        ok: false,
        error: `Brevo contact sync failed (${response.status}).`,
        details,
      },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
