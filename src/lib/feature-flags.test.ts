import { describe, expect, it } from "vitest"

import {
  isAiChatbotEnabledServer,
  isCrmDashboardEnabled,
  isCrmWorkflowAutomationsEnabled,
  isPwaEnabledServer,
  isWorkflowKindEnabled,
  resolveEnabledWorkflowKinds,
} from "@/lib/feature-flags"

describe("feature flags", () => {
  it("defaults to enabled for operational features when unset", () => {
    expect(isAiChatbotEnabledServer({} as NodeJS.ProcessEnv)).toBe(true)
    expect(isPwaEnabledServer({} as NodeJS.ProcessEnv)).toBe(true)
    expect(isCrmDashboardEnabled({} as NodeJS.ProcessEnv)).toBe(true)
    expect(isCrmWorkflowAutomationsEnabled({} as NodeJS.ProcessEnv)).toBe(true)
  })

  it("supports explicit false values", () => {
    const env = {
      FEATURE_AI_CHATBOT_ENABLED: "false",
      FEATURE_PWA_ENABLED: "false",
      FEATURE_CRM_DASHBOARD_ENABLED: "0",
      FEATURE_CRM_WORKFLOW_AUTOMATIONS_ENABLED: "false",
    } as NodeJS.ProcessEnv

    expect(isAiChatbotEnabledServer(env)).toBe(false)
    expect(isPwaEnabledServer(env)).toBe(false)
    expect(isCrmDashboardEnabled(env)).toBe(false)
    expect(isCrmWorkflowAutomationsEnabled(env)).toBe(false)
  })

  it("resolves workflow kinds with optional allow and deny lists", () => {
    const env = {
      FEATURE_WORKFLOW_ENABLED_KINDS: "lead-scoring-and-tagging,review-aggregation-and-posting,internal-kpi-dashboard-sync",
      FEATURE_WORKFLOW_DISABLED_KINDS: "review-aggregation-and-posting",
    } as NodeJS.ProcessEnv

    expect(resolveEnabledWorkflowKinds(env)).toEqual([
      "lead-scoring-and-tagging",
      "internal-kpi-dashboard-sync",
    ])
    expect(isWorkflowKindEnabled("lead-scoring-and-tagging", env)).toBe(true)
    expect(isWorkflowKindEnabled("review-aggregation-and-posting", env)).toBe(false)
  })
})
