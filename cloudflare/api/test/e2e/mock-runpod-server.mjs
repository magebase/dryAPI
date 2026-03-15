import http from 'node:http'

const runpodPort = Number.parseInt(process.env.CF_E2E_RUNPOD_PORT ?? '8878', 10)
const expectedApiKey = process.env.CF_E2E_RUNPOD_API_KEY ?? 'test-runpod-api-key'

const jobs = new Map()
let counter = 0

function nextJobId() {
  counter += 1
  return `job_${String(counter).padStart(6, '0')}`
}

function toJsonHeaders(extra = {}) {
  return {
    'content-type': 'application/json; charset=utf-8',
    ...extra,
  }
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload)
  res.writeHead(status, toJsonHeaders(extraHeaders))
  res.end(body)
}

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }

  if (chunks.length === 0) {
    return {}
  }

  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (text === '') {
    return {}
  }

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function getAuthToken(req) {
  const authHeader = req.headers.authorization ?? ''
  return String(authHeader).replace(/^Bearer\s+/i, '').trim()
}

function resolveRoute(pathname) {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length < 3 || parts[0] !== 'v2') {
    return null
  }

  const endpointId = parts[1]
  const operation = parts[2]
  const jobId = parts[3] ?? null

  return {
    endpointId,
    operation,
    jobId,
  }
}

function toStatusPayload(job) {
  const payload = {
    id: job.id,
    status: job.status,
    endpoint_id: job.endpointId,
    delayTime: 0,
    executionTime: Math.max(1, job.pollCount),
  }

  if (job.includeLink) {
    payload.output = {
      artifacts: [`https://cdn.mock.local/${job.id}.png`],
    }
    return payload
  }

  if (job.largePayload) {
    payload.output = {
      blob: 'x'.repeat(80_000),
    }
    return payload
  }

  payload.output = {
    echo: job.input,
  }
  return payload
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`)

  if (url.pathname === '/__health') {
    sendJson(res, 200, { ok: true, service: 'runpod-mock' })
    return
  }

  const route = resolveRoute(url.pathname)
  if (!route) {
    sendJson(res, 404, { error: 'not_found' })
    return
  }

  const token = getAuthToken(req)
  if (token !== expectedApiKey) {
    sendJson(res, 401, { error: 'unauthorized' })
    return
  }

  if (route.operation === 'run' || route.operation === 'runsync') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'method_not_allowed' })
      return
    }

    const body = await readJsonBody(req)
    if (!body || typeof body !== 'object') {
      sendJson(res, 400, { error: 'invalid_json' })
      return
    }

    const input = typeof body.input === 'object' && body.input !== null ? body.input : {}

    if (input.trigger_upstream_error === true) {
      sendJson(res, 502, {
        error: 'mock_upstream_failure',
        detail: 'Simulated upstream failure from mock RunPod server.',
      })
      return
    }

    const explicitJobId = typeof input.job_id === 'string' && input.job_id.trim() !== '' ? input.job_id.trim() : null
    const jobId = explicitJobId ?? nextJobId()
    const isSync = route.operation === 'runsync'
    const forceStatus = typeof input.force_status === 'string' ? input.force_status.trim().toUpperCase() : null

    const job = {
      id: jobId,
      endpointId: route.endpointId,
      pollCount: 0,
      includeLink: input.include_link === true,
      largePayload: input.large_payload === true,
      input,
      status: isSync ? 'COMPLETED' : forceStatus || 'IN_QUEUE',
    }

    jobs.set(jobId, job)

    sendJson(res, 200, {
      id: jobId,
      status: job.status,
      output: {
        id: jobId,
      },
    })
    return
  }

  if (route.operation === 'status') {
    const job = route.jobId ? jobs.get(route.jobId) : null
    if (!job) {
      sendJson(res, 404, {
        error: 'job_not_found',
      })
      return
    }

    if (job.status === 'IN_QUEUE' || job.status === 'IN_PROGRESS') {
      job.pollCount += 1
      if (job.pollCount >= 2) {
        job.status = 'COMPLETED'
      } else {
        job.status = 'IN_PROGRESS'
      }
    }

    sendJson(res, 200, toStatusPayload(job))
    return
  }

  if (route.operation === 'stream') {
    const job = route.jobId ? jobs.get(route.jobId) : null
    if (!job) {
      sendJson(res, 404, { error: 'job_not_found' })
      return
    }

    sendJson(res, 200, {
      id: job.id,
      status: 'IN_PROGRESS',
      output: {
        chunk: `stream chunk for ${job.id}`,
      },
    })
    return
  }

  if (route.operation === 'cancel') {
    const job = route.jobId ? jobs.get(route.jobId) : null
    if (!job) {
      sendJson(res, 404, { error: 'job_not_found' })
      return
    }

    job.status = 'CANCELLED'
    sendJson(res, 200, {
      id: job.id,
      status: job.status,
    })
    return
  }

  if (route.operation === 'retry') {
    const job = route.jobId ? jobs.get(route.jobId) : null
    if (!job) {
      sendJson(res, 404, { error: 'job_not_found' })
      return
    }

    job.status = 'IN_QUEUE'
    job.pollCount = 0
    sendJson(res, 200, {
      id: job.id,
      status: job.status,
    })
    return
  }

  if (route.operation === 'purge-queue') {
    let purged = 0
    for (const job of jobs.values()) {
      if (job.status === 'IN_QUEUE' || job.status === 'IN_PROGRESS') {
        purged += 1
        job.status = 'CANCELLED'
      }
    }

    sendJson(res, 200, {
      ok: true,
      purged,
    })
    return
  }

  if (route.operation === 'health') {
    sendJson(res, 200, {
      endpoint_id: route.endpointId,
      status: 'healthy',
      queue_depth: 0,
    })
    return
  }

  sendJson(res, 404, {
    error: 'unknown_operation',
    operation: route.operation,
  })
})

server.listen(runpodPort, '127.0.0.1', () => {
  console.log(`[runpod-mock] listening on http://127.0.0.1:${runpodPort}`)
})

const shutdown = () => {
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
