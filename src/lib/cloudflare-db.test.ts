import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const getCloudflareContextMock = vi.hoisted(() => vi.fn())
const drizzleMock = vi.hoisted(() => vi.fn())
const poolCtorMock = vi.hoisted(() => vi.fn())
const queryMock = vi.hoisted(() =>
  vi.fn(async ({ text, values }: { text: string; values: unknown[] }) => {
    if (text === "SELECT $1::text AS value") {
      return {
        rows: [{ value: values[0] }],
        rowCount: 1,
      }
    }

    return {
      rows: [],
      rowCount: 1,
    }
  }),
)
const PoolMock = vi.hoisted(
  () =>
    class FakePool {
      options: { connectionString: string; max: number }

      query: typeof queryMock

      constructor(options: { connectionString: string; max: number }) {
        poolCtorMock(options)
        this.options = options
        this.query = queryMock
      }
    },
)

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => getCloudflareContextMock(...args),
}))

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: (...args: unknown[]) => drizzleMock(...args),
}))

vi.mock("pg", () => ({
  Pool: PoolMock,
}))

import { createCloudflareDbAccessors } from "@/lib/cloudflare-db"

describe("createCloudflareDbAccessors", () => {
  const schema = { tables: [] }

  beforeEach(() => {
    getCloudflareContextMock.mockReset()
    drizzleMock.mockReset()
    poolCtorMock.mockReset()
    queryMock.mockReset()

    const cloudflareContext = {
      env: {
        HYPERDRIVE: {
          connectionString: "postgres://hyperdrive.example/dryapi",
        },
      },
    }

    getCloudflareContextMock.mockImplementation((options?: { async?: boolean }) =>
      options?.async ? Promise.resolve(cloudflareContext) : cloudflareContext,
    )

    drizzleMock.mockImplementation((pool: unknown, options: { schema: unknown }) => ({
      pool,
      schema: options.schema,
    }))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("creates cached postgres accessors from Hyperdrive", async () => {
    const accessors = createCloudflareDbAccessors("HYPERDRIVE", schema)

    const binding = accessors.getBinding()
    expect(binding).toEqual(accessors.getPrimaryBinding())
    expect(binding).toEqual(
      expect.objectContaining({
        options: {
          connectionString: "postgres://hyperdrive.example/dryapi",
          max: 1,
        },
      }),
    )

    const db = accessors.getDb()
    expect(db).toEqual({ pool: binding, schema })
    expect(drizzleMock).toHaveBeenCalledTimes(1)

    const sqlDb = accessors.getSqlDb()

    await expect(sqlDb.prepare("SELECT ?::text AS value").bind("hello").all<{ value: string }>()).resolves.toEqual(
      {
        results: [{ value: "hello" }],
      },
    )

    await expect(
      sqlDb.prepare("UPDATE example SET value = ? WHERE id = ?").bind("new", "row_1").run(),
    ).resolves.toEqual({ rowCount: 1 })

    expect(queryMock).toHaveBeenCalledWith({
      text: "SELECT $1::text AS value",
      values: ["hello"],
    })
    expect(queryMock).toHaveBeenCalledWith({
      text: "UPDATE example SET value = $1 WHERE id = $2",
      values: ["new", "row_1"],
    })
  })

  it("creates async accessors from the same connection source", async () => {
    const accessors = createCloudflareDbAccessors("HYPERDRIVE", schema)

    await expect(accessors.getDbAsync()).resolves.toEqual({
      pool: expect.objectContaining({
        options: {
          connectionString: "postgres://hyperdrive.example/dryapi",
          max: 1,
        },
      }),
      schema,
    })

    await expect(accessors.getSqlDbAsync()).resolves.toEqual(
      expect.objectContaining({
        prepare: expect.any(Function),
        batch: expect.any(Function),
        exec: expect.any(Function),
      }),
    )
  })

  it("throws when the connection string is missing", () => {
    vi.stubEnv("DATABASE_URL", "")
    vi.stubEnv("CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE", "")

    getCloudflareContextMock.mockImplementation((options?: { async?: boolean }) =>
      options?.async ? Promise.resolve({ env: {} }) : { env: {} },
    )

    const accessors = createCloudflareDbAccessors("HYPERDRIVE", schema)

    expect(() => accessors.getBinding()).toThrow(
      "Cloudflare Hyperdrive connection HYPERDRIVE is unavailable.",
    )
  })
})
