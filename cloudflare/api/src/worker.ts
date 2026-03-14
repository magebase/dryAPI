import { Context, Hono } from 'hono'
import { z } from 'zod'

type WorkerBindings = {
  API_KEY?: string
  ORIGIN_URL?: string
  INTERNAL_API_KEY?: string
  RUNPOD_API_KEY?: string
  RUNPOD_API_BASE_URL?: string
  RUNPOD_DEFAULT_MODE?: string
  RUNPOD_CHAT_MODE?: string
  RUNPOD_IMAGES_MODE?: string
  RUNPOD_EMBEDDINGS_MODE?: string
  RUNPOD_TRANSCRIBE_MODE?: string
  RUNPOD_ENDPOINT_ID_CHAT?: string
  RUNPOD_ENDPOINT_ID_IMAGES?: string
  RUNPOD_ENDPOINT_ID_EMBEDDINGS?: string
  RUNPOD_ENDPOINT_ID_TRANSCRIBE?: string
  RUNPOD_ENDPOINT_MAP_JSON?: string
  [key: string]: string | undefined
}

type WorkerEnv = {
  Bindings: WorkerBindings
}

type AppContext = Context<WorkerEnv>

const app = new Hono<WorkerEnv>()

const RUNPOD_SURFACES = ['chat', 'images', 'embeddings', 'transcribe'] as const

type RunpodSurface = (typeof RUNPOD_SURFACES)[number]
type RunpodJobMode = 'run' | 'runsync'

type RunpodEndpointMap = {
  surfaces?: Record<string, string>
  models?: Record<string, string>
  [key: string]: unknown
}

const runpodSurfaceSchema = z.enum(RUNPOD_SURFACES)

const runpodRequestSchema = z
  .object({
    endpointId: z.string().trim().optional(),
    model: z.string().trim().optional(),
    input: z.record(z.string(), z.unknown()).optional(),
    webhook: z.string().url().optional(),
    policy: z.record(z.string(), z.unknown()).optional(),
    s3Config: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()

const RUNPOD_SURFACE_ENDPOINT_ENV: Record<RunpodSurface, string> = {
  chat: 'RUNPOD_ENDPOINT_ID_CHAT',
  images: 'RUNPOD_ENDPOINT_ID_IMAGES',
  embeddings: 'RUNPOD_ENDPOINT_ID_EMBEDDINGS',
  transcribe: 'RUNPOD_ENDPOINT_ID_TRANSCRIBE',
}

// Basic CORS + preflight
app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*')
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  c.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  if (c.req.method === 'OPTIONS') return c.text('', 204)
  await next()
})

// Simple request logger
app.use('*', async (c, next) => {
  try {
    console.log('[hono] %s %s', c.req.method, c.req.url)
  } catch {}
  return next()
})

// Auth middleware for v1 routes
app.use('/v1/*', async (c, next) => {
  const auth = c.req.headers.get('authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  const expected = c.env.API_KEY || ''
  if (!token || token === '' || token !== expected) {
    return c.json({ error: { message: 'Unauthorized' } }, 401)
  }
  return next()
})

// Zod schemas (simple, mirror of existing shapes)
const chatMessageSchema = z.object({ role: z.enum(['system', 'user', 'assistant']), content: z.string().min(1) })
const chatRequestSchema = z.object({ model: z.string().optional(), messages: z.array(chatMessageSchema).min(1) })

const imageRequestSchema = z.object({ model: z.string().optional(), prompt: z.string().min(1), n: z.number().int().positive().max(8).optional().default(1) })

const embeddingRequestSchema = z.object({ model: z.string().optional(), input: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]) })

const transcribeRequestSchema = z.object({ model: z.string().optional(), audioUrl: z.string().url() })

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanString(value: string | undefined | null): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized === '' ? null : normalized
}

function parseRunpodEndpointMap(raw: unknown): RunpodEndpointMap {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return {}
  }

  try {
    const parsed = JSON.parse(raw)
    return isObjectRecord(parsed) ? (parsed as RunpodEndpointMap) : {}
  } catch {
    return {}
  }
}

function resolveRunpodEndpointFromMap(map: RunpodEndpointMap, surface: RunpodSurface, model: string | null): string | null {
  if (model && isObjectRecord(map.models) && typeof map.models[model] === 'string') {
    return cleanString(map.models[model])
  }

  if (isObjectRecord(map.surfaces) && typeof map.surfaces[surface] === 'string') {
    return cleanString(map.surfaces[surface])
  }

  if (model && typeof map[model] === 'string') {
    return cleanString(map[model] as string)
  }

  if (typeof map[surface] === 'string') {
    return cleanString(map[surface] as string)
  }

  return null
}

function resolveRunpodEndpointId(args: {
  env: Record<string, unknown>
  surface: RunpodSurface
  model?: string | null
  explicitEndpointId?: string | null
}): string | null {
  const explicitEndpointId = cleanString(args.explicitEndpointId)
  if (explicitEndpointId) {
    return explicitEndpointId
  }

  const endpointMap = parseRunpodEndpointMap(args.env.RUNPOD_ENDPOINT_MAP_JSON)
  const fromMap = resolveRunpodEndpointFromMap(endpointMap, args.surface, cleanString(args.model))
  if (fromMap) {
    return fromMap
  }

  const surfaceEnvKey = RUNPOD_SURFACE_ENDPOINT_ENV[args.surface]
  const fromSurfaceEnv = cleanString(args.env[surfaceEnvKey] as string | undefined)
  if (fromSurfaceEnv) {
    return fromSurfaceEnv
  }

  return null
}

function getRunpodApiBaseUrl(env: Record<string, unknown>): string {
  return cleanString(env.RUNPOD_API_BASE_URL as string | undefined) ?? 'https://api.runpod.ai/v2'
}

function getRunpodApiKey(env: Record<string, unknown>): string | null {
  return cleanString(env.RUNPOD_API_KEY as string | undefined)
}

function getRunpodDefaultMode(env: Record<string, unknown>, surface: RunpodSurface): RunpodJobMode {
  const perSurfaceEnv = `RUNPOD_${surface.toUpperCase()}_MODE`
  const raw = cleanString((env[perSurfaceEnv] as string | undefined) ?? (env.RUNPOD_DEFAULT_MODE as string | undefined))

  if (raw === 'run' || raw === 'runsync') {
    return raw
  }

  return 'runsync'
}

function buildRunpodJobPayload(body: Record<string, unknown>): Record<string, unknown> {
  const parsed = runpodRequestSchema.safeParse(body)
  if (!parsed.success) {
    return { input: body }
  }

  const payload: Record<string, unknown> = {}

  if (parsed.data.input && isObjectRecord(parsed.data.input)) {
    payload.input = parsed.data.input
  } else {
    const sanitizedInput = { ...body }
    delete sanitizedInput.endpointId
    payload.input = sanitizedInput
  }

  if (parsed.data.webhook) {
    payload.webhook = parsed.data.webhook
  }

  if (parsed.data.policy && isObjectRecord(parsed.data.policy)) {
    payload.policy = parsed.data.policy
  }

  if (parsed.data.s3Config && isObjectRecord(parsed.data.s3Config)) {
    payload.s3Config = parsed.data.s3Config
  }

  return payload
}

function resolveRunpodSurface(c: AppContext): RunpodSurface | null {
  const parsed = runpodSurfaceSchema.safeParse(c.req.param('surface'))
  return parsed.success ? parsed.data : null
}

function buildRunpodUrl(c: AppContext, endpointId: string, operationPath: string): string {
  const env = c.env as Record<string, unknown>
  const baseUrl = getRunpodApiBaseUrl(env).replace(/\/+$/, '')
  const url = new URL(`${baseUrl}/${endpointId}/${operationPath}`)
  const incoming = new URL(c.req.url)

  // Pass through query params (e.g. wait, ttl) directly to RunPod.
  incoming.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value)
  })

  return url.toString()
}

async function dispatchRunpodRequest(args: {
  c: AppContext
  endpointId: string
  operationPath: string
  method: 'GET' | 'POST'
  body?: unknown
}): Promise<Response> {
  const env = args.c.env as Record<string, unknown>
  const apiKey = getRunpodApiKey(env)

  if (!apiKey) {
    return args.c.json({ error: { message: 'RunPod API key is not configured' } }, 500)
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

async function tryDispatchRunpodDirect(args: {
  c: AppContext
  surface: RunpodSurface
  requestBody: Record<string, unknown>
  requestedModel?: string | null
  explicitEndpointId?: string | null
  mode?: RunpodJobMode
}): Promise<Response | null> {
  const env = args.c.env as Record<string, unknown>
  if (!getRunpodApiKey(env)) {
    return null
  }

  const endpointId = resolveRunpodEndpointId({
    env,
    surface: args.surface,
    model: args.requestedModel,
    explicitEndpointId: args.explicitEndpointId,
  })

  if (!endpointId) {
    return null
  }

  const operationMode = args.mode ?? getRunpodDefaultMode(env, args.surface)

  return dispatchRunpodRequest({
    c: args.c,
    endpointId,
    operationPath: operationMode,
    method: 'POST',
    body: {
      input: args.requestBody,
    },
  })
}

function getRunpodOperationEndpointId(args: {
  c: AppContext
  surface: RunpodSurface
  model?: string | null
  explicitEndpointId?: string | null
}): string | null {
  return resolveRunpodEndpointId({
    env: args.c.env as Record<string, unknown>,
    surface: args.surface,
    model: args.model,
    explicitEndpointId: args.explicitEndpointId,
  })
}

// Minimal, hand-written OpenAPI descriptor for the public docs viewer
const OPENAPI = {
  openapi: '3.0.0',
  info: { title: 'DryAPI (Hono) Gateway', version: '2026-03-14-runpod' },
  servers: [{ url: '/' }],
  paths: {
    '/v1/chat/completions': {
      post: {
        summary: 'Chat completions (OpenAI/OpenRouter compatible)',
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '200': { description: 'Chat response' } },
      },
    },
    '/v1/images/generations': {
      post: { summary: 'Image generation', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Image job queued' } } },
    },
    '/v1/audio/transcriptions': {
      post: { summary: 'Audio transcription', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Transcription response' } } },
    },
    '/v1/embeddings': {
      post: { summary: 'Embeddings', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Embeddings response' } } },
    },
    '/v1/runpod/{surface}/run': {
      post: { summary: 'Submit async RunPod job', responses: { '200': { description: 'RunPod /run response' } } },
    },
    '/v1/runpod/{surface}/runsync': {
      post: { summary: 'Submit sync RunPod job', responses: { '200': { description: 'RunPod /runsync response' } } },
    },
    '/v1/runpod/{surface}/status/{jobId}': {
      get: { summary: 'Get RunPod job status', responses: { '200': { description: 'RunPod /status response' } } },
    },
    '/v1/runpod/{surface}/stream/{jobId}': {
      get: { summary: 'Stream RunPod job output', responses: { '200': { description: 'RunPod /stream response' } } },
    },
    '/v1/runpod/{surface}/cancel/{jobId}': {
      post: { summary: 'Cancel RunPod job', responses: { '200': { description: 'RunPod /cancel response' } } },
    },
    '/v1/runpod/{surface}/retry/{jobId}': {
      post: { summary: 'Retry RunPod job', responses: { '200': { description: 'RunPod /retry response' } } },
    },
    '/v1/runpod/{surface}/purge-queue': {
      post: { summary: 'Purge pending RunPod jobs', responses: { '200': { description: 'RunPod /purge-queue response' } } },
    },
    '/v1/runpod/{surface}/health': {
      get: { summary: 'Get RunPod endpoint health', responses: { '200': { description: 'RunPod /health response' } } },
    },
  },
}

app.get('/openapi.json', (c) => c.json(OPENAPI))

// Helper to proxy to origin Next API
async function proxyToOrigin(c: AppContext, path: string) {
  const origin = c.env.ORIGIN_URL || ''
  if (!origin) return c.json({ error: { message: 'Origin not configured' } }, 500)

  const init: RequestInit = {
    method: c.req.method,
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${c.env.INTERNAL_API_KEY || ''}` },
    body: undefined,
  }

  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    const body = await c.req.json().catch(() => null)
    init.body = body ? JSON.stringify(body) : null
  }

  const upstream = await fetch(new URL(path, origin).toString(), init)
  const text = await upstream.text()
  const headers = new Headers()
  upstream.headers.forEach((v, k) => headers.set(k, v))
  return new Response(text, { status: upstream.status, headers })
}

app.post('/v1/chat/completions', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = chatRequestSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: { message: 'invalid_request' } }, 400)

  const runpodResponse = await tryDispatchRunpodDirect({
    c,
    surface: 'chat',
    requestBody: parsed.data,
    requestedModel: parsed.data.model ?? null,
  })
  if (runpodResponse) {
    return runpodResponse
  }

  return proxyToOrigin(c, '/api/v1/chat')
})

app.post('/v1/images/generations', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = imageRequestSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: { message: 'invalid_request' } }, 400)

  const runpodResponse = await tryDispatchRunpodDirect({
    c,
    surface: 'images',
    requestBody: parsed.data,
    requestedModel: parsed.data.model ?? null,
  })
  if (runpodResponse) {
    return runpodResponse
  }

  return proxyToOrigin(c, '/api/v1/images')
})

app.post('/v1/embeddings', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = embeddingRequestSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: { message: 'invalid_request' } }, 400)

  const runpodResponse = await tryDispatchRunpodDirect({
    c,
    surface: 'embeddings',
    requestBody: parsed.data,
    requestedModel: parsed.data.model ?? null,
  })
  if (runpodResponse) {
    return runpodResponse
  }

  return proxyToOrigin(c, '/api/v1/embeddings')
})

app.post('/v1/audio/transcriptions', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = transcribeRequestSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: { message: 'invalid_request' } }, 400)

  const runpodResponse = await tryDispatchRunpodDirect({
    c,
    surface: 'transcribe',
    requestBody: parsed.data,
    requestedModel: parsed.data.model ?? null,
  })
  if (runpodResponse) {
    return runpodResponse
  }

  return proxyToOrigin(c, '/api/v1/transcribe')
})

app.post('/v1/runpod/:surface/run', async (c) => {
  const surface = resolveRunpodSurface(c)
  if (!surface) {
    return c.json({ error: { message: 'invalid_surface' } }, 400)
  }

  const body = (await c.req.json().catch(() => null)) as unknown
  if (!isObjectRecord(body)) {
    return c.json({ error: { message: 'invalid_request' } }, 400)
  }

  const endpointId = getRunpodOperationEndpointId({
    c,
    surface,
    model: cleanString(body.model as string | undefined),
    explicitEndpointId: cleanString(c.req.query('endpointId')) ?? cleanString(body.endpointId as string | undefined),
  })

  if (!endpointId) {
    return c.json({ error: { message: 'missing_endpoint_id' } }, 400)
  }

  return dispatchRunpodRequest({
    c,
    endpointId,
    operationPath: 'run',
    method: 'POST',
    body: buildRunpodJobPayload(body),
  })
})

app.post('/v1/runpod/:surface/runsync', async (c) => {
  const surface = resolveRunpodSurface(c)
  if (!surface) {
    return c.json({ error: { message: 'invalid_surface' } }, 400)
  }

  const body = (await c.req.json().catch(() => null)) as unknown
  if (!isObjectRecord(body)) {
    return c.json({ error: { message: 'invalid_request' } }, 400)
  }

  const endpointId = getRunpodOperationEndpointId({
    c,
    surface,
    model: cleanString(body.model as string | undefined),
    explicitEndpointId: cleanString(c.req.query('endpointId')) ?? cleanString(body.endpointId as string | undefined),
  })

  if (!endpointId) {
    return c.json({ error: { message: 'missing_endpoint_id' } }, 400)
  }

  return dispatchRunpodRequest({
    c,
    endpointId,
    operationPath: 'runsync',
    method: 'POST',
    body: buildRunpodJobPayload(body),
  })
})

app.get('/v1/runpod/:surface/status/:jobId', async (c) => {
  const surface = resolveRunpodSurface(c)
  if (!surface) {
    return c.json({ error: { message: 'invalid_surface' } }, 400)
  }

  const endpointId = getRunpodOperationEndpointId({
    c,
    surface,
    explicitEndpointId: cleanString(c.req.query('endpointId')),
  })

  if (!endpointId) {
    return c.json({ error: { message: 'missing_endpoint_id' } }, 400)
  }

  const jobId = cleanString(c.req.param('jobId'))
  if (!jobId) {
    return c.json({ error: { message: 'missing_job_id' } }, 400)
  }

  return dispatchRunpodRequest({
    c,
    endpointId,
    operationPath: `status/${jobId}`,
    method: 'GET',
  })
})

app.get('/v1/runpod/:surface/stream/:jobId', async (c) => {
  const surface = resolveRunpodSurface(c)
  if (!surface) {
    return c.json({ error: { message: 'invalid_surface' } }, 400)
  }

  const endpointId = getRunpodOperationEndpointId({
    c,
    surface,
    explicitEndpointId: cleanString(c.req.query('endpointId')),
  })

  if (!endpointId) {
    return c.json({ error: { message: 'missing_endpoint_id' } }, 400)
  }

  const jobId = cleanString(c.req.param('jobId'))
  if (!jobId) {
    return c.json({ error: { message: 'missing_job_id' } }, 400)
  }

  return dispatchRunpodRequest({
    c,
    endpointId,
    operationPath: `stream/${jobId}`,
    method: 'GET',
  })
})

app.post('/v1/runpod/:surface/cancel/:jobId', async (c) => {
  const surface = resolveRunpodSurface(c)
  if (!surface) {
    return c.json({ error: { message: 'invalid_surface' } }, 400)
  }

  const endpointId = getRunpodOperationEndpointId({
    c,
    surface,
    explicitEndpointId: cleanString(c.req.query('endpointId')),
  })

  if (!endpointId) {
    return c.json({ error: { message: 'missing_endpoint_id' } }, 400)
  }

  const jobId = cleanString(c.req.param('jobId'))
  if (!jobId) {
    return c.json({ error: { message: 'missing_job_id' } }, 400)
  }

  return dispatchRunpodRequest({
    c,
    endpointId,
    operationPath: `cancel/${jobId}`,
    method: 'POST',
  })
})

app.post('/v1/runpod/:surface/retry/:jobId', async (c) => {
  const surface = resolveRunpodSurface(c)
  if (!surface) {
    return c.json({ error: { message: 'invalid_surface' } }, 400)
  }

  const endpointId = getRunpodOperationEndpointId({
    c,
    surface,
    explicitEndpointId: cleanString(c.req.query('endpointId')),
  })

  if (!endpointId) {
    return c.json({ error: { message: 'missing_endpoint_id' } }, 400)
  }

  const jobId = cleanString(c.req.param('jobId'))
  if (!jobId) {
    return c.json({ error: { message: 'missing_job_id' } }, 400)
  }

  return dispatchRunpodRequest({
    c,
    endpointId,
    operationPath: `retry/${jobId}`,
    method: 'POST',
  })
})

app.post('/v1/runpod/:surface/purge-queue', async (c) => {
  const surface = resolveRunpodSurface(c)
  if (!surface) {
    return c.json({ error: { message: 'invalid_surface' } }, 400)
  }

  const endpointId = getRunpodOperationEndpointId({
    c,
    surface,
    explicitEndpointId: cleanString(c.req.query('endpointId')),
  })

  if (!endpointId) {
    return c.json({ error: { message: 'missing_endpoint_id' } }, 400)
  }

  return dispatchRunpodRequest({
    c,
    endpointId,
    operationPath: 'purge-queue',
    method: 'POST',
  })
})

app.get('/v1/runpod/:surface/health', async (c) => {
  const surface = resolveRunpodSurface(c)
  if (!surface) {
    return c.json({ error: { message: 'invalid_surface' } }, 400)
  }

  const endpointId = getRunpodOperationEndpointId({
    c,
    surface,
    explicitEndpointId: cleanString(c.req.query('endpointId')),
  })

  if (!endpointId) {
    return c.json({ error: { message: 'missing_endpoint_id' } }, 400)
  }

  return dispatchRunpodRequest({
    c,
    endpointId,
    operationPath: 'health',
    method: 'GET',
  })
})

export default app
