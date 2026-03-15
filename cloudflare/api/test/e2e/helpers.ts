import { randomUUID } from 'node:crypto'

import { expect, type APIRequestContext, type APIResponse } from '@playwright/test'

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
    apiKey: process.env.CF_E2E_API_KEY ?? 'test-api-key',
    endpointChat: process.env.CF_E2E_ENDPOINT_CHAT ?? 'e2e-chat-endpoint',
    endpointImages: process.env.CF_E2E_ENDPOINT_IMAGES ?? 'e2e-images-endpoint',
    endpointEmbeddings: process.env.CF_E2E_ENDPOINT_EMBEDDINGS ?? 'e2e-embeddings-endpoint',
    endpointTranscribe: process.env.CF_E2E_ENDPOINT_TRANSCRIBE ?? 'e2e-transcribe-endpoint',
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

export async function jsonBody<T>(response: APIResponse): Promise<T> {
  const raw = await response.text()
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error(`Expected JSON response but got: ${raw}`)
  }
}

export async function expectErrorCode(response: APIResponse, status: number, errorCode: string): Promise<void> {
  expect(response.status()).toBe(status)
  const payload = await jsonBody<{ error?: { code?: string } }>(response)
  expect(payload.error?.code).toBe(errorCode)
}

export async function createRunpodJob(
  request: APIRequestContext,
  surface: 'chat' | 'images' | 'embeddings' | 'transcribe',
  input: Record<string, unknown>,
): Promise<string> {
  const response = await request.post(`/v1/runpod/${surface}/run`, {
    headers: authHeaders(),
    data: {
      input,
    },
  })

  expect(response.status()).toBe(200)
  const payload = await jsonBody<{ id?: string }>(response)
  expect(typeof payload.id).toBe('string')
  return payload.id as string
}
