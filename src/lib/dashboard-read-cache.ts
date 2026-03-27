import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"

type KvNamespaceLike = {
  get: (key: string, options?: { type?: "text" }) => Promise<string | null>
  put: (
    key: string,
    value: string,
    options?: {
      expiration?: number
      expirationTtl?: number
    },
  ) => Promise<void>
  delete: (key: string) => Promise<void>
}

type CachedEnvelope<T> = {
  cachedAt: number
  data: T
}

type CacheBinding = KvNamespaceLike | null

type ReadDashboardCacheInput<T> = {
  scope: string
  key: string
  ttlSeconds: number
  loader: () => Promise<T>
}

const CACHE_NAMESPACE = "dashboard-read-cache"
const CACHE_VERSION = "v1"
const MIN_TTL_SECONDS = 60
const DEFAULT_GENERATION_CACHE_TTL_MS = 5_000

let cacheBindingPromise: Promise<CacheBinding> | null = null
const generationCache = new Map<string, { expiresAt: number; value: string }>()

export function __resetDashboardReadCacheForTests(): void {
  cacheBindingPromise = null
  generationCache.clear()
}

function normalizeSegment(value: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error("Dashboard cache scope segments must not be empty.")
  }

  return normalized
}

function normalizeScope(scope: string): string {
  const normalized = scope.trim()
  if (!normalized) {
    throw new Error("Dashboard cache scope must not be empty.")
  }

  return normalized
    .split(":")
    .map((segment) => encodeURIComponent(normalizeSegment(segment)))
    .join(":")
}

function normalizeTtlSeconds(ttlSeconds: number): number {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    return MIN_TTL_SECONDS
  }

  return Math.max(MIN_TTL_SECONDS, Math.floor(ttlSeconds))
}

function versionKey(scope: string): string {
  return `${CACHE_NAMESPACE}:${CACHE_VERSION}:version:${scope}`
}

function valueKey(scope: string, generation: string, key: string): string {
  return `${CACHE_NAMESPACE}:${CACHE_VERSION}:value:${scope}:${generation}:${normalizeSegment(key)}`
}

function createGenerationToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

async function resolveCacheBinding(): Promise<CacheBinding> {
  if (cacheBindingPromise) {
    return cacheBindingPromise
  }

  cacheBindingPromise = (async () => {
    try {
      const { env } = await getCloudflareContext({ async: true })
      const binding = (env as Record<string, unknown>).DRIZZLE_CACHE_KV as KvNamespaceLike | null | undefined

      if (!binding) {
        if (process.env.NODE_ENV === "production") {
          throw new Error("Cloudflare KV binding DRIZZLE_CACHE_KV is unavailable for dashboard caching.")
        }

        return null
      }

      return binding
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        throw error
      }

      return null
    }
  })()

  return cacheBindingPromise
}

async function resolveScopeGeneration(binding: KvNamespaceLike, scope: string): Promise<string> {
  const cached = generationCache.get(scope)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const raw = await binding.get(versionKey(scope), { type: "text" })
  const generation = raw?.trim() || "0"

  generationCache.set(scope, {
    value: generation,
    expiresAt: Date.now() + DEFAULT_GENERATION_CACHE_TTL_MS,
  })

  return generation
}

export function buildDashboardReadCacheScope(...segments: string[]): string {
  return segments.map((segment) => normalizeSegment(segment)).join(":")
}

export function dashboardSettingsCacheScope(userEmail: string): string {
  return buildDashboardReadCacheScope("settings", userEmail.trim().toLowerCase())
}

export function dashboardApiKeysCacheScope(userEmail: string): string {
  return buildDashboardReadCacheScope("api-keys", userEmail.trim().toLowerCase())
}

export function dashboardApiKeyUsageCacheScope(userEmail: string, keyId: string): string {
  return buildDashboardReadCacheScope("api-key-usage", userEmail.trim().toLowerCase(), keyId)
}

export function dashboardBillingCacheScope(customerRef: string): string {
  return buildDashboardReadCacheScope("billing", customerRef.trim().toLowerCase())
}

export function dashboardUsageCacheScope(days: number): string {
  return buildDashboardReadCacheScope("usage", String(Math.max(1, Math.floor(days))))
}

export function dashboardSubscriptionCacheScope(email: string): string {
  return buildDashboardReadCacheScope("subscription", email.trim().toLowerCase())
}

export async function readDashboardReadCache<T>(input: ReadDashboardCacheInput<T>): Promise<T> {
  const binding = await resolveCacheBinding()
  if (!binding) {
    return input.loader()
  }

  const scope = normalizeScope(input.scope)
  const generation = await resolveScopeGeneration(binding, scope)
  const storageKey = valueKey(scope, generation, input.key)

  const cached = await binding.get(storageKey, { type: "text" })
  if (cached !== null) {
    try {
      const parsed = JSON.parse(cached) as CachedEnvelope<T>
      if (parsed && typeof parsed === "object" && "data" in parsed) {
        return parsed.data
      }
    } catch {
      await binding.delete(storageKey)
    }
  }

  const data = await input.loader()

  await binding.put(
    storageKey,
    JSON.stringify({
      cachedAt: Date.now(),
      data,
    } satisfies CachedEnvelope<T>),
    { expirationTtl: normalizeTtlSeconds(input.ttlSeconds) },
  )

  return data
}

export async function invalidateDashboardReadCacheScope(scope: string): Promise<void> {
  const binding = await resolveCacheBinding()
  if (!binding) {
    return
  }

  const normalizedScope = normalizeScope(scope)
  const generation = createGenerationToken()

  generationCache.set(normalizedScope, {
    value: generation,
    expiresAt: Date.now() + DEFAULT_GENERATION_CACHE_TTL_MS,
  })

  await binding.put(versionKey(normalizedScope), generation, {
    expirationTtl: 60 * 60 * 24 * 7,
  })
}