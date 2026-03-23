import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

const {
  updateDashboardSettingsActionMock,
  validateDashboardWebhookActionMock,
} = vi.hoisted(() => ({
  updateDashboardSettingsActionMock: vi.fn(),
  validateDashboardWebhookActionMock: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock("@/app/actions/dashboard-settings-actions", () => ({
  updateDashboardSettingsAction: updateDashboardSettingsActionMock,
  validateDashboardWebhookAction: validateDashboardWebhookActionMock,
}))

import { WebhooksSettingsForm } from "@/components/site/dashboard/settings/webhooks-settings-form"

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

function renderForm() {
  const queryClient = createQueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <WebhooksSettingsForm
        initialValues={{
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
          ],
        }}
      />
    </QueryClientProvider>,
  )
}

describe("WebhooksSettingsForm", () => {
  beforeEach(() => {
    toastSuccess.mockClear()
    toastError.mockClear()
    updateDashboardSettingsActionMock.mockReset()
    validateDashboardWebhookActionMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("requires a successful validation before saving", async () => {
    validateDashboardWebhookActionMock.mockResolvedValue({
      ok: true,
      message: "Webhook returned HTTP 200.",
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
    })
    updateDashboardSettingsActionMock.mockResolvedValue({ webhooks: { webhooks: [] } })

    renderForm()

    const saveButton = screen.getByRole("button", { name: "Save" })
    expect(saveButton).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Validate Primary" }))

    await waitFor(() => {
      expect(validateDashboardWebhookActionMock).toHaveBeenCalledTimes(1)
    })

    expect(await screen.findByText("Validated")).toBeInTheDocument()
    expect(saveButton).toBeEnabled()

    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(updateDashboardSettingsActionMock).toHaveBeenCalledTimes(1)
    })

    expect(updateDashboardSettingsActionMock).toHaveBeenCalledWith({
      section: "webhooks",
      values: expect.objectContaining({
        webhooks: expect.arrayContaining([
          expect.objectContaining({
            id: "wh_1",
            endpointUrl: "https://hooks.example.com/dryapi",
            health: expect.objectContaining({
              validationStatus: "healthy",
              lastStatusCode: 200,
            }),
          }),
        ]),
      }),
    })
  })

  it("can add multiple webhook rows", async () => {
    renderForm()

    fireEvent.click(screen.getByRole("button", { name: "Add webhook" }))

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Validate/ })).toHaveLength(2)
    })
  })
})
