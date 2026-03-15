import { generateSpecs } from 'hono-openapi'
import type { Hono } from 'hono'

import type { WorkerEnv } from '../types'

const OPENAPI_CACHE_TTL_MS = 15_000

type GenerateSpecsOptions = NonNullable<Parameters<typeof generateSpecs>[1]>

const OPENAPI_DOCUMENT_METADATA: GenerateSpecsOptions['documentation'] = {
  openapi: '3.1.0',
  info: {
    title: 'dryAPI Gateway API',
    version: '2026-03-15',
    description:
      'Unified OpenAI-compatible inference gateway with async job orchestration, provider controls, and webhook tooling.',
  },
  servers: [
    {
      url: '/',
      description: 'Same-origin worker URL',
    },
  ],
  tags: [
    {
      name: 'OpenAI-Compatible',
      description: 'OpenAI/OpenRouter-style inference enqueue endpoints.',
    },
    {
      name: 'Jobs',
      description: 'Provider-agnostic async status, download, and websocket streaming routes.',
    },
    {
      name: 'RunPod Jobs',
      description: 'Direct provider operational routes for run, runsync, status, and queue control.',
    },
    {
      name: 'Webhooks',
      description: 'Webhook signature and delivery testing routes.',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API key',
        description: 'Use `Authorization: Bearer <api-key>`.',
      },
    },
  },
}

let cachedOpenApi: unknown = null
let cachedAt = 0

export async function getOpenApiDocument(app: Hono<WorkerEnv>) {
  const now = Date.now()
  if (cachedOpenApi && now - cachedAt < OPENAPI_CACHE_TTL_MS) {
    return cachedOpenApi
  }

  const document = await generateSpecs(app, {
    documentation: OPENAPI_DOCUMENT_METADATA,
    includeEmptyPaths: false,
    exclude: ['/openapi.json'],
  })

  cachedOpenApi = document
  cachedAt = now
  return document
}
