#!/usr/bin/env node

import { pathToFileURL } from "node:url"

type FetchLike = typeof fetch

type AiSearchRecrawlConfig = {
  accountId: string
  apiToken: string
  index: string
  sourceUrls: string[]
  description: string
  jobUrl: string
}

const DEFAULT_SITE_ORIGIN = "https://dryapi.dev"
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

function nonEmpty(value: string | undefined): string | null {
  const normalized = value?.trim() || ""
  return normalized.length > 0 ? normalized : null
}

function firstNonEmpty(env: NodeJS.ProcessEnv, keys: string[]): string | null {
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
  return parsed.toString().replace(/\/+$/, "")
}

function splitUrlList(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values))
}

function resolveSourceUrls(env: NodeJS.ProcessEnv): string[] {
  const explicitSourceUrls = nonEmpty(env.CLOUDFLARE_AI_SEARCH_SOURCE_URLS)
  if (explicitSourceUrls) {
    const sourceUrls = splitUrlList(explicitSourceUrls).map(normalizeUrl)
    if (sourceUrls.length === 0) {
      throw new Error("CLOUDFLARE_AI_SEARCH_SOURCE_URLS cannot be empty.")
    }

    return uniqueValues(sourceUrls)
  }

  const sourceOrigin = normalizeUrl(nonEmpty(env.CLOUDFLARE_AI_SEARCH_SOURCE) ?? DEFAULT_SITE_ORIGIN)
  return uniqueValues([sourceOrigin, `${sourceOrigin}/llms-full.txt`])
}

export function resolveAiSearchRecrawlConfig(
  env: NodeJS.ProcessEnv = process.env,
): AiSearchRecrawlConfig {
  const accountId = firstNonEmpty(env, ACCOUNT_ID_KEYS)
  if (!accountId) {
    throw new Error(
      `Missing required Cloudflare AI Search account id. Set one of: ${ACCOUNT_ID_KEYS.join(", ")}.`,
    )
  }

  const apiToken = firstNonEmpty(env, API_TOKEN_KEYS)
  if (!apiToken) {
    throw new Error(
      `Missing required Cloudflare AI Search API token. Set one of: ${API_TOKEN_KEYS.join(", ")}.`,
    )
  }

  const index = firstNonEmpty(env, INDEX_KEYS)
  if (!index) {
    throw new Error(`Missing required Cloudflare AI Search index. Set one of: ${INDEX_KEYS.join(", ")}.`)
  }

  const sourceUrls = resolveSourceUrls(env)

  return {
    accountId,
    apiToken,
    index,
    sourceUrls,
    description: `Weekly dryAPI recrawl for ${sourceUrls.join(" and ")}`,
    jobUrl: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-search/instances/${encodeURIComponent(index)}/jobs`,
  }
}

async function readResponseBody(response: Response): Promise<string> {
  return response.text().catch(() => "")
}

async function preflightSourceUrl(fetchImpl: FetchLike, sourceUrl: string): Promise<void> {
  const response = await fetchImpl(sourceUrl, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
  })

  if (!response.ok) {
    const body = await readResponseBody(response)
    const suffix = body ? `: ${body.slice(0, 256)}` : ""
    throw new Error(`Source preflight failed for ${sourceUrl} with ${response.status}${suffix}`)
  }

  await response.arrayBuffer().catch(() => undefined)
}

async function createAiSearchIndexingJob(
  fetchImpl: FetchLike,
  config: AiSearchRecrawlConfig,
): Promise<string> {
  const response = await fetchImpl(config.jobUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiToken}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      description: config.description,
    }),
    cache: "no-store",
  })

  const responseBody = await readResponseBody(response)
  if (!response.ok) {
    const suffix = responseBody ? `: ${responseBody.slice(0, 512)}` : ""
    throw new Error(`AI Search indexing job request failed with ${response.status}${suffix}`)
  }

  let payload: unknown
  try {
    payload = JSON.parse(responseBody)
  } catch {
    throw new Error(`AI Search indexing job returned invalid JSON: ${responseBody}`)
  }

  if (!payload || typeof payload !== "object") {
    throw new Error(`AI Search indexing job returned an unexpected payload: ${responseBody}`)
  }

  const typed = payload as {
    success?: boolean
    result?: { id?: unknown }
  }

  if (typed.success !== true || typeof typed.result?.id !== "string" || typed.result.id.trim().length === 0) {
    throw new Error(`AI Search indexing job creation returned a malformed response: ${responseBody}`)
  }

  return typed.result.id
}

export async function runAiSearchRecrawl(args: {
  env?: NodeJS.ProcessEnv
  fetchImpl?: FetchLike
} = {}): Promise<{ jobId: string; sourceUrls: string[] }> {
  const env = args.env ?? process.env
  const fetchImpl = args.fetchImpl ?? fetch
  const config = resolveAiSearchRecrawlConfig(env)

  for (const sourceUrl of config.sourceUrls) {
    await preflightSourceUrl(fetchImpl, sourceUrl)
  }

  const jobId = await createAiSearchIndexingJob(fetchImpl, config)
  return { jobId, sourceUrls: config.sourceUrls }
}

async function main(): Promise<void> {
  try {
    const result = await runAiSearchRecrawl()
    console.log(`Queued Cloudflare AI Search indexing job ${result.jobId} for ${result.sourceUrls.join(", ")}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

const isMainModule = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false

if (isMainModule) {
  void main()
}
