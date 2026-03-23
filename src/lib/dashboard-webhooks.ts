import "server-only"

import { dashboardWebhookEntrySchema, type DashboardWebhookEntry } from "@/lib/dashboard-settings-schema"
import { getDashboardSettingsForUser, updateDashboardWebhookHealth } from "@/lib/dashboard-settings-store"
import { sendWebhookFailureNotification } from "@/lib/dashboard-webhook-emails"

const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000

function nowMs(): number {
  return Date.now()
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
  )
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
  return [...new Uint8Array(signature)].map((chunk) => chunk.toString(16).padStart(2, "0")).join("")
}

function buildValidationPayload(webhook: DashboardWebhookEntry, checkedAtIso: string) {
  return {
    event: "webhook.validation",
    delivery_id: crypto.randomUUID(),
    timestamp: checkedAtIso,
    data: {
      webhook_id: webhook.id,
      webhook_name: webhook.name,
      endpoint_url: webhook.endpointUrl,
      checked_at: checkedAtIso,
      validation: true,
    },
  }
}

export type WebhookHealthProbeResult = {
  ok: boolean
  statusCode: number | null
  message: string
  checkedAt: number
}

export async function probeWebhookEndpoint(webhook: DashboardWebhookEntry): Promise<WebhookHealthProbeResult> {
  const checkedAt = nowMs()
  const checkedAtIso = new Date(checkedAt).toISOString()
  const body = buildValidationPayload(webhook, checkedAtIso)
  const bodyText = JSON.stringify(body)
  const signature = await hmacHex(webhook.signingSecret, `${Math.floor(checkedAt / 1000)}.${bodyText}`)

  try {
    const response = await fetch(webhook.endpointUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        "X-DryAPI-Timestamp": String(Math.floor(checkedAt / 1000)),
        "X-DryAPI-Event": "webhook.validation",
        "X-DryAPI-Delivery-Id": body.delivery_id,
        "X-DryAPI-Signature": `sha256=${signature}`,
      },
      body: bodyText,
    })

    return {
      ok: response.ok,
      statusCode: response.status,
      message: response.ok
        ? "Webhook returned HTTP 200."
        : `Webhook returned HTTP ${response.status}.`,
      checkedAt,
    }
  } catch (error) {
    return {
      ok: false,
      statusCode: null,
      message: error instanceof Error ? error.message : "Unable to reach webhook endpoint.",
      checkedAt,
    }
  }
}

function shouldSendFailureAlert(args: {
  existingWebhook: DashboardWebhookEntry
  probeResult: WebhookHealthProbeResult
}): boolean {
  if (args.probeResult.ok) {
    return false
  }

  const health = args.existingWebhook.health
  if (health.lastSuccessAt === null) {
    return false
  }

  if (health.alertCount >= 3) {
    return false
  }

  if (health.lastAlertAt !== null && args.probeResult.checkedAt - health.lastAlertAt < ALERT_COOLDOWN_MS) {
    return false
  }

  return true
}

function buildNextWebhookHealth(args: {
  currentWebhook: DashboardWebhookEntry
  probeResult: WebhookHealthProbeResult
  alerted: boolean
}): DashboardWebhookEntry["health"] {
  const currentHealth = args.currentWebhook.health

  if (args.probeResult.ok) {
    return {
      validationStatus: "healthy",
      validationMessage: args.probeResult.message,
      lastValidatedAt: args.probeResult.checkedAt,
      lastStatusCode: args.probeResult.statusCode,
      lastSuccessAt: args.probeResult.checkedAt,
      lastFailureAt: currentHealth.lastFailureAt,
      consecutiveFailures: 0,
      alertCount: currentHealth.alertCount,
      lastAlertAt: currentHealth.lastAlertAt,
    }
  }

  return {
    validationStatus: "unhealthy",
    validationMessage: args.probeResult.message,
    lastValidatedAt: args.probeResult.checkedAt,
    lastStatusCode: args.probeResult.statusCode,
    lastSuccessAt: currentHealth.lastSuccessAt,
    lastFailureAt: args.probeResult.checkedAt,
    consecutiveFailures: currentHealth.consecutiveFailures + 1,
    alertCount: currentHealth.alertCount + (args.alerted ? 1 : 0),
    lastAlertAt: args.alerted ? args.probeResult.checkedAt : currentHealth.lastAlertAt,
  }
}

export async function validateDashboardWebhook(args: {
  userEmail: string
  webhook: DashboardWebhookEntry
  hostname?: string | null
  persistHealth?: boolean
}): Promise<{
  webhook: DashboardWebhookEntry
  probeResult: WebhookHealthProbeResult
  alerted: boolean
}> {
  const existing = await getDashboardSettingsForUser(args.userEmail)
  const existingWebhook = existing.webhooks.webhooks.find((entry) => entry.id === args.webhook.id) ?? null
  const probeResult = await probeWebhookEndpoint(args.webhook)
  const alerted = Boolean(existingWebhook && shouldSendFailureAlert({ existingWebhook, probeResult }))

  if (alerted && existingWebhook) {
    await sendWebhookFailureNotification({
      hostname: args.hostname ?? null,
      recipientEmail: args.userEmail,
      webhookName: existingWebhook.name || args.webhook.name || "Webhook",
      webhookUrl: existingWebhook.endpointUrl,
      checkedAt: probeResult.checkedAt,
      lastStatusCode: probeResult.statusCode ?? 0,
      failureCount: existingWebhook.health.consecutiveFailures + 1,
      previousSuccessAt: existingWebhook.health.lastSuccessAt,
    })
  }

  const currentWebhook = dashboardWebhookEntrySchema.parse(args.webhook)
  const nextWebhook = {
    ...currentWebhook,
    health: buildNextWebhookHealth({
      currentWebhook: existingWebhook ?? currentWebhook,
      probeResult,
      alerted,
    }),
  }

  if (args.persistHealth && existingWebhook) {
    await updateDashboardWebhookHealth(
      {
        userEmail: args.userEmail,
        webhookId: existingWebhook.id,
        health: nextWebhook.health,
      },
    )
  }

  return {
    webhook: nextWebhook,
    probeResult,
    alerted,
  }
}
