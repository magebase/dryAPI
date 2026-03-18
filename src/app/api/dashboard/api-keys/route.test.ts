import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const {
  getDashboardSessionSnapshotMock,
  listDashboardApiKeysForRequestMock,
  createDashboardApiKeyMock,
} = vi.hoisted(() => ({
  getDashboardSessionSnapshotMock: vi.fn(),
  listDashboardApiKeysForRequestMock: vi.fn(),
  createDashboardApiKeyMock: vi.fn(),
}))

vi.mock("@/lib/dashboard-billing", () => ({
  getDashboardSessionSnapshot: getDashboardSessionSnapshotMock,
}))

vi.mock("@/lib/dashboard-api-keys-store", () => ({
  listDashboardApiKeysForRequest: listDashboardApiKeysForRequestMock,
  createDashboardApiKey: createDashboardApiKeyMock,
}))

import { GET, POST } from "@/app/api/dashboard/api-keys/route"

function authedSession(email = "user@example.com") {
  return { authenticated: true, email }
}

function unauthSession() {
  return { authenticated: false, email: null }
}

function jsonRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/dashboard/api-keys", {
    method,
    headers: { "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe("GET /api/dashboard/api-keys", () => {
  beforeEach(() => {
    getDashboardSessionSnapshotMock.mockReset()
    listDashboardApiKeysForRequestMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(unauthSession())
    const res = await GET(jsonRequest("GET"))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: "unauthorized" })
  })

  it("returns api key list on success", async () => {
    const keys = [{ id: "key_1", name: "My Key" }]
    getDashboardSessionSnapshotMock.mockResolvedValue(authedSession())
    listDashboardApiKeysForRequestMock.mockResolvedValue(keys)

    const res = await GET(jsonRequest("GET"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: keys })
  })

  it("returns 500 when store throws", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(authedSession())
    listDashboardApiKeysForRequestMock.mockRejectedValue(new Error("DB offline"))

    const res = await GET(jsonRequest("GET"))
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: "api_keys_list_failed" })
  })
})

describe("POST /api/dashboard/api-keys", () => {
  beforeEach(() => {
    getDashboardSessionSnapshotMock.mockReset()
    createDashboardApiKeyMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(unauthSession())
    const res = await POST(jsonRequest("POST", { name: "New Key" }))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: "unauthorized" })
  })

  it("creates and returns a new API key with its token", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(authedSession())
    createDashboardApiKeyMock.mockResolvedValue({
      record: { id: "key_new", name: "New Key", enabled: true },
      key: "sk_live_abc123",
    })

    const res = await POST(jsonRequest("POST", { name: "New Key", permissions: ["models:infer"] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.key).toBe("sk_live_abc123")
    expect(body.data.id).toBe("key_new")
  })

  it("returns 500 when store throws", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(authedSession())
    createDashboardApiKeyMock.mockRejectedValue(new Error("key limit reached"))

    const res = await POST(jsonRequest("POST", { name: "Over Limit" }))
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: "api_key_create_failed" })
  })
})
