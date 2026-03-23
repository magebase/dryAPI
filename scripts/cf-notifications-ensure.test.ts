import { describe, expect, it } from "vitest"

import {
  buildDesiredPolicies,
  normalizeRecipients,
  planPolicyOperations,
  selectMatchingZone,
} from "./cf-notifications-ensure"

describe("normalizeRecipients", () => {
  it("uses the configured notification recipients when provided", () => {
    expect(
      normalizeRecipients(
        {
          CLOUDFLARE_NOTIFICATION_EMAILS: "ops@dryapi.dev, support@dryapi.dev, ops@dryapi.dev",
        },
        "dryapi.dev",
      ),
    ).toEqual(["ops@dryapi.dev", "support@dryapi.dev"])
  })

  it("falls back to the site support inbox when no override is present", () => {
    expect(normalizeRecipients({}, "dryapi.dev")).toEqual(["support@dryapi.dev"])
  })
})

describe("selectMatchingZone", () => {
  it("chooses the most specific matching active zone", () => {
    const zone = selectMatchingZone(
      [
        { id: "zone-root", name: "dryapi.dev", status: "active" },
        { id: "zone-api", name: "api.dryapi.dev", status: "active" },
        { id: "zone-other", name: "example.com", status: "active" },
      ],
      "api.dryapi.dev",
    )

    expect(zone).toEqual({
      id: "zone-api",
      name: "api.dryapi.dev",
      status: "active",
    })
  })
})

describe("buildDesiredPolicies", () => {
  it("builds the baseline production alert set", () => {
    const policies = buildDesiredPolicies({
      brandKey: "dryapi",
      brandDisplayName: "dryAPI",
      siteHost: "dryapi.dev",
      zoneId: "zone-root",
      recipients: ["support@dryapi.dev"],
      enableTrafficAnomalies: false,
    })

    expect(policies).toEqual([
      {
        name: "dryapi (dryapi.dev) incident alerts",
        alertType: "incident_alert",
        enabled: true,
        description:
          "Notify dryAPI support when Cloudflare reports major or critical incidents.",
        mechanisms: {
          email: [{ id: "support@dryapi.dev" }],
        },
        filters: {
          incident_impact: ["INCIDENT_IMPACT_MAJOR", "INCIDENT_IMPACT_CRITICAL"],
        },
      },
      {
        name: "dryapi (dryapi.dev) maintenance alerts",
        alertType: "maintenance_event_notification",
        enabled: true,
        description:
          "Notify dryAPI support when Cloudflare schedules or updates maintenance.",
        mechanisms: {
          email: [{ id: "support@dryapi.dev" }],
        },
      },
    ])
  })

  it("adds traffic anomaly alerts when explicitly enabled", () => {
    const policies = buildDesiredPolicies({
      brandKey: "dryapi",
      brandDisplayName: "dryAPI",
      siteHost: "dryapi.dev",
      zoneId: "zone-root",
      recipients: ["support@dryapi.dev"],
      enableTrafficAnomalies: true,
    })

    expect(policies).toHaveLength(3)
    expect(policies[2]).toMatchObject({
      name: "dryapi (dryapi.dev) traffic anomaly alerts",
      alertType: "traffic_anomalies_alert",
      filters: {
        zones: ["zone-root"],
      },
    })
  })
})

describe("planPolicyOperations", () => {
  it("creates new policies and updates drifted ones", () => {
    const desiredPolicies = buildDesiredPolicies({
      brandKey: "dryapi",
      brandDisplayName: "dryAPI",
      siteHost: "dryapi.dev",
      zoneId: "zone-root",
      recipients: ["support@dryapi.dev"],
      enableTrafficAnomalies: false,
    })

    const extraDesiredPolicy = {
      name: "dryapi (dryapi.dev) extra alerts",
      alertType: "incident_alert" as const,
      enabled: true as const,
      description: "Notify dryAPI support about an additional Cloudflare condition.",
      mechanisms: desiredPolicies[0]?.mechanisms ?? {
        email: [{ id: "support@dryapi.dev" }],
      },
    }

    const plan = planPolicyOperations(
      [
        {
          id: "policy-origin",
          name: desiredPolicies[0].name,
          alert_type: desiredPolicies[0].alertType,
          enabled: true,
          description: desiredPolicies[0].description,
          mechanisms: desiredPolicies[0].mechanisms,
          filters: desiredPolicies[0].filters,
        },
        {
          id: "policy-incidents",
          name: desiredPolicies[1].name,
          alert_type: desiredPolicies[1].alertType,
          enabled: true,
          description: "stale description",
          mechanisms: desiredPolicies[1].mechanisms,
          filters: desiredPolicies[1].filters,
        },
      ],
      [...desiredPolicies, extraDesiredPolicy],
    )

    expect(plan.map((entry) => entry.kind)).toEqual(["unchanged", "update", "create"])
    expect(plan[1]?.existing?.id).toBe("policy-incidents")
  })
})
