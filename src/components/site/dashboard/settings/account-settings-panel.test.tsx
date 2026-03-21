import { render, screen } from "@testing-library/react"
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

    return jsonResponse({ message: `Unhandled request: ${method} ${path}` }, 500)
  })
}

describe("AccountSettingsPanel", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    signOutCurrentSessionMock.mockResolvedValue(undefined)
    signOutOtherSessionsMock.mockResolvedValue(undefined)
    toastError.mockClear()
    toastInfo.mockClear()
    toastSuccess.mockClear()
  })

  afterEach(() => {
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
})
