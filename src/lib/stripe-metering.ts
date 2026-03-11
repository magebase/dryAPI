import "server-only"

import { randomUUID } from "node:crypto"

export type StripeMeterEventType =
  | "ai_model_call"
  | "moderation_model_call"
  | "brevo_email_send"
  | "brevo_sms_send"
  | "cal_request"
  | "cloudflare_worker_request"
  | "workflow_dispatch"
  | "workflow_run"

type StripeMeterMetadataValue = string | number | boolean | null | undefined

type RecordStripeMeterUsageInput = {
  eventType: StripeMeterEventType
  value?: number
  metadata?: Record<string, StripeMeterMetadataValue>
  identifier?: string
  timestamp?: number | Date
}

type StripeMeterConfig = {
  apiKey: string
  customerId: string
  projectKey: string
}

const STRIPE_METER_API_URL = "https://api.stripe.com/v1/billing/meter_events"
const DEFAULT_PROJECT_KEY = "genfix"

const STRIPE_METER_EVENT_DEFAULTS: Record<StripeMeterEventType, string> = {
  ai_model_call: "genfix_ai_model_call",
  moderation_model_call: "genfix_moderation_model_call",
  brevo_email_send: "genfix_brevo_email_send",
  brevo_sms_send: "genfix_brevo_sms_send",
  cal_request: "genfix_cal_request",
  cloudflare_worker_request: "genfix_cloudflare_worker_request",
  workflow_dispatch: "genfix_workflow_dispatch",
  workflow_run: "genfix_workflow_run",
}

const STRIPE_METER_EVENT_OVERRIDE_ENV_KEYS: Record<StripeMeterEventType, string> = {
  ai_model_call: "STRIPE_METER_EVENT_AI_MODEL_CALL",
  moderation_model_call: "STRIPE_METER_EVENT_MODERATION_MODEL_CALL",
  brevo_email_send: "STRIPE_METER_EVENT_BREVO_EMAIL_SEND",
  brevo_sms_send: "STRIPE_METER_EVENT_BREVO_SMS_SEND",
  cal_request: "STRIPE_METER_EVENT_CAL_REQUEST",
  cloudflare_worker_request: "STRIPE_METER_EVENT_CLOUDFLARE_WORKER_REQUEST",
  workflow_dispatch: "STRIPE_METER_EVENT_WORKFLOW_DISPATCH",
  workflow_run: "STRIPE_METER_EVENT_WORKFLOW_RUN",
}

function resolveMeterConfig(env: NodeJS.ProcessEnv = process.env): StripeMeterConfig | null {
  const apiKey = env.STRIPE_PRIVATE_KEY?.trim() || ""
  const customerId = env.STRIPE_METER_BILLING_CUSTOMER_ID?.trim() || ""

  if (!apiKey || !customerId) {
    return null
  }

  return {
    apiKey,
    customerId,
    projectKey: env.STRIPE_METER_PROJECT_KEY?.trim() || DEFAULT_PROJECT_KEY,
  }
}

function resolveEventName(eventType: StripeMeterEventType, env: NodeJS.ProcessEnv = process.env): string {
  const overrideKey = STRIPE_METER_EVENT_OVERRIDE_ENV_KEYS[eventType]
  const overrideValue = env[overrideKey]?.trim()

  if (overrideValue) {
    return overrideValue
  }

  return STRIPE_METER_EVENT_DEFAULTS[eventType]
}

function normalizeMeterValue(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1
  }

  return Math.max(1, Math.floor(value))
}

function toUnixTimestampSeconds(value: number | Date | undefined): number {
  if (!value) {
    return Math.floor(Date.now() / 1000)
  }

  if (value instanceof Date) {
    return Math.floor(value.getTime() / 1000)
  }

  return Math.floor(value)
}

function sanitizeDimensionKey(key: string): string {
  const normalized = key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")

  return normalized.slice(0, 40)
}

function stringifyDimensionValue(value: StripeMeterMetadataValue): string {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim().slice(0, 120)
}

function buildIdentifier(input: {
  providedIdentifier?: string
  projectKey: string
  eventType: StripeMeterEventType
  timestamp: number
}): string {
  const provided = input.providedIdentifier?.trim()
  if (provided) {
    return provided.slice(0, 200)
  }

  return `${input.projectKey}:${input.eventType}:${input.timestamp}:${randomUUID()}`.slice(0, 200)
}

async function readResponseBodySafe(response: Response): Promise<string> {
  try {
    return (await response.text()).trim()
  } catch {
    return ""
  }
}

export async function recordStripeMeterUsage(input: RecordStripeMeterUsageInput): Promise<boolean> {
  const config = resolveMeterConfig()
  if (!config) {
    return false
  }

  const eventName = resolveEventName(input.eventType)
  const value = normalizeMeterValue(input.value)
  const timestamp = toUnixTimestampSeconds(input.timestamp)
  const identifier = buildIdentifier({
    providedIdentifier: input.identifier,
    projectKey: config.projectKey,
    eventType: input.eventType,
    timestamp,
  })

  const params = new URLSearchParams()
  params.set("event_name", eventName)
  params.set("payload[value]", String(value))
  params.set("payload[stripe_customer_id]", config.customerId)
  params.set("payload[project_key]", config.projectKey)
  params.set("timestamp", String(timestamp))
  params.set("identifier", identifier)

  if (input.metadata) {
    let dimensionCount = 0

    for (const [rawKey, rawValue] of Object.entries(input.metadata)) {
      if (dimensionCount >= 6) {
        break
      }

      const key = sanitizeDimensionKey(rawKey)
      const valueText = stringifyDimensionValue(rawValue)

      if (!key || !valueText) {
        continue
      }

      params.set(`payload[${key}]`, valueText)
      dimensionCount += 1
    }
  }

  const abortController = new AbortController()
  const timeout = setTimeout(() => {
    abortController.abort()
  }, 3_500)

  try {
    const response = await fetch(STRIPE_METER_API_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/x-www-form-urlencoded",
        "idempotency-key": identifier,
      },
      body: params.toString(),
      signal: abortController.signal,
    })

    if (!response.ok) {
      const details = await readResponseBodySafe(response)
      console.warn(
        `Stripe meter event failed (${response.status}) for ${eventName}: ${details || "no response body"}`
      )
      return false
    }

    return true
  } catch (error) {
    console.warn(`Stripe meter event request failed for ${eventName}`, error)
    return false
  } finally {
    clearTimeout(timeout)
  }
}
