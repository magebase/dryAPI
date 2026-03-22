// @vitest-environment node

import { createClient, type InValue } from "@libsql/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getDashboardSettingsForUser,
  updateDashboardSettingsSection,
} from "@/lib/dashboard-settings-store"

vi.mock("server-only", () => ({}))

class TestD1PreparedStatement {
  private readonly params: InValue[]

  constructor(
    private readonly client: ReturnType<typeof createClient>,
    private readonly query: string,
    params: InValue[] = [],
  ) {
    this.params = params
  }

  bind(...params: unknown[]): TestD1PreparedStatement {
    return new TestD1PreparedStatement(this.client, this.query, params as InValue[])
  }

  async run(): Promise<{ success: true }> {
    await this.client.execute({ sql: this.query, args: this.params })
    return { success: true }
  }

  async all<T>(): Promise<{ results: T[] }> {
    const result = await this.client.execute({ sql: this.query, args: this.params })
    return { results: result.rows as unknown as T[] }
  }
}

class TestD1Database {
  constructor(private readonly client: ReturnType<typeof createClient>) {}

  prepare(query: string): TestD1PreparedStatement {
    return new TestD1PreparedStatement(this.client, query)
  }
}

const sqliteHandles: ReturnType<typeof createClient>[] = []

function createDb() {
  const client = createClient({ url: ":memory:" })
  sqliteHandles.push(client)

  return {
    client,
    db: new TestD1Database(client),
  }
}

afterEach(() => {
  for (const client of sqliteHandles.splice(0)) {
    client.close()
  }
})

describe("dashboard settings store integration", () => {
  it("returns defaults when no persisted record exists", async () => {
    const { db } = createDb()

    const settings = await getDashboardSettingsForUser("owner@dryapi.dev", { db })

    expect(settings.general.email).toBe("")
    expect(settings.general.timezone).toBe("UTC")
    expect(settings.security.sessionTimeoutMinutes).toBe("120")
    expect(settings.webhooks.sendOnCompleted).toBe(true)
  })

  it("persists each section and loads merged values from database", async () => {
    const { db } = createDb()

    await updateDashboardSettingsSection(
      {
        userEmail: "owner@dryapi.dev",
        section: "general",
        values: {
          username: "dry-owner",
          fullName: "Dry API Owner",
          email: "owner@dryapi.dev",
          company: "dryAPI",
          timezone: "Asia/Singapore",
          defaultModelScope: "quality",
        },
      },
      { db },
    )

    await updateDashboardSettingsSection(
      {
        userEmail: "owner@dryapi.dev",
        section: "security",
        values: {
          requireMfa: true,
          rotateKeysMonthly: true,
          newDeviceAlerts: true,
          ipAllowlistEnabled: true,
          sessionTimeoutMinutes: "45",
          ipAllowlist: "10.10.10.10",
        },
      },
      { db },
    )

    await updateDashboardSettingsSection(
      {
        userEmail: "owner@dryapi.dev",
        section: "webhooks",
        values: {
          endpointUrl: "https://hooks.example.com/dryapi",
          signingSecret: "whsec_test_secret",
          sendOnCompleted: true,
          sendOnFailed: true,
          sendOnQueued: true,
          includeFullPayload: false,
        },
      },
      { db },
    )

    const loaded = await getDashboardSettingsForUser("owner@dryapi.dev", { db })

    expect(loaded.general.username).toBe("dry-owner")
    expect(loaded.general.defaultModelScope).toBe("quality")
    expect(loaded.security.requireMfa).toBe(true)
    expect(loaded.security.sessionTimeoutMinutes).toBe("45")
    expect(loaded.webhooks.endpointUrl).toBe("https://hooks.example.com/dryapi")
    expect(loaded.webhooks.sendOnQueued).toBe(true)
  })

  it("preserves other sections when updating one section", async () => {
    const { db } = createDb()

    await updateDashboardSettingsSection(
      {
        userEmail: "owner@dryapi.dev",
        section: "general",
        values: {
          username: "dry-owner",
          fullName: "Dry API Owner",
          email: "owner@dryapi.dev",
          company: "dryAPI",
          timezone: "UTC",
          defaultModelScope: "balanced",
        },
      },
      { db },
    )

    const afterSecurityUpdate = await updateDashboardSettingsSection(
      {
        userEmail: "owner@dryapi.dev",
        section: "security",
        values: {
          requireMfa: true,
          rotateKeysMonthly: false,
          newDeviceAlerts: true,
          ipAllowlistEnabled: false,
          sessionTimeoutMinutes: "60",
          ipAllowlist: "",
        },
      },
      { db },
    )

    expect(afterSecurityUpdate.general.username).toBe("dry-owner")
    expect(afterSecurityUpdate.general.email).toBe("owner@dryapi.dev")
    expect(afterSecurityUpdate.security.rotateKeysMonthly).toBe(false)
  })

  it("rejects invalid security timeout values", async () => {
    const { db } = createDb()

    await expect(
      updateDashboardSettingsSection(
        {
          userEmail: "owner@dryapi.dev",
          section: "security",
          values: {
            requireMfa: true,
            rotateKeysMonthly: true,
            newDeviceAlerts: true,
            ipAllowlistEnabled: false,
            sessionTimeoutMinutes: "2",
            ipAllowlist: "",
          },
        },
        { db },
      ),
    ).rejects.toThrow("Session timeout must be between 5 and 1440 minutes")
  })
})
