import "server-only"

import { readFileSync } from "node:fs"
import path from "node:path"

import type { DeapiPricingSnapshot } from "@/types/deapi-pricing"
import runpodManifestJson from "../../cloudflare/clients/runpod/runpod-image-endpoints.manifest.json"

type RunpodManifestEndpoint = {
  endpointId: string
  sourceModel?: {
    slug?: string
    displayName?: string
    tasks?: string[]
  }
}

type RunpodManifest = {
  generatedAt?: string
  endpoints?: RunpodManifestEndpoint[]
}

const RUNPOD_ENDPOINT_PROFILES: Record<string, string[] | null> = {
  all: null,
  serverless10: [
    "acestep-1-5-turbo",
    "bge-m3-fp16",
    "ben2",
    "flux-2-klein-4b-bf16",
    "ltx2-3-22b-dist-int8",
    "nanonets-ocr-s-f16",
    "qwen3-tts-12hz-1-7b-customvoice",
    "realesrgan-x4",
    "whisperlargev3",
    "zimageturbo-int8",
  ],
}

const TASK_TO_CATEGORY: Record<string, string> = {
  "img-rmbg": "background-removal",
  img2img: "image-to-image",
  img2txt: "image-to-text",
  img2video: "image-to-video",
  "img-upscale": "image-upscale",
  txt2embedding: "text-to-embedding",
  txt2img: "text-to-image",
  txt2music: "text-to-music",
  txt2audio: "text-to-speech",
  txt2video: "text-to-video",
  vid2txt: "video-to-text",
  videofile2txt: "video-to-text",
}

export type ActiveRunpodModel = {
  slug: string
  displayName: string
  endpointIds: string[]
  inferenceTypes: string[]
  categories: string[]
}

function readPulumiProfileFromProdStack(): string | null {
  try {
    const filePath = path.join(
      process.cwd(),
      "cloudflare",
      "clients",
      "runpod",
      "pulumi",
      "Pulumi.prod.yaml",
    )
    const content = readFileSync(filePath, "utf8")
    const match = content.match(/runpod-image-endpoints:endpointProfile:\s*([^\n#]+)/)
    const profile = match?.[1]?.trim().replace(/^['"]|['"]$/g, "")

    return profile && profile.length > 0 ? profile : null
  } catch {
    return null
  }
}

function resolveEndpointProfileName(): string {
  const fromEnv = process.env.RUNPOD_ENDPOINT_PROFILE?.trim()
  const fromPulumi = readPulumiProfileFromProdStack()
  const requested = fromEnv || fromPulumi || "serverless10"

  if (requested in RUNPOD_ENDPOINT_PROFILES) {
    return requested
  }

  return "serverless10"
}

function getManifest(): RunpodManifest {
  return runpodManifestJson as RunpodManifest
}

function resolveActiveEndpoints(): RunpodManifestEndpoint[] {
  const manifest = getManifest()
  const allEndpoints = Array.isArray(manifest.endpoints) ? manifest.endpoints : []

  const profileName = resolveEndpointProfileName()
  const profileEndpointIds = RUNPOD_ENDPOINT_PROFILES[profileName]

  if (!profileEndpointIds) {
    return allEndpoints
  }

  const endpointById = new Map(allEndpoints.map((endpoint) => [endpoint.endpointId, endpoint]))

  return profileEndpointIds
    .map((endpointId) => endpointById.get(endpointId) ?? null)
    .filter((endpoint): endpoint is RunpodManifestEndpoint => endpoint !== null)
}

function uniqueByOrder(values: string[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue
    }

    seen.add(value)
    output.push(value)
  }

  return output
}

export function getActiveRunpodModelSlugSet(): Set<string> {
  return new Set(listActiveRunpodModels().map((model) => model.slug))
}

export function listActiveRunpodModels(): ActiveRunpodModel[] {
  const records = new Map<string, ActiveRunpodModel>()

  for (const endpoint of resolveActiveEndpoints()) {
    const slug = endpoint.sourceModel?.slug?.trim()
    if (!slug) {
      continue
    }

    const displayName = endpoint.sourceModel?.displayName?.trim() || slug
    const inferenceTypes = uniqueByOrder((endpoint.sourceModel?.tasks ?? []).map((task) => String(task).trim()))
    const categories = uniqueByOrder(
      inferenceTypes
        .map((task) => TASK_TO_CATEGORY[task] ?? "")
        .filter((category) => category.length > 0),
    )

    const existing = records.get(slug)
    if (existing) {
      existing.endpointIds = uniqueByOrder([...existing.endpointIds, endpoint.endpointId])
      existing.inferenceTypes = uniqueByOrder([...existing.inferenceTypes, ...inferenceTypes])
      existing.categories = uniqueByOrder([...existing.categories, ...categories])
      continue
    }

    records.set(slug, {
      slug,
      displayName,
      endpointIds: endpoint.endpointId ? [endpoint.endpointId] : [],
      inferenceTypes,
      categories,
    })
  }

  return [...records.values()].sort((left, right) => left.slug.localeCompare(right.slug))
}

export function getActiveRunpodModelsGeneratedAt(): string {
  const manifest = getManifest()
  return typeof manifest.generatedAt === "string" && manifest.generatedAt.trim().length > 0
    ? manifest.generatedAt
    : new Date(0).toISOString()
}

export function filterPricingSnapshotToActiveModels(snapshot: DeapiPricingSnapshot): DeapiPricingSnapshot {
  const activeSlugs = getActiveRunpodModelSlugSet()
  const permutations = snapshot.permutations.filter((row) => activeSlugs.has(row.model))

  const categories = [...new Set(permutations.map((row) => row.category))].sort((left, right) => left.localeCompare(right))
  const models = [...new Set(permutations.map((row) => row.model))].sort((left, right) => left.localeCompare(right))

  return {
    ...snapshot,
    categories,
    models,
    permutations,
    metadata: {
      ...snapshot.metadata,
      totalPermutations: permutations.length,
    },
  }
}
