import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const {
  getDashboardSessionSnapshotMock,
  getDashboardApiKeyForRequestMock,
  deleteDashboardApiKeyMock,
  setDashboardApiKeyEnabledMock,
  rerollDashboardApiKeyMock,
} = vi.hoisted(() => ({
  getDashboardSessionSnapshotMock: vi.fn(),
  getDashboardApiKeyForRequestMock: vi.fn(),
  deleteDashboardApiKeyMock: vi.fn(),
  setDashboardApiKeyEnabledMock: vi.fn(),
  rerollDashboardApiKeyMock: vi.fn(),
}))

vi.mock("@/lib/dashboard-billing", () => ({
  getDashboardSessionSnapshot: getDashboardSessionSnapshotMock,
}))

vi.mock("@/lib/dashboard-api-keys-store", () => ({
  getDashboardApiKeyForRequest: getDashboardApiKeyForRequestMock,
  deleteDashboardApiKey: deleteDashboardApiKeyMock,
  setDashboardApiKeyEnabled: setDashboardApiKeyEnabledMock,
  rerollDashboardApiKey: rerollDashboardApiKeyMock,
}))

import { DELETE, GET, PATCH, POST } from "@/app/api/dashboard/api-keys/[keyId]/route"

function authed(email = "user@example.com") {
  return { authenticated: true, email }
}
function unauth() {
  return { authenticated: false, email: null }
}

function makeContext(keyId: string) {
  return { params: Promise.resolve({ keyId }) }
}

function req(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/dashboard/api-keys/key_123", {
    method,
    headers: { "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const KEY_RECORD = { id: "key_123", name: "Test Key", enabled: true }

describe("GET /api/dashboard/api-keys/[keyId]", () => {
  beforeEach(() => {
    getDashboardSessionSnapshotMock.mockReset()
    getDashboardApiKeyForRequestMock.mockReset()
  })
  afterEach(() => { vi.restoreAllMocks() })

  it("returns 401 when unauthenticated", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(unauth())
    const res = await GET(req("GET"), makeContext("key_123"))
    expect(res.status).toBe(401)
  })

  it("returns 404 when key not found", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(authed())
    getDashboardApiKeyForRequestMock.mockResolvedValue(null)
    const res = await GET(req("GET"), makeContext("key_missing"))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: "not_found" })
  })

  it("returns key record on success", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(authed())
    getDashboardApiKeyForRequestMock.mockResolvedValue(KEY_RECORD)
    const res = await GET(req("GET"), makeContext("key_123"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: KEY_RECORD })
  })
})

describe("DELETE /api/dashboard/api-keys/[keyId]", () => {
  beforeEach(() => {
    getDashboardSessionSnapshotMock.mockReset()
    deleteDashboardApiKeyMock.mockReset()
  })
  afterEach(() => { vi.restoreAllMocks() })

  it("returns 401 when unauthenticated", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(unauth())
    const res = await DELETE(req("DELETE", {}), makeContext("key_123"))
    expect(res.status).toBe(401)
  })

  it("deletes soft by default and returns result", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(authed())
    deleteDashboardApiKeyMock.mockResolvedValue({ deleted: true })

    const res = await DELETE(req("DELETE", {}), makeContext("key_123"))
    expect(res.status).toBe(200)
    expect(deleteDashboardApiKeyMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ permanent: false }),
    )
  })

  it("passes permanent flag when requested", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(authed())
    deleteDashboardApiKeyMock.mockResolvedValue({ deleted: true })

    await DELETE(req("DELETE", { permanent: true }), makeContext("key_123"))
    expect(deleteDashboardApiKeyMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ permanent: true }),
    )
  })
})

describe("PATCH /api/dashboard/api-keys/[keyId]", () => {
  beforeEach(() => {
    getDashboardSessionSnapshotMock.mockReset()
    setDashboardApiKeyEnabledMock.mockReset()
  })
  afterEach(() => { vi.restoreAllMocks() })

  it("returns 401 when unauthenticated", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(unauth())
    const res = await PATCH(req("PATCH", { enabled: false }), makeContext("key_123"))
    expect(res.status).toBe(401)
  })

  it("returns 400 when enabled is not a boolean", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(authed())
    const res = await PATCH(req("PATCH", { enabled: "yes" }), makeContext("key_123"))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "invalid_request" })
  })

  it("returns 404 when key not found", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(authed())
    setDashboardApiKeyEnabledMock.mockResolvedValue(null)
    const res = await PATCH(req("PATCH", { enabled: false }), makeContext("key_missing"))
    expect(res.status).toBe(404)
  })

  it("toggles enabled state and returns updated record", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(authed())
    setDashboardApiKeyEnabledMock.mockResolvedValue({ ...KEY_RECORD, enabled: false })

    const res = await PATCH(req("PATCH", { enabled: false }), makeContext("key_123"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.enabled).toBe(false)
  })
})

describe("POST /api/dashboard/api-keys/[keyId] (rotate)", () => {
  beforeEach(() => {
    getDashboardSessionSnapshotMock.mockReset()
    rerollDashboardApiKeyMock.mockReset()
  })
  afterEach(() => { vi.restoreAllMocks() })

  it("returns 401 when unauthenticated", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(unauth())
    const res = await POST(req("POST", {}), makeContext("key_123"))
    expect(res.status).toBe(401)
  })

  it("returns 404 when key not found during rotation", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(authed())
    rerollDashboardApiKeyMock.mockResolvedValue(null)
    const res = await POST(req("POST", {}), makeContext("key_missing"))
    expect(res.status).toBe(404)
  })

  it("rotates key and returns new token", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(authed())
    rerollDashboardApiKeyMock.mockResolvedValue({
      record: KEY_RECORD,
      key: "sk_live_rotated_xyz",
    })

    const res = await POST(req("POST", { expiration: 0 }), makeContext("key_123"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.key).toBe("sk_live_rotated_xyz")
    expect(body.data.id).toBe("key_123")
  })
})
