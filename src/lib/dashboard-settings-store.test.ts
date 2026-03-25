import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { accessorState } = vi.hoisted(() => {
  const state = {
    rawBinding: {} as Record<string, never>,
    sqlDb: null as null | {
      prepare(query: string): {
        bind: (...values: unknown[]) => {
          run: () => Promise<{ rowCount: number }>
          all: <T>() => Promise<{ results: T[] }>
          first: <T>(column?: string) => Promise<T | null>
        }
      }
    },
    getPrimaryBindingAsync: vi.fn(),
    getPrimaryDbAsync: vi.fn(),
    getSqlDbAsync: vi.fn(),
  }

  state.getPrimaryBindingAsync.mockImplementation(async () => state.rawBinding)
  state.getPrimaryDbAsync.mockImplementation(async () => ({ insert: vi.fn() }))
  state.getSqlDbAsync.mockImplementation(async () => state.sqlDb)

  return { accessorState: state }
})

vi.mock("@/lib/cloudflare-db", () => ({
  HYPERDRIVE_BINDING_PRIORITY: ["HYPERDRIVE"],
  createCloudflareDbAccessors: () => ({
    getPrimaryBindingAsync: (...args: unknown[]) => accessorState.getPrimaryBindingAsync(...args),
    getPrimaryDbAsync: (...args: unknown[]) => accessorState.getPrimaryDbAsync(...args),
    getSqlDbAsync: (...args: unknown[]) => accessorState.getSqlDbAsync(...args),
  }),
}))

import { getDashboardSettingsForUser } from "@/lib/dashboard-settings-store"

function createSqlDb() {
  const queries: string[] = []

  const sqlDb = {
    prepare(query: string) {
      queries.push(query)

      let boundValues: unknown[] = []

      const statement = {
        bind(...values: unknown[]) {
          boundValues = values
          return statement
        },
        async run() {
          queries.push(`${query} ::run ::${JSON.stringify(boundValues)}`)
          return { rowCount: 1 }
        },
        async all<T>() {
          queries.push(`${query} ::all ::${JSON.stringify(boundValues)}`)
          return { results: [] as T[] }
        },
        async first<T>() {
          queries.push(`${query} ::first ::${JSON.stringify(boundValues)}`)
          return null as T | null
        },
      }

      return statement
    },
  }

  return { queries, sqlDb }
}

beforeEach(() => {
  accessorState.rawBinding = {} as Record<string, never>
  accessorState.sqlDb = null
  accessorState.getPrimaryBindingAsync.mockClear()
  accessorState.getPrimaryDbAsync.mockClear()
  accessorState.getSqlDbAsync.mockClear()
})

describe("dashboard-settings-store", () => {
  it("reads dashboard settings through the SQL accessor instead of the raw binding", async () => {
    const { queries, sqlDb } = createSqlDb()
    accessorState.sqlDb = sqlDb

    await expect(getDashboardSettingsForUser("owner@dryapi.dev")).resolves.toMatchObject({
      general: {
        email: "",
        timezone: "UTC",
      },
      security: {
        sessionTimeoutMinutes: "120",
      },
      webhooks: {
        webhooks: [],
      },
    })

    expect(accessorState.getPrimaryBindingAsync).not.toHaveBeenCalled()
    expect(accessorState.getPrimaryDbAsync).not.toHaveBeenCalled()
    expect(accessorState.getSqlDbAsync).toHaveBeenCalled()
    expect(queries.some((query) => query.includes("CREATE TABLE IF NOT EXISTS dashboard_settings_profiles"))).toBe(true)
    expect(queries.some((query) => query.includes("CREATE TABLE IF NOT EXISTS dashboard_webhooks"))).toBe(true)
    expect(queries.some((query) => query.includes("FROM dashboard_settings_profiles"))).toBe(true)
    expect(queries.some((query) => query.includes("FROM dashboard_webhooks"))).toBe(true)
  })
})