import { describe, expect, it } from 'vitest'

import { authHeaders, createHttpClient, expectErrorCode, jsonBody, uniqueId } from './helpers'

const request = createHttpClient()

describe('OpenAI-compatible surface routes', () => {
  it('queues chat completions and returns envelope metadata', async () => {
    const response = await request.post('/v1/chat/completions', {
      headers: authHeaders(),
      data: {
        model: 'Llama3_8B_Instruct',
        job_id: uniqueId('chat'),
        messages: [{ role: 'user', content: 'List two API gateway best practices.' }],
      },
    })

    expect(response.status()).toBe(202)
    const payload = await jsonBody<{
      object?: string
      status?: string
      surface?: string
      endpoint_id?: string
      runpod?: { id?: string }
    }>(response)

    expect(payload.object).toBe('chat.completion.enqueue')
    expect(payload.status).toBe('queued')
    expect(payload.surface).toBe('chat')
    expect(typeof payload.endpoint_id).toBe('string')
    expect(typeof payload.runpod?.id).toBe('string')
  })

  it('queues image generations', async () => {
    const response = await request.post('/v1/images/generations', {
      headers: authHeaders(),
      data: {
        model: 'Flux_2_Klein_4B_BF16',
        job_id: uniqueId('img'),
        prompt: 'A high-detail floating datacenter in the clouds',
        n: 1,
      },
    })

    expect(response.status()).toBe(202)
    const payload = await jsonBody<{ object?: string; surface?: string }>(response)
    expect(payload.object).toBe('image.generation.enqueue')
    expect(payload.surface).toBe('images')
  })

  it('queues audio transcriptions', async () => {
    const response = await request.post('/v1/audio/transcriptions', {
      headers: authHeaders(),
      data: {
        model: 'WhisperLargeV3',
        job_id: uniqueId('audio'),
        audioUrl: 'https://cdn.example.com/audio/test.mp3',
        language: 'en',
      },
    })

    expect(response.status()).toBe(202)
    const payload = await jsonBody<{ object?: string; surface?: string }>(response)
    expect(payload.object).toBe('audio.transcription.enqueue')
    expect(payload.surface).toBe('transcribe')
  })

  it('queues embeddings with single input', async () => {
    const response = await request.post('/v1/embeddings', {
      headers: authHeaders(),
      data: {
        model: 'Bge_M3_INT8',
        job_id: uniqueId('emb'),
        input: 'cold start mitigation for serverless GPUs',
      },
    })

    expect(response.status()).toBe(202)
    const payload = await jsonBody<{ object?: string; surface?: string }>(response)
    expect(payload.object).toBe('embedding.enqueue')
    expect(payload.surface).toBe('embeddings')
  })

  it('queues embeddings with batched input', async () => {
    const response = await request.post('/v1/embeddings', {
      headers: authHeaders(),
      data: {
        model: 'Bge_M3_INT8',
        job_id: uniqueId('embbatch'),
        input: ['queue depth', 'latency', 'cost controls'],
      },
    })

    expect(response.status()).toBe(202)
    const payload = await jsonBody<{ status?: string; runpod?: { id?: string } }>(response)
    expect(payload.status).toBe('queued')
    expect(typeof payload.runpod?.id).toBe('string')
  })

  it('returns validation error for empty chat messages array', async () => {
    const response = await request.post('/v1/chat/completions', {
      headers: authHeaders(),
      data: {
        messages: [],
      },
    })

    expect(response.status()).toBe(400)
  })

  it('returns validation error for missing image prompt', async () => {
    const response = await request.post('/v1/images/generations', {
      headers: authHeaders(),
      data: {
        n: 1,
      },
    })

    expect(response.status()).toBe(400)
  })

  it('returns validation error for invalid audio URL', async () => {
    const response = await request.post('/v1/audio/transcriptions', {
      headers: authHeaders(),
      data: {
        audioUrl: 'not-a-url',
      },
    })

    expect(response.status()).toBe(400)
  })

  it('returns validation error for empty embeddings input array', async () => {
    const response = await request.post('/v1/embeddings', {
      headers: authHeaders(),
      data: {
        input: [],
      },
    })

    expect(response.status()).toBe(400)
  })

  it('returns cache hit header on repeated chat payload', async () => {
    const payload = {
      model: 'Llama3_8B_Instruct',
      messages: [{ role: 'user', content: 'repeat this payload for caching check' }],
    }

    const first = await request.post('/v1/chat/completions', {
      headers: authHeaders(),
      data: payload,
    })
    expect(first.status()).toBe(202)

    const second = await request.post('/v1/chat/completions', {
      headers: authHeaders(),
      data: payload,
    })
    expect(second.status()).toBe(202)
    expect(second.headers()['x-cache']).toBe('hit')
  })

  it('maps upstream failures to standardized upstream_error payloads', async () => {
    const response = await request.post('/v1/chat/completions', {
      headers: authHeaders(),
      data: {
        model: 'Llama3_8B_Instruct',
        trigger_upstream_error: true,
        messages: [{ role: 'user', content: 'force upstream error' }],
      },
    })

    await expectErrorCode(response, 502, 'upstream_error')
  })
})
