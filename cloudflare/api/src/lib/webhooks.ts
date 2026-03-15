import { getJobWebhook, markJobWebhookDelivered } from './db'
import type { AppContext, RunpodSurface } from '../types'

type WebhookEventName = 'job.processing' | 'job.completed' | 'job.failed'

export function toWebhookEvent(status: string): WebhookEventName | null {
  const normalized = status.trim().toUpperCase()
  if (normalized === 'IN_QUEUE' || normalized === 'IN_PROGRESS' || normalized === 'PROCESSING') {
    return 'job.processing'
  }

  if (normalized === 'COMPLETED' || normalized === 'DONE' || normalized === 'SUCCEEDED') {
    return 'job.completed'
  }

  if (normalized === 'FAILED' || normalized === 'ERROR' || normalized === 'CANCELLED' || normalized === 'TIMED_OUT') {
    return 'job.failed'
  }

  return null
}

function toWebhookSecret(c: AppContext): string {
  const candidate = typeof c.env.WEBHOOK_SIGNING_SECRET === 'string' ? c.env.WEBHOOK_SIGNING_SECRET.trim() : ''
  if (candidate !== '') {
    return candidate
  }

  const fallback = typeof c.env.INTERNAL_API_KEY === 'string' ? c.env.INTERNAL_API_KEY.trim() : ''
  if (fallback !== '') {
    return fallback
  }

  return typeof c.env.API_KEY === 'string' ? c.env.API_KEY.trim() : ''
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return [...new Uint8Array(signature)].map((chunk) => chunk.toString(16).padStart(2, '0')).join('')
}

function generateDeliveryId(): string {
  return crypto.randomUUID()
}

export async function deliverWebhookForJobStatus(args: {
  c: AppContext
  jobId: string
  surface: RunpodSurface
  status: string
  payload: unknown
}): Promise<void> {
  const eventName = toWebhookEvent(args.status)
  if (!eventName) {
    return
  }

  const subscription = await getJobWebhook({
    c: args.c,
    jobId: args.jobId,
  })
  if (!subscription) {
    return
  }

  if (subscription.last_event === eventName) {
    return
  }

  const deliveredDeliveryId = await dispatchSignedWebhook({
    c: args.c,
    webhookUrl: subscription.webhook_url,
    eventName,
    jobId: args.jobId,
    surface: args.surface,
    status: args.status,
    payload: args.payload,
  })

  if (!deliveredDeliveryId) {
    return
  }

  await markJobWebhookDelivered({
    c: args.c,
    jobId: args.jobId,
    eventName,
    deliveryId: deliveredDeliveryId,
  })
}

export async function dispatchSignedWebhook(args: {
  c: AppContext
  webhookUrl: string
  eventName: WebhookEventName
  jobId: string
  surface: RunpodSurface
  status: string
  payload: unknown
}): Promise<string | null> {
  const timestamp = Math.floor(Date.now() / 1000)
  const deliveryId = generateDeliveryId()
  const body = {
    event: args.eventName,
    delivery_id: deliveryId,
    timestamp: new Date(timestamp * 1000).toISOString(),
    data: {
      job_request_id: args.jobId,
      status: args.status,
      surface: args.surface,
      result: args.payload,
    },
  }

  const bodyText = JSON.stringify(body)
  const secret = toWebhookSecret(args.c)
  const signature = secret !== '' ? await hmacHex(secret, `${timestamp}.${bodyText}`) : ''

  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'X-DeAPI-Timestamp': String(timestamp),
    'X-DeAPI-Event': args.eventName,
    'X-DeAPI-Delivery-Id': deliveryId,
  })

  if (signature !== '') {
    headers.set('X-DeAPI-Signature', `sha256=${signature}`)
  }

  const timeoutMs = typeof args.c.env.WEBHOOK_TIMEOUT_MS === 'string' ? Number.parseInt(args.c.env.WEBHOOK_TIMEOUT_MS, 10) : 8_000
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8_000)

  try {
    const response = await fetch(args.webhookUrl, {
      method: 'POST',
      headers,
      body: bodyText,
      signal: controller.signal,
    })

    return response.ok ? deliveryId : null
  } catch (error) {
    console.warn('[webhook] delivery failed', error)
    return null
  } finally {
    clearTimeout(timeout)
  }
}
