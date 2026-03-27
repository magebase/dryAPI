import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

const {
  authClientSendVerificationOtpMock,
  getClientAuthSessionSnapshotMock,
} = vi.hoisted(() => ({
  authClientSendVerificationOtpMock: vi.fn(),
  getClientAuthSessionSnapshotMock: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    emailOtp: {
      sendVerificationOtp: authClientSendVerificationOtpMock,
    },
  },
}))

vi.mock("@/lib/client-auth-session", () => ({
  getClientAuthSessionSnapshot: getClientAuthSessionSnapshotMock,
}))

import { EmailOtpSettingsCard } from "@/components/site/dashboard/settings/email-otp-settings-card"

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

function renderCard() {
  const queryClient = createQueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <EmailOtpSettingsCard />
    </QueryClientProvider>,
  )
}

describe("EmailOtpSettingsCard", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    toastSuccess.mockClear()
    toastError.mockClear()
    authClientSendVerificationOtpMock.mockReset()
    getClientAuthSessionSnapshotMock.mockReset()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("sends an email code and enables protection", async () => {
    getClientAuthSessionSnapshotMock.mockImplementation(async ({ forceRefresh } = {}) => ({
      user: {
        email: "owner@dryapi.dev",
        twoFactorEnabled: Boolean(forceRefresh),
      },
      session: {},
    }))
    authClientSendVerificationOtpMock.mockResolvedValue({ data: { success: true }, error: null })
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const path = typeof input === "string" ? new URL(input, "http://localhost").pathname : input instanceof URL ? input.pathname : new URL(input.url).pathname

      if (path === "/api/dashboard/settings/security/two-factor") {
        return new Response(JSON.stringify({ ok: true, twoFactorEnabled: true }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        })
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${path}` }), {
        status: 500,
        headers: {
          "content-type": "application/json",
        },
      })
    }) as typeof fetch

    renderCard()

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Manage protection" })).toBeEnabled()
    })

    expect(screen.queryByText("Protected inbox")).not.toBeInTheDocument()
    expect(screen.queryByText("Open the modal to send a code and confirm a change.")).not.toBeInTheDocument()

    expect(screen.queryByLabelText("Email code")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Manage protection" }))

    await screen.findByRole("dialog", { name: "Enable email OTP protection" })
    expect(screen.getByLabelText("Email code")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Send code" }))

    await waitFor(() => {
      expect(authClientSendVerificationOtpMock).toHaveBeenCalledWith({
        email: "owner@dryapi.dev",
        type: "email-verification",
      })
    })

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Resend code" })).toBeEnabled()
      expect(screen.getByRole("button", { name: "Enable protection" })).toBeEnabled()
    })

    fireEvent.change(screen.getByLabelText("Email code"), {
      target: { value: "123456" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Enable protection" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/dashboard/settings/security/two-factor",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText("Enabled")).toBeInTheDocument()
    })
    expect(toastSuccess).toHaveBeenCalledWith("Email OTP protection enabled")
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Enable email OTP protection" })).not.toBeInTheDocument()
    })
  })

  it("surfaces a session load error", async () => {
    getClientAuthSessionSnapshotMock.mockRejectedValue(new Error("boom"))

    renderCard()

    expect(await screen.findByText("Unable to load account protection settings.")).toBeInTheDocument()
  })
})
