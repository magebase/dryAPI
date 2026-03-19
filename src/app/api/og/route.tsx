import { ImageResponse } from "@takumi-rs/image-response/wasm"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { initSync, Renderer } from "@takumi-rs/wasm"
import takumiWasmModule from "@takumi-rs/wasm/next"

import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  OG_QUERY_KEYS,
  type OgTemplateKind,
} from "@/lib/og/metadata"
import { renderTakumiOgTemplate } from "@/lib/og/templates"

export const runtime = "edge"
export const dynamic = "force-dynamic"

const CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"

type R2ObjectLike = {
  arrayBuffer(): Promise<ArrayBuffer>
}

type R2BucketLike = {
  get(key: string): Promise<R2ObjectLike | null>
  put(key: string, value: ArrayBuffer): Promise<void>
}

type EdgeCacheLike = {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
}

let renderer: Renderer | undefined

try {
  initSync(takumiWasmModule)
  renderer = new Renderer()
} catch {
  renderer = undefined
}

function clamp(value: string, maxLength: number, fallback: string): string {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (!normalized) {
    return fallback
  }

  return normalized.slice(0, maxLength)
}

function hashString(value: string): string {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash.toString(16).padStart(8, "0")
}

function readTemplate(raw: string | null): OgTemplateKind {
  if (raw === "pricing" || raw === "dashboard" || raw === "blog") {
    return raw
  }

  return "marketing"
}

function toLabel(template: OgTemplateKind, customLabel: string): string {
  if (customLabel) {
    return customLabel
  }

  if (template === "pricing") {
    return "Pricing Page"
  }

  if (template === "dashboard") {
    return "Dashboard"
  }

  if (template === "blog") {
    return "Blog"
  }

  return "Marketing"
}

function responseHeaders(cacheLayer: "generated" | "edge-hit" | "r2-hit") {
  return {
    "Content-Type": "image/png",
    "Cache-Control": CACHE_CONTROL,
    "X-OG-Cache": cacheLayer,
  }
}

async function getR2Bucket(): Promise<R2BucketLike | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const typedEnv = env as {
      NEXT_INC_CACHE_R2_BUCKET?: R2BucketLike
    }

    return typedEnv.NEXT_INC_CACHE_R2_BUCKET ?? null
  } catch {
    return null
  }
}

function toR2CacheKey(requestUrl: URL): string {
  const normalizedSearch = new URLSearchParams(requestUrl.searchParams)
  normalizedSearch.delete("refresh")

  const cacheSeed = `${requestUrl.pathname}?${normalizedSearch.toString()}`
  return `og/takumi/${hashString(cacheSeed)}.png`
}

async function readFromR2Cache(bucket: R2BucketLike, key: string): Promise<ArrayBuffer | null> {
  const object = await bucket.get(key)
  if (!object) {
    return null
  }

  return object.arrayBuffer()
}

function getEdgeCache(): EdgeCacheLike | null {
  if (typeof caches === "undefined") {
    return null
  }

  const cacheStorage = caches as unknown as {
    default?: EdgeCacheLike
  }

  return cacheStorage.default ?? null
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const template = readTemplate(requestUrl.searchParams.get(OG_QUERY_KEYS.template))

  const title = clamp(requestUrl.searchParams.get(OG_QUERY_KEYS.title) ?? "dryAPI", 140, "dryAPI")
  const description = clamp(
    requestUrl.searchParams.get(OG_QUERY_KEYS.description) ?? "Unified AI inference platform",
    220,
    "Unified AI inference platform",
  )
  const label = clamp(
    toLabel(template, requestUrl.searchParams.get(OG_QUERY_KEYS.label) ?? ""),
    48,
    "Marketing",
  )
  const path = clamp(requestUrl.searchParams.get(OG_QUERY_KEYS.path) ?? "/", 96, "/")
  const brand = clamp(requestUrl.searchParams.get(OG_QUERY_KEYS.brand) ?? "dryAPI", 48, "dryAPI")
  const seed = clamp(
    requestUrl.searchParams.get(OG_QUERY_KEYS.seed) ?? `${template}:${path}:${title}`,
    64,
    `${template}:${path}:${title}`,
  )
  const forceRefresh = requestUrl.searchParams.get("refresh") === "1"

  const cacheKeyRequest = new Request(requestUrl.toString(), { method: "GET" })
  const edgeCache = getEdgeCache()

  if (!forceRefresh && edgeCache) {
    const cached = await edgeCache.match(cacheKeyRequest)
    if (cached) {
      const hit = new Response(cached.body, cached)
      hit.headers.set("X-OG-Cache", "edge-hit")
      return hit
    }
  }

  const r2Bucket = await getR2Bucket()
  const r2CacheKey = toR2CacheKey(requestUrl)

  if (!forceRefresh && r2Bucket) {
    const r2Bytes = await readFromR2Cache(r2Bucket, r2CacheKey)

    if (r2Bytes) {
      const r2Response = new Response(r2Bytes, {
        status: 200,
        headers: responseHeaders("r2-hit"),
      })

      if (edgeCache) {
        await edgeCache.put(cacheKeyRequest, r2Response.clone())
      }

      return r2Response
    }
  }

  const imageNode = renderTakumiOgTemplate({
    template,
    title,
    description,
    label,
    path,
    brand,
    seed,
  })

  if (!renderer) {
    return new Response("Takumi renderer unavailable", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
      },
    })
  }

  const imageResponse = new ImageResponse(imageNode, {
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    format: "png",
    renderer,
  })

  const bytes = await imageResponse.arrayBuffer()
  const generated = new Response(bytes, {
    status: 200,
    headers: responseHeaders("generated"),
  })

  if (edgeCache) {
    await edgeCache.put(cacheKeyRequest, generated.clone())
  }

  if (r2Bucket) {
    await r2Bucket.put(r2CacheKey, bytes)
  }

  return generated
}
