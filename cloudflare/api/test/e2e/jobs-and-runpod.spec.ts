import { expect, test } from '@playwright/test'

import { authHeaders, createRunpodJob, expectErrorCode, jsonBody, uniqueId } from './helpers'

test.describe('Jobs and RunPod operational routes', () => {
  test.describe.configure({ mode: 'parallel' })

  test('submits async RunPod job via /run', async ({ request }) => {
    const response = await request.post('/v1/runpod/chat/run', {
      headers: authHeaders(),
      data: {
        input: {
          job_id: uniqueId('run'),
          prompt: 'async run route test',
        },
      },
    })

    expect(response.status()).toBe(200)
    const payload = await jsonBody<{ id?: string; status?: string }>(response)
    expect(typeof payload.id).toBe('string')
    expect(payload.status).toBe('IN_QUEUE')
  })

  test('submits sync RunPod job via /runsync', async ({ request }) => {
    const response = await request.post('/v1/runpod/embeddings/runsync', {
      headers: authHeaders(),
      data: {
        input: {
          job_id: uniqueId('runsync'),
          input: ['hello world'],
        },
      },
    })

    expect(response.status()).toBe(200)
    const payload = await jsonBody<{ status?: string }>(response)
    expect(payload.status).toBe('COMPLETED')
  })

  test('resolves job status through /v1/jobs/:surface/:jobId', async ({ request }) => {
    const jobId = await createRunpodJob(request, 'chat', {
      job_id: uniqueId('status'),
      prompt: 'status route test',
    })

    const response = await request.get(`/v1/jobs/chat/${jobId}`, {
      headers: authHeaders(),
    })

    expect(response.status()).toBe(200)
    const payload = await jsonBody<{ id?: string; status?: string }>(response)
    expect(payload.id).toBe(jobId)
    expect(typeof payload.status).toBe('string')
  })

  test('returns upstream_error for unknown jobs', async ({ request }) => {
    const response = await request.get('/v1/jobs/chat/nonexistent_job_123', {
      headers: authHeaders(),
    })

    await expectErrorCode(response, 404, 'upstream_error')
  })

  test('returns download links when status payload contains media URLs', async ({ request }) => {
    const jobId = await createRunpodJob(request, 'images', {
      job_id: uniqueId('links'),
      include_link: true,
      prompt: 'download links route test',
    })

    const response = await request.get(`/v1/jobs/images/${jobId}/download`, {
      headers: authHeaders(),
    })

    expect(response.status()).toBe(200)
    const payload = await jsonBody<{ mode?: string; links?: string[] }>(response)
    expect(payload.mode).toBe('links')
    expect(Array.isArray(payload.links)).toBe(true)
    expect((payload.links ?? [])[0]).toContain('https://')
  })

  test('falls back to text attachment for download format=txt', async ({ request }) => {
    const jobId = await createRunpodJob(request, 'chat', {
      job_id: uniqueId('txt'),
      prompt: 'txt fallback test',
    })

    const response = await request.get(`/v1/jobs/chat/${jobId}/download?format=txt`, {
      headers: authHeaders(),
    })

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/plain')
    expect(response.headers()['content-disposition']).toContain(`${jobId}.txt`)
  })

  test('proxies direct RunPod status route', async ({ request }) => {
    const jobId = await createRunpodJob(request, 'chat', {
      job_id: uniqueId('runpodstatus'),
      prompt: 'runpod status route test',
    })

    const response = await request.get(`/v1/runpod/chat/status/${jobId}`, {
      headers: authHeaders(),
    })

    expect(response.status()).toBe(200)
    const payload = await jsonBody<{ id?: string }>(response)
    expect(payload.id).toBe(jobId)
  })

  test('proxies direct RunPod stream route', async ({ request }) => {
    const jobId = await createRunpodJob(request, 'chat', {
      job_id: uniqueId('stream'),
      prompt: 'stream route test',
    })

    const response = await request.get(`/v1/runpod/chat/stream/${jobId}`, {
      headers: authHeaders(),
    })

    expect(response.status()).toBe(200)
    const payload = await jsonBody<{ output?: { chunk?: string } }>(response)
    expect(typeof payload.output?.chunk).toBe('string')
  })

  test('proxies direct RunPod cancel route', async ({ request }) => {
    const jobId = await createRunpodJob(request, 'images', {
      job_id: uniqueId('cancel'),
      prompt: 'cancel route test',
    })

    const response = await request.post(`/v1/runpod/images/cancel/${jobId}`, {
      headers: authHeaders(),
    })

    expect(response.status()).toBe(200)
    const payload = await jsonBody<{ status?: string }>(response)
    expect(payload.status).toBe('CANCELLED')
  })

  test('proxies direct RunPod retry route', async ({ request }) => {
    const jobId = await createRunpodJob(request, 'images', {
      job_id: uniqueId('retry'),
      prompt: 'retry route test',
    })

    const response = await request.post(`/v1/runpod/images/retry/${jobId}`, {
      headers: authHeaders(),
    })

    expect(response.status()).toBe(200)
    const payload = await jsonBody<{ status?: string }>(response)
    expect(payload.status).toBe('IN_QUEUE')
  })

  test('proxies direct RunPod purge queue route', async ({ request }) => {
    const response = await request.post('/v1/runpod/chat/purge-queue', {
      headers: authHeaders(),
    })

    expect(response.status()).toBe(200)
    const payload = await jsonBody<{ ok?: boolean; purged?: number }>(response)
    expect(payload.ok).toBe(true)
    expect(typeof payload.purged).toBe('number')
  })

  test('proxies direct RunPod health route', async ({ request }) => {
    const response = await request.get('/v1/runpod/transcribe/health', {
      headers: authHeaders(),
    })

    expect(response.status()).toBe(200)
    const payload = await jsonBody<{ status?: string }>(response)
    expect(payload.status).toBe('healthy')
  })

  test('rejects invalid endpointId query values', async ({ request }) => {
    const response = await request.get('/v1/runpod/chat/health?endpointId=', {
      headers: authHeaders(),
    })

    expect(response.status()).toBe(400)
  })

  test('rejects invalid download format query values', async ({ request }) => {
    const jobId = await createRunpodJob(request, 'chat', {
      job_id: uniqueId('downloadfmt'),
      prompt: 'download format validation test',
    })

    const response = await request.get(`/v1/jobs/chat/${jobId}/download?format=xml`, {
      headers: authHeaders(),
    })

    expect(response.status()).toBe(400)
  })

  test('maps upstream errors on run routes with standardized code', async ({ request }) => {
    const response = await request.post('/v1/runpod/chat/run', {
      headers: authHeaders(),
      data: {
        input: {
          trigger_upstream_error: true,
        },
      },
    })

    await expectErrorCode(response, 502, 'upstream_error')
  })

  test('rejects unauthorized requests on jobs routes', async ({ request }) => {
    const response = await request.get('/v1/jobs/chat/some_job_id', {
      headers: {
        authorization: 'Bearer invalid-token',
      },
    })

    await expectErrorCode(response, 401, 'unauthorized')
  })
})
