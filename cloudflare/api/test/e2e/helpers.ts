import { randomUUID } from 'node:crypto'

import { expect } from 'vitest'

export type CfApiE2eEnv = {
  apiKey: string
  endpointChat: string
  endpointImages: string
  endpointEmbeddings: string
  endpointTranscribe: string
}

let cachedEnv: CfApiE2eEnv | null = null

export function getEnv(): CfApiE2eEnv {
  if (cachedEnv) {
    return cachedEnv
  }

  cachedEnv = {
    apiKey: process.env['CF_E2E_API_KEY'] ?? 'test-api-key',
    endpointChat: process.env['CF_E2E_ENDPOINT_CHAT'] ?? 'e2e-chat-endpoint',
    endpointImages: process.env['CF_E2E_ENDPOINT_IMAGES'] ?? 'e2e-images-endpoint',
    endpointEmbeddings: process.env['CF_E2E_ENDPOINT_EMBEDDINGS'] ?? 'e2e-embeddings-endpoint',
    endpointTranscribe: process.env['CF_E2E_ENDPOINT_TRANSCRIBE'] ?? 'e2e-transcribe-endpoint',
  }

  return cachedEnv
}

export function uniqueId(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 12)}`
}

export function authHeaders(token = getEnv().apiKey): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  }
}

function getBaseUrl(): string {
  return process.env['CF_E2E_BASE_URL'] ?? `http://127.0.0.1:${process.env['CF_E2E_API_PORT'] ?? '8877'}`
}

/**
 * Thin wrapper around a fetch Response that mirrors the Playwright APIResponse
 * interface used in the original spec files, so the test bodies need minimal changes.
 */
class E2eResponse {
  private readonly _response: Response
  private _cachedText: string | null = null

  constructor(response: Response) {
    this._response = response
  }

  status(): number {
    return this._response.status
  }

  headers(): Record<string, string> {
    const result: Record<string, string> = {}
    this._response.headers.forEach((value, key) => {
      result[key.toLowerCase()] = value
    })
    return result
  }

  async text(): Promise<string> {
    if (this._cachedText !== null) return this._cachedText
    this._cachedText = await this._response.text()
    return this._cachedText
  }
}

export type { E2eResponse }

/**
 * Minimal HTTP client that mirrors the Playwright APIRequestContext surface used
 * in the existing E2E spec files.
 */
export class E2eRequestClient {
  private readonly baseURL: string

  constructor(baseURL = getBaseUrl()) {
    this.baseURL = baseURL
  }

  async get(path: string, opts?: { headers?: Record<string, string> }): Promise<E2eResponse> {
    const response = await fetch(`${this.baseURL}${path}`, {
      method: 'GET',
      headers: opts?.headers,
    })
    return new E2eResponse(response)
  }

  async post(
    path: string,
    opts?: { headers?: Record<string, string>; data?: unknown },
  ): Promise<E2eResponse> {
    const headers: Record<string, string> = { 'content-type': 'application/json', ...opts?.headers }
    const response = await fetch(`${this.baseURL}${path}`, {
      method: 'POST',
      headers,
      body: opts?.data != null ? JSON.stringify(opts.data) : undefined,
    })
    return new E2eResponse(response)
  }

  async fetch(
    path: string,
    opts?: { method?: string; headers?: Record<string, string>; data?: unknown },
  ): Promise<E2eResponse> {
    const response = await globalThis.fetch(`${this.baseURL}${path}`, {
      method: opts?.method ?? 'GET',
      headers: opts?.headers,
      body: opts?.data != null ? JSON.stringify(opts.data) : undefined,
    })
    return new E2eResponse(response)
  }
}

export function createHttpClient(): E2eRequestClient {
  return new E2eRequestClient()
}

export async function jsonBody<T>(response: E2eResponse): Promise<T> {
  const raw = await response.text()
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error(`Expected JSON response but got: ${raw}`)
  }
}

export async function expectErrorCode(
  response: E2eResponse,
  status: number,
  errorCode: string,
): Promise<void> {
  expect(response.status()).toBe(status)
  const payload = await jsonBody<{ error?: { code?: string } }>(response)
  expect(payload.error?.code).toBe(errorCode)
}

export async function createRunpodJob(
  request: E2eRequestClient,
  surface: 'chat' | 'images' | 'embeddings' | 'transcribe',
  input: Record<string, unknown>,
): Promise<string> {
  const response = await request.post(`/v1/runpod/${surface}/run`, {
    headers: authHeaders(),
    data: { input },
  })

  expect(response.status()).toBe(200)
  const payload = await jsonBody<{ id?: string }>(response)
  expect(typeof payload.id).toBe('string')
  return payload.id as string
}

export async function seedE2eCredits(amount = 1000): Promise<void> {
  const env = getEnv()
  const request = new E2eRequestClient()
  const userId = '4c806362b613f7496abf2841' // SHA256('test-api-key').slice(0, 24)

  const response = await request.post('/v1/internal/test/seed-credits', {
    headers: {
      ...authHeaders(),
      'X-DryAPI-Allow-Internal': '1',
    },
    data: {
      userId: `api_key:${userId}`,
      amount,
    },
  })

  expect(response.status()).toBe(200)
}

