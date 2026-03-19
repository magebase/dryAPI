import { z } from "zod"

export const dashboardSettingsSectionSchema = z.enum(["general", "security", "webhooks"])

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
  endpointUrl: z.string().trim().max(2048).default(""),
  signingSecret: z.string().trim().max(512).default(""),
  sendOnCompleted: z.boolean().default(true),
  sendOnFailed: z.boolean().default(true),
  sendOnQueued: z.boolean().default(false),
  includeFullPayload: z.boolean().default(false),
})

export const dashboardWebhooksSettingsFormSchema = z.object({
  endpointUrl: z.string().trim().url("Enter a valid webhook URL."),
  signingSecret: z.string().trim().min(1, "Signing secret is required.").max(512),
  sendOnCompleted: z.boolean(),
  sendOnFailed: z.boolean(),
  sendOnQueued: z.boolean(),
  includeFullPayload: z.boolean(),
})

export type DashboardGeneralSettings = z.infer<typeof dashboardGeneralSettingsSchema>
export type DashboardSecuritySettings = z.infer<typeof dashboardSecuritySettingsSchema>
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
    endpointUrl: "",
    signingSecret: "",
    sendOnCompleted: true,
    sendOnFailed: true,
    sendOnQueued: false,
    includeFullPayload: false,
  },
}
