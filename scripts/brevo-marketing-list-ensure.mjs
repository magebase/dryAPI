#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs"

const BREVO_API_BASE = "https://api.brevo.com/v3"
const DEFAULT_LIST_NAME = "GenFix CRM Leads"
const DEFAULT_FOLDER_NAME = "GenFix CRM"

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return
  }

  const content = readFileSync(filePath, "utf8")
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const index = trimmed.indexOf("=")
    if (index <= 0) {
      continue
    }

    const key = trimmed.slice(0, index).trim()
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
      continue
    }

    process.env[key] = trimmed.slice(index + 1)
  }
}

function clean(value) {
  return typeof value === "string" ? value.trim().replace(/^['\"]|['\"]$/g, "") : ""
}

async function brevoRequest(apiKey, path, init = {}) {
  const response = await fetch(`${BREVO_API_BASE}${path}`, {
    ...init,
    headers: {
      "api-key": apiKey,
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  })

  const text = await response.text().catch(() => "")
  const data = text ? JSON.parse(text) : {}

  if (!response.ok) {
    throw new Error(`Brevo ${path} failed (${response.status}): ${text}`)
  }

  return data
}

async function ensureMarketingList({ apiKey, listName, folderId }) {
  const listResponse = await brevoRequest(apiKey, "/contacts/lists?limit=50&offset=0")
  const lists = Array.isArray(listResponse.lists) ? listResponse.lists : []

  const existing = lists.find((item) => clean(item?.name).toLowerCase() === listName.toLowerCase())
  if (existing?.id) {
    return {
      id: Number(existing.id),
      created: false,
      name: existing.name,
    }
  }

  const payload = {
    name: listName,
    ...(Number.isFinite(folderId) ? { folderId } : {}),
  }

  const created = await brevoRequest(apiKey, "/contacts/lists", {
    method: "POST",
    body: JSON.stringify(payload),
  })

  return {
    id: Number(created.id),
    created: true,
    name: listName,
  }
}

async function ensureFolder({ apiKey, folderName }) {
  const folderResponse = await brevoRequest(apiKey, "/contacts/folders?limit=50&offset=0")
  const folders = Array.isArray(folderResponse.folders) ? folderResponse.folders : []

  const existing = folders.find((item) => clean(item?.name).toLowerCase() === folderName.toLowerCase())
  if (existing?.id) {
    return {
      id: Number(existing.id),
      created: false,
      name: existing.name,
    }
  }

  const created = await brevoRequest(apiKey, "/contacts/folders", {
    method: "POST",
    body: JSON.stringify({
      name: folderName,
    }),
  })

  return {
    id: Number(created.id),
    created: true,
    name: folderName,
  }
}

async function main() {
  loadEnvFile(".env")
  loadEnvFile(".env.local")

  const apiKey = clean(process.env.BREVO_API_KEY)
  if (!apiKey) {
    throw new Error("BREVO_API_KEY is required.")
  }

  const listName = clean(process.env.BREVO_MARKETING_LIST_NAME) || DEFAULT_LIST_NAME
  const folderIdRaw = clean(process.env.BREVO_MARKETING_FOLDER_ID)
  const folderName = clean(process.env.BREVO_MARKETING_FOLDER_NAME) || DEFAULT_FOLDER_NAME

  let folderId = Number.NaN
  let folder = null

  if (folderIdRaw) {
    folderId = Number(folderIdRaw)
    if (!Number.isFinite(folderId)) {
      throw new Error("BREVO_MARKETING_FOLDER_ID must be numeric when set.")
    }
  } else {
    folder = await ensureFolder({ apiKey, folderName })
    folderId = folder.id
  }

  const result = await ensureMarketingList({
    apiKey,
    listName,
    folderId,
  })

  console.log(
    JSON.stringify(
      {
        folder,
        list: result,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
