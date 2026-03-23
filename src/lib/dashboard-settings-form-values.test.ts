import { describe, expect, it } from "vitest"

import { buildGeneralSettingsFormValues } from "@/lib/dashboard-settings-form-values"
import { DASHBOARD_SETTINGS_DEFAULTS } from "@/lib/dashboard-settings-schema"

describe("buildGeneralSettingsFormValues", () => {
  it("merges stored values with session defaults", () => {
    const values = buildGeneralSettingsFormValues(
      {
        ...DASHBOARD_SETTINGS_DEFAULTS.general,
        username: "",
        fullName: "",
        email: "",
      },
      {
        name: "Ada Lovelace",
        email: "ada@dryapi.dev",
      },
    )

    expect(values).toEqual({
      ...DASHBOARD_SETTINGS_DEFAULTS.general,
      username: "ada-lovelace",
      fullName: "Ada Lovelace",
      email: "ada@dryapi.dev",
    })
  })

  it("keeps stored values when present", () => {
    const values = buildGeneralSettingsFormValues(
      {
        ...DASHBOARD_SETTINGS_DEFAULTS.general,
        username: "stored-user",
        fullName: "Stored Name",
        email: "stored@dryapi.dev",
      },
      {
        name: "Ada Lovelace",
        email: "ada@dryapi.dev",
      },
    )

    expect(values).toEqual({
      ...DASHBOARD_SETTINGS_DEFAULTS.general,
      username: "stored-user",
      fullName: "Stored Name",
      email: "stored@dryapi.dev",
    })
  })
})