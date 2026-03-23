import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { getCloudflareContextMock } = vi.hoisted(() => ({
  getCloudflareContextMock: vi.fn(),
}))

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: getCloudflareContextMock,
}))

import {
  __resetInternalWorkerFetchCacheForTests,
  internalWorkerFetch,
} from "@/lib/internal-worker-fetch"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })
}

describe("internalWorkerFetch", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test")
    getCloudflareContextMock.mockReset()
    __resetInternalWorkerFetchCacheForTests()
  })

  afterEach(() => {
    __resetInternalWorkerFetchCacheForTests()
    vi.unstubAllEnvs()
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("uses WORKER_SELF_REFERENCE binding when available", async () => {
    const bindingFetch = vi.fn(async () => jsonResponse({ ok: true }))

    getCloudflareContextMock.mockResolvedValue({
      env: {
        WORKER_SELF_REFERENCE: {
          fetch: bindingFetch,
        },
      },
    })

    await internalWorkerFetch({
      path: "/api/auth/get-session",
      init: {
        method: "GET",
      },
    })

    expect(bindingFetch).toHaveBeenCalledTimes(1)
    expect(bindingFetch).toHaveBeenCalledWith(
      "https://internal/api/auth/get-session",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("falls back to origin fetch in non-production when binding is unavailable", async () => {
    getCloudflareContextMock.mockRejectedValue(new Error("context unavailable"))

    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }))
    global.fetch = fetchMock as unknown as typeof fetch

    await internalWorkerFetch({
      path: "/api/v1/usage",
      fallbackOrigin: "https://dryapi.dev",
      init: {
        method: "GET",
      },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://dryapi.dev/api/v1/usage",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("falls back to origin when binding fetch fails and suppresses repeated binding attempts", async () => {
    const bindingFetch = vi.fn(async () => {
      throw new Error("DNS lookup failed for internal")
    })

    getCloudflareContextMock.mockResolvedValue({
      env: {
        WORKER_SELF_REFERENCE: {
          fetch: bindingFetch,
        },
      },
    })

    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }))
    global.fetch = fetchMock as unknown as typeof fetch

    await internalWorkerFetch({
      path: "/api/v1/usage",
      fallbackOrigin: "https://dryapi.dev",
      init: {
        method: "GET",
      },
    })

    await internalWorkerFetch({
      path: "/api/v1/models",
      fallbackOrigin: "https://dryapi.dev",
      init: {
        method: "GET",
      },
    })

    expect(bindingFetch).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://dryapi.dev/api/v1/usage",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://dryapi.dev/api/v1/models",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("throws for invalid non-rooted paths", async () => {
    await expect(
      internalWorkerFetch({
        path: "api/v1/usage",
        fallbackOrigin: "https://dryapi.dev",
      }),
    ).rejects.toThrow("Internal worker fetch path must start with '/'")
  })
})