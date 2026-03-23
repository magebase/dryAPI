import { z } from "zod"

export const dashboardSettingsSectionSchema = z.enum(["general", "security", "webhooks"])

export const dashboardWebhookHealthSchema = z.object({
  validationStatus: z.enum(["unknown", "checking", "healthy", "unhealthy"]).default("unknown"),
  validationMessage: z.string().trim().max(240).default(""),
  lastValidatedAt: z.number().int().nullable().default(null),
  lastStatusCode: z.number().int().nullable().default(null),
  lastSuccessAt: z.number().int().nullable().default(null),
  lastFailureAt: z.number().int().nullable().default(null),
  consecutiveFailures: z.number().int().min(0).default(0),
  alertCount: z.number().int().min(0).default(0),
  lastAlertAt: z.number().int().nullable().default(null),
})

export const dashboardWebhookEntrySchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().max(120).default(""),
  endpointUrl: z.string().trim().url("Enter a valid webhook URL."),
  signingSecret: z.string().trim().min(1, "Signing secret is required.").max(512),
  sendOnCompleted: z.boolean().default(true),
  sendOnFailed: z.boolean().default(true),
  sendOnQueued: z.boolean().default(false),
  includeFullPayload: z.boolean().default(false),
  health: dashboardWebhookHealthSchema.default({
    validationStatus: "unknown",
    validationMessage: "",
    lastValidatedAt: null,
    lastStatusCode: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    consecutiveFailures: 0,
    alertCount: 0,
    lastAlertAt: null,
  }),
})

export const dashboardGeneralSettingsSchema = z.object({
  username: z.string().trim().max(80).default(""),
  fullName: z.string().trim().max(120).default(""),
  email: z.string().trim().email().or(z.literal("")),
  company: z.string().trim().max(160).default(""),
  timezone: z.string().trim().min(1).max(120).default("UTC"),
  defaultModelScope: z.enum(["balanced", "latency", "quality"]).default("balanced"),
})

export const dashboardGeneralSettingsFormSchema = z.object({
  username: z.string().trim().max(80),
  fullName: z.string().trim().max(120),
  email: z.string().trim().email("Enter a valid email address."),
  company: z.string().trim().max(160),
  timezone: z.string().trim().min(1).max(120),
  defaultModelScope: z.enum(["balanced", "latency", "quality"]),
})

export const dashboardSecuritySettingsSchema = z.object({
  requireMfa: z.boolean().default(false),
  rotateKeysMonthly: z.boolean().default(true),
  newDeviceAlerts: z.boolean().default(true),
  ipAllowlistEnabled: z.boolean().default(false),
  sessionTimeoutMinutes: z.string().trim().regex(/^\d+$/).default("120"),
  ipAllowlist: z.string().max(8000).default(""),
})

export const dashboardSecuritySettingsFormSchema = z.object({
  requireMfa: z.boolean(),
  rotateKeysMonthly: z.boolean(),
  newDeviceAlerts: z.boolean(),
  ipAllowlistEnabled: z.boolean(),
  sessionTimeoutMinutes: z
    .string()
    .trim()
    .regex(/^\d+$/, "Session timeout must be a valid number.")
    .refine((value) => {
      const parsed = Number(value)
      return Number.isFinite(parsed) && parsed >= 5 && parsed <= 1440
    }, "Session timeout must be between 5 and 1440 minutes."),
  ipAllowlist: z.string().trim().max(8000),
})

export const dashboardWebhooksSettingsSchema = z.object({
  webhooks: z.array(dashboardWebhookEntrySchema).default([]),
})

export const dashboardWebhooksSettingsFormSchema = z.object({
  webhooks: z.array(dashboardWebhookEntrySchema),
})

export type DashboardGeneralSettings = z.infer<typeof dashboardGeneralSettingsSchema>
export type DashboardSecuritySettings = z.infer<typeof dashboardSecuritySettingsSchema>
export type DashboardWebhookHealth = z.infer<typeof dashboardWebhookHealthSchema>
export type DashboardWebhookEntry = z.infer<typeof dashboardWebhookEntrySchema>
export type DashboardWebhooksSettings = z.infer<typeof dashboardWebhooksSettingsSchema>

export type DashboardSettingsBundle = {
  general: DashboardGeneralSettings
  security: DashboardSecuritySettings
  webhooks: DashboardWebhooksSettings
}

export type DashboardSettingsSection = z.infer<typeof dashboardSettingsSectionSchema>

export type DashboardGeneralSettingsFormValues = z.infer<typeof dashboardGeneralSettingsFormSchema>
export type DashboardSecuritySettingsFormValues = z.infer<typeof dashboardSecuritySettingsFormSchema>
export type DashboardWebhooksSettingsFormValues = z.infer<typeof dashboardWebhooksSettingsFormSchema>

export const DASHBOARD_SETTINGS_DEFAULTS: DashboardSettingsBundle = {
  general: {
    username: "",
    fullName: "",
    email: "",
    company: "",
    timezone: "UTC",
    defaultModelScope: "balanced",
  },
  security: {
    requireMfa: false,
    rotateKeysMonthly: true,
    newDeviceAlerts: true,
    ipAllowlistEnabled: false,
    sessionTimeoutMinutes: "120",
    ipAllowlist: "",
  },
  webhooks: {
    webhooks: [],
  },
}
