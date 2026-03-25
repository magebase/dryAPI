import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

const {
  authClientSendVerificationOtpMock,
  authClientSignInEmailOtpMock,
  routerRefreshMock,
  routerReplaceMock,
} = vi.hoisted(() => ({
  authClientSendVerificationOtpMock: vi.fn(),
  authClientSignInEmailOtpMock: vi.fn(),
  routerRefreshMock: vi.fn(),
  routerReplaceMock: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefreshMock,
    replace: routerReplaceMock,
  }),
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    emailOtp: {
      sendVerificationOtp: authClientSendVerificationOtpMock,
    },
    signIn: {
      emailOtp: authClientSignInEmailOtpMock,
    },
  },
}))

import { EmailOtpSignInCard } from "@/components/site/auth/email-otp-sign-in-card"

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
      <EmailOtpSignInCard initialEmail="owner@dryapi.dev" />
    </QueryClientProvider>,
  )
}

describe("EmailOtpSignInCard", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    toastSuccess.mockClear()
    toastError.mockClear()
    authClientSendVerificationOtpMock.mockReset()
    authClientSignInEmailOtpMock.mockReset()
    routerRefreshMock.mockReset()
    routerReplaceMock.mockReset()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("sends a sign-in code and signs in with the code", async () => {
    authClientSendVerificationOtpMock.mockResolvedValue({ data: { success: true }, error: null })
    authClientSignInEmailOtpMock.mockResolvedValue({ data: { token: "session_token" }, error: null })
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const path = typeof input === "string" ? new URL(input, "http://localhost").pathname : input instanceof URL ? input.pathname : new URL(input.url).pathname

      if (path === "/api/auth/get-session") {
        return new Response(JSON.stringify({ user: { email: "owner@dryapi.dev" }, session: { id: "session_1" } }), {
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

    fireEvent.click(screen.getByRole("button", { name: "Send code" }))

    await waitFor(() => {
      expect(authClientSendVerificationOtpMock).toHaveBeenCalledWith({
        email: "owner@dryapi.dev",
        type: "sign-in",
      })
    })

    fireEvent.change(screen.getByLabelText("Email code"), {
      target: { value: "654321" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Sign in with code" }))

    await waitFor(() => {
      expect(authClientSignInEmailOtpMock).toHaveBeenCalledWith({
        email: "owner@dryapi.dev",
        otp: "654321",
      })
    })

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith("/dashboard")
    })
    expect(routerRefreshMock).toHaveBeenCalledTimes(1)
    expect(toastSuccess).toHaveBeenCalledWith("Signed in successfully")
  })
})
