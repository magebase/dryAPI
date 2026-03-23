#!/usr/bin/env node

import { pathToFileURL } from "node:url"

type FetchLike = typeof fetch
type EnvLike = Record<string, string | undefined>

type AiSearchInstanceConfig = {
  accountId: string
  apiToken: string
  index: string
  tokenId: string | null
  source: string
  instanceUrl: string
}

type AiSearchInstanceState = {
  id?: unknown
  source?: unknown
  type?: unknown
  token_id?: unknown
}

const ACCOUNT_ID_KEYS = [
  "CLOUDFLARE_AI_SEARCH_ACCOUNT_ID",
  "CLOUDFLARE_AI_SEARCH_SERVICE_CF_API_ID",
]
const API_TOKEN_KEYS = [
  "CLOUDFLARE_AI_SEARCH_API_TOKEN",
  "CLOUDFLARE_AI_SEARCH_MANAGER_TOKEN",
  "CLOUDFLARE_AI_SEARCH_MANAGER_TOKEN_ID",
  "CLOUDFLARE_AI_SEARCH_TOKEN",
  "CLOUDFLARE_AI_SEARCH_TOKEN_ID",
]
const INDEX_KEYS = ["CLOUDFLARE_AI_SEARCH_INDEX", "CLOUDFLARE_AI_SEARCH_NAME"]
const SOURCE_KEYS = [
  "CLOUDFLARE_AI_SEARCH_SOURCE",
  "NEXT_PUBLIC_SITE_URL",
  "SITE_URL",
]
const TOKEN_ID_KEYS = ["CLOUDFLARE_AI_SEARCH_TOKEN_ID"]

function nonEmpty(value: string | undefined): string | null {
  const normalized = value?.trim() || ""
  return normalized.length > 0 ? normalized : null
}

function firstNonEmpty(env: EnvLike, keys: string[]): string | null {
  for (const key of keys) {
    const value = nonEmpty(env[key])
    if (value) {
      return value
    }
  }

  return null
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error("Empty URL values are not allowed.")
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const parsed = new URL(withProtocol)
  return parsed.origin
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeComparableUrl(value: unknown): string {
  const raw = readString(value)
  if (!raw) {
    return ""
  }

  try {
    return normalizeUrl(raw)
  } catch {
    return raw.replace(/\/+$/, "")
  }
}

function readInstanceState(payload: unknown): AiSearchInstanceState | null {
  const record = toRecord(payload)
  if (!record) {
    return null
  }

  const result = toRecord(record.result)
  if (!result) {
    return null
  }

  return result as AiSearchInstanceState
}

function resolveConfig(env: EnvLike = process.env): AiSearchInstanceConfig {
  const accountId = firstNonEmpty(env, ACCOUNT_ID_KEYS)
  if (!accountId) {
    throw new Error(
      `Missing required Cloudflare AI Search account id. Set one of: ${ACCOUNT_ID_KEYS.join(
        ", ",
      )}.`,
    )
  }

  const apiToken = firstNonEmpty(env, API_TOKEN_KEYS)
  if (!apiToken) {
    throw new Error(
      `Missing required Cloudflare AI Search API token. Set one of: ${API_TOKEN_KEYS.join(
        ", ",
      )}.`,
    )
  }

  const index = firstNonEmpty(env, INDEX_KEYS)
  if (!index) {
    throw new Error(
      `Missing required Cloudflare AI Search index. Set one of: ${INDEX_KEYS.join(
        ", ",
      )}.`,
    )
  }

  const sourceRaw = firstNonEmpty(env, SOURCE_KEYS)
  if (!sourceRaw) {
    throw new Error(
      `Missing required Cloudflare AI Search source. Set one of: ${SOURCE_KEYS.join(
        ", ",
      )}.`,
    )
  }

  const source = normalizeUrl(sourceRaw)
  const tokenId = firstNonEmpty(env, TOKEN_ID_KEYS)

  return {
    accountId,
    apiToken,
    index,
    tokenId,
    source,
    instanceUrl: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-search/instances/${encodeURIComponent(
      index,
    )}`,
  }
}

async function readResponseBody(response: Response): Promise<string> {
  return response.text().catch(() => "")
}

async function readInstance(fetchImpl: FetchLike, config: AiSearchInstanceConfig): Promise<AiSearchInstanceState | null> {
  const response = await fetchImpl(config.instanceUrl, {
    method: "GET",
    headers: {
      authorization: `Bearer ${config.apiToken}`,
      accept: "application/json",
    },
    cache: "no-store",
  })

  if (response.status === 404) {
    return null
  }

  const body = await readResponseBody(response)
  if (!response.ok) {
    const suffix = body ? `: ${body.slice(0, 512)}` : ""
    throw new Error(`AI Search instance lookup failed with ${response.status}${suffix}`)
  }

  const parsed = body ? JSON.parse(body) : null
  const state = readInstanceState(parsed)
  if (!state) {
    throw new Error(`AI Search instance lookup returned a malformed response: ${body}`)
  }

  return state
}

function buildDesiredBody(config: AiSearchInstanceConfig): Record<string, string> {
  const body: Record<string, string> = {
    type: "web-crawler",
    source: config.source,
  }

  if (config.tokenId) {
    body.token_id = config.tokenId
  }

  return body
}

function isSameInstance(current: AiSearchInstanceState, config: AiSearchInstanceConfig): boolean {
  return (
    readString(current.type) === "web-crawler" &&
    normalizeComparableUrl(current.source) === config.source &&
    (config.tokenId ? readString(current.token_id) === config.tokenId : true)
  )
}

async function writeInstance(
  fetchImpl: FetchLike,
  config: AiSearchInstanceConfig,
  method: "POST" | "PUT",
): Promise<void> {
  const response = await fetchImpl(method === "POST" ? config.instanceUrl : config.instanceUrl, {
    method,
    headers: {
      authorization: `Bearer ${config.apiToken}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(
      method === "POST"
        ? {
            id: config.index,
            ...buildDesiredBody(config),
          }
        : buildDesiredBody(config),
    ),
    cache: "no-store",
  })

  const body = await readResponseBody(response)
  if (!response.ok) {
    const suffix = body ? `: ${body.slice(0, 512)}` : ""
    throw new Error(`AI Search instance ${method === "POST" ? "creation" : "update"} failed with ${response.status}${suffix}`)
  }

  const parsed = body ? JSON.parse(body) : null
  const state = readInstanceState(parsed)
  if (!state) {
    throw new Error(`AI Search instance ${method === "POST" ? "creation" : "update"} returned a malformed response: ${body}`)
  }
}

export async function ensureAiSearchInstance(args: {
  env?: EnvLike
  fetchImpl?: FetchLike
} = {}): Promise<{ status: "created" | "updated" | "unchanged"; source: string }> {
  const env = args.env ?? process.env
  const fetchImpl = args.fetchImpl ?? fetch
  const config = resolveConfig(env)

  const current = await readInstance(fetchImpl, config)
  if (!current) {
    if (!config.tokenId) {
      throw new Error(
        "Missing CLOUDFLARE_AI_SEARCH_TOKEN_ID. Create the AI Search service token first, then rerun the provisioning step.",
      )
    }

    await writeInstance(fetchImpl, config, "POST")
    return { status: "created", source: config.source }
  }

  if (isSameInstance(current, config)) {
    return { status: "unchanged", source: config.source }
  }

  await writeInstance(fetchImpl, config, "PUT")
  return { status: "updated", source: config.source }
}

async function main(): Promise<void> {
  try {
    const result = await ensureAiSearchInstance()
    console.log(`AI Search instance ${result.status} for ${result.source}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

const isMainModule = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false

if (isMainModule) {
  void main()
}