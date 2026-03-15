import type { AppContext, RunpodJobMode, RunpodSurface, WorkerBindings } from '../types'
import { RUNPOD_SURFACES } from '../types'
import { Type } from 'typebox'
import { Compile } from 'typebox/compile'

import { isObjectRecord, safeParseJson } from './validation'

type RunpodEndpointMap = {
  surfaces?: Record<string, string>
  models?: Record<string, string>
  [key: string]: unknown
}

const RunpodEndpointMapSchema = Type.Object(
  {
    surfaces: Type.Optional(Type.Record(Type.String(), Type.String())),
    models: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: true },
)

const RunpodResponseSchema = Type.Object(
  {
    id: Type.Optional(Type.String()),
    jobId: Type.Optional(Type.String()),
    request_id: Type.Optional(Type.String()),
    status: Type.Optional(Type.String()),
    output: Type.Optional(
      Type.Object(
        {
          id: Type.Optional(Type.String()),
          jobId: Type.Optional(Type.String()),
        },
        { additionalProperties: true },
      ),
    ),
  },
  { additionalProperties: true },
)

const endpointMapValidator = Compile(RunpodEndpointMapSchema)
const runpodResponseValidator = Compile(RunpodResponseSchema)

const SURFACE_ENDPOINT_ENV_KEY: Record<RunpodSurface, string> = {
  chat: 'RUNPOD_ENDPOINT_ID_CHAT',
  images: 'RUNPOD_ENDPOINT_ID_IMAGES',
  embeddings: 'RUNPOD_ENDPOINT_ID_EMBEDDINGS',
  transcribe: 'RUNPOD_ENDPOINT_ID_TRANSCRIBE',
}

function getBindings(c: AppContext): WorkerBindings {
  return c.env as WorkerBindings
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized === '' ? null : normalized
}

function parseEndpointMap(raw: unknown): RunpodEndpointMap {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return {}
  }

  const parsed = safeParseJson(raw)
  if (!endpointMapValidator.Check(parsed)) {
    return {}
  }

  return parsed
}

function resolveEndpointFromMap(map: RunpodEndpointMap, surface: RunpodSurface, model: string | null): string | null {
  if (model && isObjectRecord(map.models) && typeof map.models[model] === 'string') {
    return toNonEmptyString(map.models[model])
  }

  if (isObjectRecord(map.surfaces) && typeof map.surfaces[surface] === 'string') {
    return toNonEmptyString(map.surfaces[surface])
  }

  if (model && typeof map[model] === 'string') {
    return toNonEmptyString(map[model])
  }

  if (typeof map[surface] === 'string') {
    return toNonEmptyString(map[surface])
  }

  return null
}

export function resolveRunpodSurface(raw: string | null | undefined): RunpodSurface | null {
  if (!raw) {
    return null
  }

  const normalized = raw.trim().toLowerCase()
  return RUNPOD_SURFACES.includes(normalized as RunpodSurface) ? (normalized as RunpodSurface) : null
}

export function resolveRunpodMode(c: AppContext, surface: RunpodSurface): RunpodJobMode {
  const bindings = getBindings(c)
  const perSurfaceKey = `RUNPOD_${surface.toUpperCase()}_MODE`
  const preferred = toNonEmptyString(bindings[perSurfaceKey]) ?? toNonEmptyString(bindings.RUNPOD_DEFAULT_MODE)
  return preferred === 'run' || preferred === 'runsync' ? preferred : 'run'
}

export function resolveRunpodEndpointId(args: {
  c: AppContext
  surface: RunpodSurface
  model?: string | null
  explicitEndpointId?: string | null
}): string | null {
  const bindings = getBindings(args.c)

  const explicit = toNonEmptyString(args.explicitEndpointId)
  if (explicit) {
    return explicit
  }

  const endpointMap = parseEndpointMap(bindings.RUNPOD_ENDPOINT_MAP_JSON)
  const fromMap = resolveEndpointFromMap(endpointMap, args.surface, toNonEmptyString(args.model))
  if (fromMap) {
    return fromMap
  }

  const envKey = SURFACE_ENDPOINT_ENV_KEY[args.surface]
  return toNonEmptyString(bindings[envKey])
}

export function buildRunpodJobPayload(body: Record<string, unknown>): Record<string, unknown> {
  if (isObjectRecord(body.input)) {
    return {
      input: body.input,
      ...(typeof body.webhook === 'string' ? { webhook: body.webhook } : {}),
      ...(isObjectRecord(body.policy) ? { policy: body.policy } : {}),
      ...(isObjectRecord(body.s3Config) ? { s3Config: body.s3Config } : {}),
    }
  }

  const sanitizedInput = { ...body }
  delete sanitizedInput.endpointId

  return {
    input: sanitizedInput,
  }
}

function getRunpodApiBaseUrl(bindings: WorkerBindings): string {
  const configured = toNonEmptyString(bindings.RUNPOD_API_BASE_URL)
  return configured ?? 'https://api.runpod.ai/v2'
}

function getRunpodApiKey(bindings: WorkerBindings): string | null {
  return toNonEmptyString(bindings.RUNPOD_API_KEY)
}

function buildRunpodUrl(c: AppContext, endpointId: string, operationPath: string): string {
  const bindings = getBindings(c)
  const base = getRunpodApiBaseUrl(bindings).replace(/\/+$/, '')
  const url = new URL(`${base}/${endpointId}/${operationPath}`)
  const incoming = new URL(c.req.url)

  incoming.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value)
  })

  return url.toString()
}

export async function dispatchRunpodRequest(args: {
  c: AppContext
  endpointId: string
  operationPath: string
  method: 'GET' | 'POST'
  body?: unknown
}): Promise<Response> {
  const bindings = getBindings(args.c)
  const apiKey = getRunpodApiKey(bindings)

  if (!apiKey) {
    throw new Error('RunPod API key is not configured')
  }

  const headers = new Headers({
    authorization: `Bearer ${apiKey}`,
  })

  let body: string | undefined
  if (typeof args.body !== 'undefined') {
    headers.set('content-type', 'application/json')
    body = JSON.stringify(args.body)
  }

  const upstream = await fetch(buildRunpodUrl(args.c, args.endpointId, args.operationPath), {
    method: args.method,
    headers,
    body,
  })

  const responseHeaders = new Headers(upstream.headers)
  responseHeaders.set('x-runpod-endpoint-id', args.endpointId)
  responseHeaders.set('x-runpod-operation', args.operationPath)

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export function extractRunpodJobId(payload: unknown): string | null {
  if (!runpodResponseValidator.Check(payload)) {
    return null
  }

  const fromTopLevel = toNonEmptyString(payload.id) ?? toNonEmptyString(payload.jobId) ?? toNonEmptyString(payload.request_id)
  if (fromTopLevel) {
    return fromTopLevel
  }

  if (payload.output) {
    return toNonEmptyString(payload.output.id) ?? toNonEmptyString(payload.output.jobId) ?? null
  }

  return null
}

export function extractRunpodStatus(payload: unknown): string | null {
  if (!runpodResponseValidator.Check(payload)) {
    return null
  }

  return toNonEmptyString(payload.status)
}
