import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { signOutCurrentSessionMock, signOutOtherSessionsMock, toastError, toastInfo, toastSuccess } = vi.hoisted(() => ({
  signOutCurrentSessionMock: vi.fn(),
  signOutOtherSessionsMock: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    info: toastInfo,
    success: toastSuccess,
  },
}))

vi.mock("@/lib/auth-session-actions", () => ({
  signOutCurrentSession: signOutCurrentSessionMock,
  signOutOtherSessions: signOutOtherSessionsMock,
}))

import { AccountSettingsPanel } from "@/components/site/dashboard/settings/account-settings-panel"
import { invalidateClientAuthSessionSnapshot } from "@/lib/client-auth-session"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })
}

function getRequestPath(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return new URL(input, "https://dryapi.dev").pathname
  }

  if (input instanceof URL) {
    return input.pathname
  }

  return new URL(input.url).pathname
}

function createFetchMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = getRequestPath(input)
    const method = (init?.method || "GET").toUpperCase()

    if (path === "/api/auth/get-session") {
      return jsonResponse({
        user: {
          id: "user_1",
          name: "Owner",
          email: "owner@dryapi.dev",
          role: "user",
          lastLoginMethod: "password",
        },
        session: {
          id: "session_1",
        },
      })
    }

    if (path === "/api/auth/list-sessions") {
      return jsonResponse([
        {
          id: "session_1",
          token: "session_token_1",
          createdAt: "2026-03-21T00:00:00.000Z",
        },
      ])
    }

    if (path === "/api/dashboard/settings/account") {
      return jsonResponse({
        data: {
          currentPlan: {
            slug: "starter",
            label: "Starter",
            status: "active",
            monthlyCredits: 50,
            discountPercent: 5,
          },
        },
      })
    }

    if (path === "/api/dashboard/settings/account/export") {
      return jsonResponse({
        ok: true,
        status: "queued",
        request_id: "req_123",
        next: "Check your email for the secure export link and OTP.",
      }, 202)
    }

    return jsonResponse({ message: `Unhandled request: ${method} ${path}` }, 500)
  })
}

describe("AccountSettingsPanel", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    invalidateClientAuthSessionSnapshot()
    signOutCurrentSessionMock.mockResolvedValue(undefined)
    signOutOtherSessionsMock.mockResolvedValue(undefined)
    toastError.mockClear()
    toastInfo.mockClear()
    toastSuccess.mockClear()
  })

  afterEach(() => {
    invalidateClientAuthSessionSnapshot()
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("renders the active subscription plan label from account summary data", async () => {
    global.fetch = createFetchMock() as unknown as typeof fetch

    render(<AccountSettingsPanel />)

    expect(await screen.findByText("Starter")).toBeInTheDocument()
    expect(screen.queryByText("Developer")).not.toBeInTheDocument()
    expect(
      screen.getByText("Upgrade from Billing to unlock higher limits."),
    ).toBeInTheDocument()
  })

  it("queues an account export when the export button is clicked", async () => {
    const user = userEvent.setup()
    const fetchMock = createFetchMock()
    global.fetch = fetchMock as unknown as typeof fetch

    render(<AccountSettingsPanel />)

    await user.click(await screen.findByRole("button", { name: "Export account data" }))

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/dashboard/settings/account/export",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    )
    expect(toastSuccess).toHaveBeenCalledWith(
      "Export queued",
      expect.objectContaining({
        description: expect.stringContaining("secure export link and OTP"),
      }),
    )
  })
})
