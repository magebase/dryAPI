import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const {
  getDashboardSettingsForUserMock,
  updateDashboardWebhookHealthMock,
  sendWebhookFailureNotificationMock,
} = vi.hoisted(() => ({
  getDashboardSettingsForUserMock: vi.fn(),
  updateDashboardWebhookHealthMock: vi.fn(),
  sendWebhookFailureNotificationMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/dashboard-settings-store", () => ({
  getDashboardSettingsForUser: getDashboardSettingsForUserMock,
  updateDashboardWebhookHealth: updateDashboardWebhookHealthMock,
}))

vi.mock("@/lib/dashboard-webhook-emails", () => ({
  sendWebhookFailureNotification: sendWebhookFailureNotificationMock,
}))

import { shouldPersistWebhookHealth, validateDashboardWebhook } from "@/lib/dashboard-webhooks"

afterEach(() => {
  vi.restoreAllMocks()
  getDashboardSettingsForUserMock.mockReset()
  updateDashboardWebhookHealthMock.mockReset()
  sendWebhookFailureNotificationMock.mockClear()
})

describe("shouldPersistWebhookHealth", () => {
  const webhook = {
    id: "wh_1",
    name: "Primary",
    endpointUrl: "https://hooks.example.com/dryapi",
    signingSecret: "whsec_test_secret",
    sendOnCompleted: true,
    sendOnFailed: true,
    sendOnQueued: false,
    includeFullPayload: false,
    health: {
      validationStatus: "healthy" as const,
      validationMessage: "Webhook returned HTTP 200.",
      lastValidatedAt: 1700000000000,
      lastStatusCode: 200,
      lastSuccessAt: 1700000000000,
      lastFailureAt: null,
      consecutiveFailures: 0,
      alertCount: 0,
      lastAlertAt: null,
    },
  }

  it("returns false when there is no existing webhook", () => {
    expect(shouldPersistWebhookHealth(null, webhook)).toBe(false)
  })

  it("returns true only when the endpoint url and signing secret match", () => {
    expect(shouldPersistWebhookHealth(webhook, webhook)).toBe(true)
    expect(
      shouldPersistWebhookHealth(
        {
          ...webhook,
          endpointUrl: "https://hooks.example.com/other",
        },
        webhook,
      ),
    ).toBe(false)
    expect(
      shouldPersistWebhookHealth(
        {
          ...webhook,
          signingSecret: "whsec_other_secret",
        },
        webhook,
      ),
    ).toBe(false)
  })
})

describe("validateDashboardWebhook", () => {
  it("records a fresh failure and sends an alert for a previously healthy webhook", async () => {
    getDashboardSettingsForUserMock.mockResolvedValue({
      webhooks: {
        webhooks: [
          {
            id: "wh_1",
            name: "Primary",
            endpointUrl: "https://hooks.example.com/dryapi",
            signingSecret: "whsec_test_secret",
            sendOnCompleted: true,
            sendOnFailed: true,
            sendOnQueued: false,
            includeFullPayload: false,
            health: {
              validationStatus: "healthy",
              validationMessage: "Webhook returned HTTP 200.",
              lastValidatedAt: 1700000000000,
              lastStatusCode: 200,
              lastSuccessAt: 1700000000000,
              lastFailureAt: null,
              consecutiveFailures: 0,
              alertCount: 0,
              lastAlertAt: null,
            },
          },
        ],
      },
    })
    updateDashboardWebhookHealthMock.mockResolvedValue(null)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("fail", { status: 500 })))

    const result = await validateDashboardWebhook({
      userEmail: "ops@example.com",
      hostname: "dryapi.dev",
      webhook: {
        id: "wh_1",
        name: "Primary",
        endpointUrl: "https://hooks.example.com/dryapi",
        signingSecret: "whsec_test_secret",
        sendOnCompleted: true,
        sendOnFailed: true,
        sendOnQueued: false,
        includeFullPayload: false,
        health: {
          validationStatus: "unknown",
          validationMessage: "",
          lastValidatedAt: null,
          lastStatusCode: null,
          lastSuccessAt: null,
          lastFailureAt: null,
          consecutiveFailures: 0,
          alertCount: 0,
          lastAlertAt: null,
        },
      },
      persistHealth: true,
    })

    expect(result.probeResult.ok).toBe(false)
    expect(sendWebhookFailureNotificationMock).toHaveBeenCalledTimes(1)
    expect(updateDashboardWebhookHealthMock).toHaveBeenCalledTimes(1)
    expect(result.webhook.health.validationStatus).toBe("unhealthy")
    expect(result.webhook.health.consecutiveFailures).toBe(1)
  })

  it("does not send more than one alert per day or beyond three total alerts", async () => {
    getDashboardSettingsForUserMock.mockResolvedValue({
      webhooks: {
        webhooks: [
          {
            id: "wh_2",
            name: "Primary",
            endpointUrl: "https://hooks.example.com/dryapi",
            signingSecret: "whsec_test_secret",
            sendOnCompleted: true,
            sendOnFailed: true,
            sendOnQueued: false,
            includeFullPayload: false,
            health: {
              validationStatus: "healthy",
              validationMessage: "Webhook returned HTTP 200.",
              lastValidatedAt: 1700000000000,
              lastStatusCode: 200,
              lastSuccessAt: 1700000000000,
              lastFailureAt: null,
              consecutiveFailures: 2,
              alertCount: 3,
              lastAlertAt: 1700000000000,
            },
          },
        ],
      },
    })
    updateDashboardWebhookHealthMock.mockResolvedValue(null)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("fail", { status: 500 })))

    const result = await validateDashboardWebhook({
      userEmail: "ops@example.com",
      hostname: "dryapi.dev",
      webhook: {
        id: "wh_2",
        name: "Primary",
        endpointUrl: "https://hooks.example.com/dryapi",
        signingSecret: "whsec_test_secret",
        sendOnCompleted: true,
        sendOnFailed: true,
        sendOnQueued: false,
        includeFullPayload: false,
        health: {
          validationStatus: "unknown",
          validationMessage: "",
          lastValidatedAt: null,
          lastStatusCode: null,
          lastSuccessAt: null,
          lastFailureAt: null,
          consecutiveFailures: 0,
          alertCount: 0,
          lastAlertAt: null,
        },
      },
      persistHealth: true,
    })

    expect(result.probeResult.ok).toBe(false)
    expect(sendWebhookFailureNotificationMock).not.toHaveBeenCalled()
  })
})
