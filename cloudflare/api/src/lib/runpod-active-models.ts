import runpodManifestJson from '../../../clients/runpod/runpod-image-endpoints.manifest.json'

type RunpodManifestEndpoint = {
  endpointId: string
  sourceModel?: {
    slug?: string
    tasks?: string[]
  }
}

type RunpodManifest = {
  endpoints?: RunpodManifestEndpoint[]
}

const RUNPOD_ENDPOINT_PROFILES: Record<string, string[] | null> = {
  all: null,
  serverless10: [
    'acestep-1-5-turbo',
    'bge-m3-int8',
    'ben2',
    'flux-2-klein-4b-bf16',
    'ltx2-3-22b-dist-int8',
    'nanonets-ocr-s-f16',
    'qwen3-tts-12hz-1-7b-customvoice',
    'realesrgan-x4',
    'whisperlargev3',
    'zimageturbo-int8',
  ],
}

const TASK_TO_SURFACE: Record<string, 'chat' | 'images' | 'embeddings' | 'transcribe' | null> = {
  txt2img: 'images',
  img2img: 'images',
  img2video: 'images',
  aud2video: 'images',
  'img-rmbg': 'images',
  'img-upscale': 'images',
  txt2embedding: 'embeddings',
  vid2txt: 'transcribe',
  videofile2txt: 'transcribe',
  aud2txt: 'transcribe',
  audiofile2txt: 'transcribe',
  txt2audio: null,
  txt2music: null,
  txt2video: null,
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

function getManifest(): RunpodManifest {
  return runpodManifestJson as RunpodManifest
}

function resolveProfileName(): string {
  const requested = 'serverless10'
  return requested in RUNPOD_ENDPOINT_PROFILES ? requested : 'serverless10'
}

function resolveActiveEndpoints(): RunpodManifestEndpoint[] {
  const manifest = getManifest()
  const allEndpoints = Array.isArray(manifest.endpoints) ? manifest.endpoints : []

  const profileName = resolveProfileName()
  const profileEndpointIds = RUNPOD_ENDPOINT_PROFILES[profileName]

  if (!profileEndpointIds) {
    return allEndpoints
  }

  const endpointById = new Map(allEndpoints.map((endpoint) => [endpoint.endpointId, endpoint]))

  return profileEndpointIds
    .map((endpointId) => endpointById.get(endpointId) ?? null)
    .filter((endpoint): endpoint is RunpodManifestEndpoint => endpoint !== null)
}

type ActiveRunpodModel = {
  slug: string
  inferenceTypes: string[]
}

function listActiveModels(): ActiveRunpodModel[] {
  const bySlug = new Map<string, ActiveRunpodModel>()

  for (const endpoint of resolveActiveEndpoints()) {
    const slug = endpoint.sourceModel?.slug?.trim()
    if (!slug) {
      continue
    }

    const inferenceTypes = uniqueByOrder((endpoint.sourceModel?.tasks ?? []).map((task) => String(task).trim()))
    const existing = bySlug.get(slug)

    if (existing) {
      existing.inferenceTypes = uniqueByOrder([...existing.inferenceTypes, ...inferenceTypes])
      continue
    }

    bySlug.set(slug, { slug, inferenceTypes })
  }

  return [...bySlug.values()].sort((left, right) => left.slug.localeCompare(right.slug))
}

export function listActiveRunpodModelSlugs(): string[] {
  return listActiveModels().map((model) => model.slug)
}

export function listActiveRunpodModelSlugsForSurface(surface: 'chat' | 'images' | 'embeddings' | 'transcribe'): string[] {
  return listActiveModels()
    .filter((model) => model.inferenceTypes.some((task) => TASK_TO_SURFACE[task] === surface))
    .map((model) => model.slug)
}
