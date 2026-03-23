#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { resolveActiveBrand } from "../src/lib/brand-catalog"
import { normalizeHost } from "./lib/cf-zero-trust"

type FetchLike = typeof fetch
type EnvLike = Record<string, string | undefined>

type CloudflareErrorInfo = {
  code?: string | number
  message?: string
}

type CloudflareResultInfo = {
  count?: number
  page?: number
  per_page?: number
  total_count?: number
  total_pages?: number
}

type CloudflareEnvelope<T> = {
  success?: boolean
  errors?: Array<CloudflareErrorInfo>
  messages?: Array<unknown>
  result?: T
  result_info?: CloudflareResultInfo
}

type AvailableAlert = {
  type?: string
  display_name?: string
  description?: string
  filter_options?: Array<unknown>
}

type AvailableAlertsResponse = Record<string, Array<AvailableAlert>>

type ZoneRecord = {
  id?: string
  name?: string
  status?: string
}

type PolicyMechanism = {
  email?: Array<{ id?: string }>
}

type DesiredPolicyMechanism = {
  email: Array<{ id: string }>
}

type PolicyRecord = {
  id?: string
  name?: string
  alert_type?: string
  enabled?: boolean
  alert_interval?: string
  description?: string
  mechanisms?: PolicyMechanism
  filters?: Record<string, unknown>
}

type PolicyFilter = {
  incident_impact?: Array<"INCIDENT_IMPACT_MAJOR" | "INCIDENT_IMPACT_CRITICAL">
  zones?: Array<string>
}

type NotificationAlertType =
  | "http_alert_origin_error"
  | "incident_alert"
  | "maintenance_event_notification"
  | "traffic_anomalies_alert"

type DesiredPolicySpec = {
  name: string
  alertType: NotificationAlertType
  description: string
  enabled: true
  mechanisms: DesiredPolicyMechanism
  filters?: PolicyFilter
}

type PlannedPolicyOperation = {
  kind: "create" | "update" | "unchanged"
  desired: DesiredPolicySpec
  existing?: PolicyRecord
}

type NotificationEnsureResult = {
  brandKey: string
  brandDisplayName: string
  siteHost: string
  zone: {
    id: string
    name: string
  }
  recipients: Array<string>
  policies: Array<{
    name: string
    alertType: NotificationAlertType
    status: "created" | "updated" | "unchanged"
    id?: string
  }>
}

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"
const TRAFFIC_ALERT_TYPE: NotificationAlertType = "traffic_anomalies_alert"

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function unquote(value: string): string {
  return value.replace(/^['"]|['"]$/g, "")
}

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) {
    return
  }

  const content = readFileSync(filePath, "utf8")
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const equalsIndex = trimmed.indexOf("=")
    if (equalsIndex <= 0) {
      continue
    }

    const key = trimmed.slice(0, equalsIndex).trim()
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
      continue
    }

    process.env[key] = unquote(trimmed.slice(equalsIndex + 1).trim())
  }
}

function parseArgs(argv: Array<string>): { brandKey: string; siteHost: string; dryRun: boolean } {
  const args = {
    brandKey: "",
    siteHost: "",
    dryRun: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]

    if (value === "--help" || value === "-h") {
      printUsage()
      process.exit(0)
    }

    if (value === "--dry-run") {
      args.dryRun = true
      continue
    }

    const nextValue = argv[index + 1]
    if (!nextValue) {
      throw new Error(`Missing value for ${value}`)
    }

    if (value === "--brand-key") {
      args.brandKey = nextValue.trim()
      index += 1
      continue
    }

    if (value === "--site-host") {
      args.siteHost = nextValue.trim()
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${value}`)
  }

  return args
}

function printUsage(): void {
  process.stdout.write(`Usage:
  tsx scripts/cf-notifications-ensure.ts [options]

Example:
  tsx scripts/cf-notifications-ensure.ts --brand-key dryapi

Options:
  --brand-key <key>      Brand key from content/site/brands.json
  --site-host <host>     Explicit production hostname to validate against the brand
  --dry-run              Print the planned changes without updating Cloudflare
  -h, --help             Show this help

Environment:
  CLOUDFLARE_API_TOKEN or CF_API_TOKEN
  CLOUDFLARE_ACCOUNT_ID or CF_ACCOUNT_ID (auto-resolved via wrangler when omitted)
  SITE_BRAND_KEY or DRYAPI_BRAND_KEY (used when --brand-key is omitted)
  NEXT_PUBLIC_SITE_URL or SITE_URL (used to resolve the active brand host when available)
  CLOUDFLARE_NOTIFICATION_EMAILS (comma-separated override recipients)
  CLOUDFLARE_NOTIFICATION_ENABLE_TRAFFIC_ANOMALIES=1 (optional enterprise alert)
`)
}

function isTruthy(value: string | undefined): boolean {
  const normalized = clean(value).toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on"
}

function parseCsvList(value: string | undefined): Array<string> {
  const items = clean(value)
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)

  return [...new Set(items)]
}

function extractHostname(value: string | undefined): string {
  const trimmed = clean(value)
  if (!trimmed) {
    return ""
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    return normalizeHost(new URL(candidate).hostname)
  } catch {
    return normalizeHost(trimmed)
  }
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = clean(value)
    if (trimmed) {
      return trimmed
    }
  }

  return ""
}

function normalizeEmailList(values: Array<string>): Array<string> {
  return [...new Set(values.map((value) => clean(value)).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  )
}

function buildMechanisms(recipients: Array<string>): DesiredPolicyMechanism {
  return {
    email: recipients.map((recipient) => ({ id: recipient })),
  }
}

function normalizePolicyFilter(filter?: PolicyFilter): Record<string, unknown> | null {
  if (!filter) {
    return null
  }

  const normalized: Record<string, unknown> = {}
  const zones = Array.isArray(filter.zones)
    ? normalizeEmailList(filter.zones)
    : []
  const incidentImpact = Array.isArray(filter.incident_impact)
    ? [...new Set(filter.incident_impact.map((value) => clean(value)).filter(Boolean))].sort()
    : []

  if (zones.length > 0) {
    normalized.zones = zones
  }

  if (incidentImpact.length > 0) {
    normalized.incident_impact = incidentImpact
  }

  return Object.keys(normalized).length > 0 ? normalized : null
}

function normalizePolicyMechanisms(mechanisms?: PolicyMechanism): Record<string, unknown> {
  const emails = Array.isArray(mechanisms?.email)
    ? normalizeEmailList(mechanisms.email.map((entry) => clean(entry.id)))
    : []

  return {
    email: emails,
  }
}

function normalizeDesiredPolicy(spec: DesiredPolicySpec): Record<string, unknown> {
  return {
    name: spec.name,
    alertType: spec.alertType,
    enabled: spec.enabled,
    description: spec.description,
    mechanisms: normalizePolicyMechanisms(spec.mechanisms),
    filters: normalizePolicyFilter(spec.filters),
  }
}

function normalizeExistingPolicy(policy: PolicyRecord): Record<string, unknown> {
  return {
    name: clean(policy.name),
    alertType: clean(policy.alert_type),
    enabled: Boolean(policy.enabled),
    description: clean(policy.description) || null,
    mechanisms: normalizePolicyMechanisms(policy.mechanisms),
    filters: normalizePolicyFilter(policy.filters as PolicyFilter | undefined),
  }
}

function policiesMatch(existing: PolicyRecord, desired: DesiredPolicySpec): boolean {
  return JSON.stringify(normalizeExistingPolicy(existing)) === JSON.stringify(normalizeDesiredPolicy(desired))
}

function buildDesiredPolicies(input: {
  brandKey: string
  brandDisplayName: string
  siteHost: string
  zoneId: string
  recipients: Array<string>
  enableTrafficAnomalies: boolean
}): Array<DesiredPolicySpec> {
  const policyPrefix = `${input.brandKey} (${input.siteHost})`
  const mechanisms = buildMechanisms(input.recipients)

  const policies: Array<DesiredPolicySpec> = [
    {
      name: `${policyPrefix} origin error alerts`,
      alertType: "http_alert_origin_error",
      enabled: true,
      description: `Notify ${input.brandDisplayName} support when Cloudflare detects elevated origin 5xx responses for ${input.siteHost}.`,
      mechanisms,
      filters: {
        zones: [input.zoneId],
      },
    },
    {
      name: `${policyPrefix} incident alerts`,
      alertType: "incident_alert",
      enabled: true,
      description: `Notify ${input.brandDisplayName} support when Cloudflare reports major or critical incidents.`,
      mechanisms,
      filters: {
        incident_impact: ["INCIDENT_IMPACT_MAJOR", "INCIDENT_IMPACT_CRITICAL"],
      },
    },
    {
      name: `${policyPrefix} maintenance alerts`,
      alertType: "maintenance_event_notification",
      enabled: true,
      description: `Notify ${input.brandDisplayName} support when Cloudflare schedules or updates maintenance.`,
      mechanisms,
    },
  ]

  if (input.enableTrafficAnomalies) {
    policies.push({
      name: `${policyPrefix} traffic anomaly alerts`,
      alertType: TRAFFIC_ALERT_TYPE,
      enabled: true,
      description: `Notify ${input.brandDisplayName} support when Cloudflare detects anomalous traffic for ${input.siteHost}.`,
      mechanisms,
      filters: {
        zones: [input.zoneId],
      },
    })
  }

  return policies
}

function selectMatchingZone(zones: Array<ZoneRecord>, siteHost: string): ZoneRecord {
  const normalizedHost = normalizeHost(siteHost)
  const candidates = zones
    .filter((zone) => {
      const zoneName = clean(zone.name).toLowerCase()
      return Boolean(zoneName) && (normalizedHost === zoneName || normalizedHost.endsWith(`.${zoneName}`))
    })
    .sort((left, right) => clean(right.name).length - clean(left.name).length)

  if (candidates.length === 0) {
    const availableZones = zones
      .map((zone) => clean(zone.name))
      .filter(Boolean)
      .slice(0, 10)
      .join(", ")

    throw new Error(
      `Could not find an active Cloudflare zone for ${normalizedHost}. Active zones: ${availableZones || "none"}.`,
    )
  }

  const selected = candidates[0]
  if (!selected?.id || !selected?.name) {
    throw new Error(`Selected Cloudflare zone for ${normalizedHost} is malformed.`)
  }

  return selected
}

function getAccountIdFromWrangler(): string {
  const attempts = [
    spawnSync("wrangler", ["whoami", "--json"], { encoding: "utf8" }),
    spawnSync("wrangler", ["whoami", "--format", "json"], { encoding: "utf8" }),
  ]

  for (const attempt of attempts) {
    if (attempt.status !== 0 || !attempt.stdout) {
      continue
    }

    try {
      const parsed = JSON.parse(attempt.stdout) as { accounts?: Array<{ id?: string }> }
      const accountId = clean(parsed?.accounts?.[0]?.id)
      if (accountId) {
        return accountId
      }
    } catch {
      // Ignore parse failures and continue to the next attempt.
    }
  }

  return ""
}

function getActiveBrandResolution(args: {
  brandKey: string
  siteHost: string
  env: EnvLike
}): Promise<{ brandKey: string; brandDisplayName: string; siteHost: string }> {
  const hostnameCandidate = extractHostname(
    firstNonEmpty(args.siteHost, args.env.NEXT_PUBLIC_SITE_URL, args.env.SITE_URL),
  )

  return resolveActiveBrand({
    brandKey: args.brandKey || undefined,
    hostname: hostnameCandidate || undefined,
  }).then((brand) => {
    const resolvedHost = normalizeHost(new URL(brand.siteUrl).hostname)
    if (hostnameCandidate && hostnameCandidate !== resolvedHost) {
      throw new Error(
        `Resolved site host (${resolvedHost}) does not match the provided hostname (${hostnameCandidate}) for brand ${brand.key}`,
      )
    }

    return {
      brandKey: brand.key,
      brandDisplayName: brand.displayName,
      siteHost: resolvedHost,
    }
  })
}

function getCloudflareHeaders(token: string, body?: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    accept: "application/json",
    ...(body ? { "content-type": "application/json" } : {}),
  }
}

async function cfRequest<T>(
  fetchImpl: FetchLike,
  token: string,
  pathName: string,
  init: {
    method?: string
    body?: unknown
    searchParams?: URLSearchParams
  } = {},
): Promise<CloudflareEnvelope<T>> {
  const url = new URL(`${CLOUDFLARE_API_BASE}${pathName}`)
  if (init.searchParams) {
    for (const [key, value] of init.searchParams.entries()) {
      url.searchParams.append(key, value)
    }
  }

  const bodyText = init.body === undefined ? undefined : JSON.stringify(init.body)
  const response = await fetchImpl(url, {
    method: init.method || "GET",
    headers: getCloudflareHeaders(token, bodyText),
    body: bodyText,
    cache: "no-store",
  })

  const responseText = await response.text().catch(() => "")
  let parsed: unknown = {}

  if (responseText) {
    try {
      parsed = JSON.parse(responseText)
    } catch {
      parsed = {
        success: false,
        errors: [{ message: responseText }],
      }
    }
  }

  if (!response.ok || (parsed as CloudflareEnvelope<T>).success === false) {
    const rawErrors = (parsed as CloudflareEnvelope<T>).errors
    const errors = Array.isArray(rawErrors) ? rawErrors : []
    const message =
      errors
        .map((error) => clean(error?.message) || JSON.stringify(error))
        .filter(Boolean)
        .join("; ") || response.statusText || `HTTP ${response.status}`

    throw new Error(`Cloudflare API ${init.method || "GET"} ${pathName} failed (${response.status}): ${message}`)
  }

  return parsed as CloudflareEnvelope<T>
}

async function listZones(fetchImpl: FetchLike, token: string, accountId: string): Promise<Array<ZoneRecord>> {
  const perPage = 1000
  const zones: Array<ZoneRecord> = []

  for (let page = 1; ; page += 1) {
    const searchParams = new URLSearchParams()
    searchParams.set("account.id", accountId)
    searchParams.set("status", "active")
    searchParams.set("page", String(page))
    searchParams.set("per_page", String(perPage))

    const response = await cfRequest<Array<ZoneRecord>>(fetchImpl, token, "/zones", {
      searchParams,
    })

    const items = Array.isArray(response.result) ? response.result : []
    zones.push(...items)

    const info = response.result_info
    if (items.length === 0) {
      break
    }

    if (typeof info?.total_count === "number") {
      if (zones.length >= info.total_count) {
        break
      }
      continue
    }

    if (!info || items.length < perPage || (info.total_pages && page >= info.total_pages)) {
      break
    }
  }

  return zones
}

async function listPolicies(fetchImpl: FetchLike, token: string, accountId: string): Promise<Array<PolicyRecord>> {
  const perPage = 1000
  const policies: Array<PolicyRecord> = []

  for (let page = 1; ; page += 1) {
    const searchParams = new URLSearchParams()
    searchParams.set("page", String(page))
    searchParams.set("per_page", String(perPage))

    const response = await cfRequest<Array<PolicyRecord>>(fetchImpl, token, `/accounts/${accountId}/alerting/v3/policies`, {
      searchParams,
    })

    const items = Array.isArray(response.result) ? response.result : []
    policies.push(...items)

    const info = response.result_info
    if (items.length === 0) {
      break
    }

    if (typeof info?.total_count === "number") {
      if (policies.length >= info.total_count) {
        break
      }
      continue
    }

    if (!info || items.length < perPage || (info.total_pages && page >= info.total_pages)) {
      break
    }
  }

  return policies
}

async function fetchAvailableAlerts(fetchImpl: FetchLike, token: string, accountId: string): Promise<Map<string, AvailableAlert>> {
  const response = await cfRequest<AvailableAlertsResponse>(
    fetchImpl,
    token,
    `/accounts/${accountId}/alerting/v3/available_alerts`,
  )

  const flattened = new Map<string, AvailableAlert>()
  for (const alertGroup of Object.values(response.result || {})) {
    for (const alert of alertGroup || []) {
      if (alert?.type) {
        flattened.set(alert.type, alert)
      }
    }
  }

  return flattened
}

function planPolicyOperations(
  existingPolicies: Array<PolicyRecord>,
  desiredPolicies: Array<DesiredPolicySpec>,
): Array<PlannedPolicyOperation> {
  const byName = new Map<string, PolicyRecord>()

  for (const policy of existingPolicies) {
    const name = clean(policy.name)
    if (!name) {
      continue
    }

    if (byName.has(name)) {
      throw new Error(`Duplicate Cloudflare notification policy name found: ${name}`)
    }

    byName.set(name, policy)
  }

  return desiredPolicies.map((desired) => {
    const existing = byName.get(desired.name)
    if (!existing) {
      return {
        kind: "create",
        desired,
      }
    }

    if (policiesMatch(existing, desired)) {
      return {
        kind: "unchanged",
        desired,
        existing,
      }
    }

    return {
      kind: "update",
      desired,
      existing,
    }
  })
}

function buildPolicyBody(spec: DesiredPolicySpec): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: spec.name,
    alert_type: spec.alertType,
    enabled: spec.enabled,
    mechanisms: spec.mechanisms,
    description: spec.description,
  }

  if (spec.filters) {
    body.filters = spec.filters
  }

  return body
}

function assertRequiredAlertTypes(
  availableAlerts: Map<string, AvailableAlert>,
  desiredPolicies: Array<DesiredPolicySpec>,
): void {
  const requiredTypes = new Set(desiredPolicies.map((policy) => policy.alertType))

  for (const type of requiredTypes) {
    if (!availableAlerts.has(type)) {
      throw new Error(
        `Cloudflare account is not eligible for required alert type ${type}. Check the account plan or remove the alert from the defaults.`,
      )
    }
  }
}

function normalizeRecipients(env: EnvLike, siteHost: string): Array<string> {
  const explicitRecipients = normalizeEmailList(
    parseCsvList(firstNonEmpty(env.CLOUDFLARE_NOTIFICATION_EMAILS, env.CLOUDFLARE_NOTIFICATION_EMAIL)),
  )

  if (explicitRecipients.length > 0) {
    return explicitRecipients
  }

  const fallbackRecipient = firstNonEmpty(env.BILLING_SUPPORT_EMAIL) || `support@${siteHost}`
  return [fallbackRecipient]
}

export async function ensureCloudflareNotificationPolicies(args: {
  env?: EnvLike
  fetchImpl?: FetchLike
  brandKey?: string
  siteHost?: string
  dryRun?: boolean
} = {}): Promise<NotificationEnsureResult> {
  const env = args.env ?? process.env
  const fetchImpl = args.fetchImpl ?? fetch

  const apiToken = firstNonEmpty(env.CLOUDFLARE_API_TOKEN, env.CF_API_TOKEN)
  if (!apiToken) {
    throw new Error("CLOUDFLARE_API_TOKEN (or CF_API_TOKEN) is required.")
  }

  const accountId = firstNonEmpty(env.CLOUDFLARE_ACCOUNT_ID, env.CF_ACCOUNT_ID, getAccountIdFromWrangler())
  if (!accountId) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID (or CF_ACCOUNT_ID) is required when wrangler account auto-resolution is unavailable.",
    )
  }

  const brandResolution = await getActiveBrandResolution({
    brandKey: args.brandKey || env.SITE_BRAND_KEY || env.DRYAPI_BRAND_KEY || "",
    siteHost: args.siteHost || "",
    env,
  })

  const recipients = normalizeRecipients(env, brandResolution.siteHost)
  const availableAlerts = await fetchAvailableAlerts(fetchImpl, apiToken, accountId)
  const zones = await listZones(fetchImpl, apiToken, accountId)
  const zone = selectMatchingZone(zones, brandResolution.siteHost)
  const desiredPolicies = buildDesiredPolicies({
    brandKey: brandResolution.brandKey,
    brandDisplayName: brandResolution.brandDisplayName,
    siteHost: brandResolution.siteHost,
    zoneId: zone.id as string,
    recipients,
    enableTrafficAnomalies: isTruthy(env.CLOUDFLARE_NOTIFICATION_ENABLE_TRAFFIC_ANOMALIES),
  })

  assertRequiredAlertTypes(availableAlerts, desiredPolicies)

  const existingPolicies = await listPolicies(fetchImpl, apiToken, accountId)
  const plannedOperations = planPolicyOperations(existingPolicies, desiredPolicies)

  if (args.dryRun) {
    return {
      brandKey: brandResolution.brandKey,
      brandDisplayName: brandResolution.brandDisplayName,
      siteHost: brandResolution.siteHost,
      zone: {
        id: zone.id as string,
        name: zone.name as string,
      },
      recipients,
      policies: plannedOperations.map((operation) => ({
        name: operation.desired.name,
        alertType: operation.desired.alertType,
        status: operation.kind === "create" ? "created" : operation.kind === "update" ? "updated" : "unchanged",
        id: operation.existing?.id,
      })),
    }
  }

  const policyResults: NotificationEnsureResult["policies"] = []

  for (const operation of plannedOperations) {
    if (operation.kind === "unchanged") {
      policyResults.push({
        name: operation.desired.name,
        alertType: operation.desired.alertType,
        status: "unchanged",
        id: operation.existing?.id,
      })
      continue
    }

    const pathName = operation.kind === "create"
      ? `/accounts/${accountId}/alerting/v3/policies`
      : `/accounts/${accountId}/alerting/v3/policies/${operation.existing?.id}`

    const response = await cfRequest<{ id?: string }>(fetchImpl, apiToken, pathName, {
      method: operation.kind === "create" ? "POST" : "PUT",
      body: buildPolicyBody(operation.desired),
    })

    policyResults.push({
      name: operation.desired.name,
      alertType: operation.desired.alertType,
      status: operation.kind === "create" ? "created" : "updated",
      id: clean(response.result?.id) || operation.existing?.id,
    })
  }

  return {
    brandKey: brandResolution.brandKey,
    brandDisplayName: brandResolution.brandDisplayName,
    siteHost: brandResolution.siteHost,
    zone: {
      id: zone.id as string,
      name: zone.name as string,
    },
    recipients,
    policies: policyResults,
  }
}

async function main(): Promise<void> {
  loadEnvFile(".env")
  loadEnvFile(".env.local")

  const args = parseArgs(process.argv.slice(2))

  try {
    const result = await ensureCloudflareNotificationPolicies({
      brandKey: args.brandKey,
      siteHost: args.siteHost,
      dryRun: args.dryRun,
    })

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}

const isMainModule = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false

if (isMainModule) {
  void main()
}

export {
  assertRequiredAlertTypes,
  buildDesiredPolicies,
  buildPolicyBody,
  normalizeExistingPolicy,
  normalizePolicyFilter,
  normalizePolicyMechanisms,
  normalizeDesiredPolicy,
  normalizeRecipients,
  parseArgs,
  parseCsvList,
  planPolicyOperations,
  policiesMatch,
  selectMatchingZone,
}
