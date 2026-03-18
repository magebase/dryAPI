import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const {
  getDashboardSessionSnapshotMock,
  getDashboardSettingsForUserMock,
  updateDashboardSettingsSectionMock,
} = vi.hoisted(() => ({
  getDashboardSessionSnapshotMock: vi.fn(),
  getDashboardSettingsForUserMock: vi.fn(),
  updateDashboardSettingsSectionMock: vi.fn(),
}))

vi.mock("@/lib/dashboard-billing", () => ({
  getDashboardSessionSnapshot: getDashboardSessionSnapshotMock,
}))

vi.mock("@/lib/dashboard-settings-store", () => ({
  getDashboardSettingsForUser: getDashboardSettingsForUserMock,
  updateDashboardSettingsSection: updateDashboardSettingsSectionMock,
}))

import { GET, PATCH } from "@/app/api/dashboard/settings/route"

function authed(email = "user@example.com") {
  return { authenticated: true, email }
}
function unauth() {
  return { authenticated: false, email: null }
}

function makeGetRequest() {
  return new NextRequest("http://localhost/api/dashboard/settings", { method: "GET" })
}

function makePatchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/dashboard/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const SETTINGS_FIXTURE = {
  general: { displayName: "Test User" },
  security: {},
  webhooks: {},
}

describe("GET /api/dashboard/settings", () => {
  beforeEach(() => {
    getDashboardSessionSnapshotMock.mockReset()
    getDashboardSettingsForUserMock.mockReset()
  })
  afterEach(() => { vi.restoreAllMocks() })

  it("returns 401 when unauthenticated", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(unauth())
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: "unauthorized" })
  })

  it("returns settings on success", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(authed())
    getDashboardSettingsForUserMock.mockResolvedValue(SETTINGS_FIXTURE)

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: SETTINGS_FIXTURE })
  })

  it("returns 500 when store throws", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(authed())
    getDashboardSettingsForUserMock.mockRejectedValue(new Error("DB offline"))

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: "settings_load_failed" })
  })
})

describe("PATCH /api/dashboard/settings", () => {
  beforeEach(() => {
    getDashboardSessionSnapshotMock.mockReset()
    updateDashboardSettingsSectionMock.mockReset()
  })
  afterEach(() => { vi.restoreAllMocks() })

  it("returns 401 when unauthenticated", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(unauth())
    const res = await PATCH(makePatchRequest({ section: "general", values: {} }))
    expect(res.status).toBe(401)
  })

  it("returns 400 when payload is missing section", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(authed())
    const res = await PATCH(makePatchRequest({ values: {} }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "invalid_payload" })
  })

  it("returns 400 when section is not a valid enum value", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(authed())
    const res = await PATCH(makePatchRequest({ section: "unknown_section", values: {} }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "invalid_payload" })
  })

  it("updates and returns settings on success", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(authed())
    updateDashboardSettingsSectionMock.mockResolvedValue(SETTINGS_FIXTURE)

    const res = await PATCH(makePatchRequest({ section: "general", values: { displayName: "Test User" } }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: SETTINGS_FIXTURE })
    expect(updateDashboardSettingsSectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: "user@example.com",
        section: "general",
      }),
    )
  })

  it("returns 500 when store throws", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(authed())
    updateDashboardSettingsSectionMock.mockRejectedValue(new Error("write failed"))

    const res = await PATCH(makePatchRequest({ section: "security", values: {} }))
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: "settings_save_failed" })
  })
})
