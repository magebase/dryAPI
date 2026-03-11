#!/usr/bin/env node

import { spawnSync } from "node:child_process"

function usage() {
  console.log(`Usage:
  node scripts/cf-zero-trust-admin-provision.mjs --site-host <host> --cal-host <host> [options]

Example:
  node scripts/cf-zero-trust-admin-provision.mjs \
    --site-host genfix.com.au \
    --cal-host cal.genfix.com.au \
    --crm-host crm.genfix.com.au \
    --allow-emails editor@example.com,owner@example.com

Required:
  --site-host <host>     Public site hostname (for Tina admin/API routes)
  --cal-host <host>      Cal.com hostname (for Cal admin routes)

Allowlist (required: at least one):
  --allow-emails <csv>   Email allowlist for Access policy
  --allow-domains <csv>  Email domain allowlist for Access policy

Optional:
  --crm-host <host>      CRM hostname (default: crm.<site-host>)
  --policy-name <name>   Access policy name (default: GenFix Zero Trust allowlist)
  --dry-run              Print planned actions without writing changes
  -h, --help             Show this help

Environment:
  CLOUDFLARE_API_TOKEN or CF_API_TOKEN
  CLOUDFLARE_ACCOUNT_ID or CF_ACCOUNT_ID (auto-resolved via wrangler when omitted)
`)
}

function parseArgs(argv) {
  const args = {
    siteHost: "",
    calHost: "",
    crmHost: "",
    allowEmails: "",
    allowDomains: "",
    policyName: "GenFix Zero Trust allowlist",
    dryRun: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]

    if (value === "-h" || value === "--help") {
      usage()
      process.exit(0)
    }

    if (value === "--dry-run") {
      args.dryRun = true
      continue
    }

    const next = argv[index + 1]
    if (!next) {
      throw new Error(`Missing value for ${value}`)
    }

    if (value === "--site-host") {
      args.siteHost = next
      index += 1
      continue
    }

    if (value === "--cal-host") {
      args.calHost = next
      index += 1
      continue
    }

    if (value === "--crm-host") {
      args.crmHost = next
      index += 1
      continue
    }

    if (value === "--allow-emails") {
      args.allowEmails = next
      index += 1
      continue
    }

    if (value === "--allow-domains") {
      args.allowDomains = next
      index += 1
      continue
    }

    if (value === "--policy-name") {
      args.policyName = next
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${value}`)
  }

  return args
}

function parseCsv(value) {
  if (!value) {
    return []
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeHost(host) {
  return host.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "")
}

function ensureHost(host, flagName) {
  if (!host) {
    throw new Error(`${flagName} is required`)
  }

  const normalized = normalizeHost(host)
  if (!/^[a-z0-9.-]+$/.test(normalized)) {
    throw new Error(`${flagName} must be a valid hostname`)
  }

  return normalized
}

function resolveAccountIdFromWrangler() {
  const attemptJson = spawnSync("wrangler", ["whoami", "--json"], {
    encoding: "utf8",
  })

  if (attemptJson.status === 0 && attemptJson.stdout) {
    try {
      const parsed = JSON.parse(attemptJson.stdout)
      const id = parsed?.accounts?.[0]?.id
      if (typeof id === "string" && id.trim()) {
        return id.trim()
      }
    } catch {
      // Fall through to --format json.
    }
  }

  const attemptFormatJson = spawnSync("wrangler", ["whoami", "--format", "json"], {
    encoding: "utf8",
  })

  if (attemptFormatJson.status === 0 && attemptFormatJson.stdout) {
    try {
      const parsed = JSON.parse(attemptFormatJson.stdout)
      const id = parsed?.accounts?.[0]?.id
      if (typeof id === "string" && id.trim()) {
        return id.trim()
      }
    } catch {
      // Return empty below.
    }
  }

  return ""
}

async function cfApi({ token, method, path, body }) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await response.text()

  let parsed
  try {
    parsed = text ? JSON.parse(text) : {}
  } catch {
    parsed = { success: false, errors: [{ message: text || "Non-JSON Cloudflare response" }] }
  }

  if (!response.ok || parsed?.success === false) {
    const message = (parsed?.errors || [])
      .map((error) => error?.message || JSON.stringify(error))
      .filter(Boolean)
      .join("; ")
    throw new Error(`Cloudflare API ${method} ${path} failed: ${message || response.statusText}`)
  }

  return parsed
}

async function upsertAccessApp({ token, accountId, routeDomain, appName, dryRun }) {
  const apps = await cfApi({
    token,
    method: "GET",
    path: `/accounts/${accountId}/access/apps?per_page=1000`,
  })

  const existing = (apps.result || []).find((app) => app?.domain === routeDomain)

  const payload = {
    name: appName,
    domain: routeDomain,
    type: "self_hosted",
    app_launcher_visible: false,
    auto_redirect_to_identity: false,
    session_duration: "24h",
  }

  if (dryRun) {
    const aud = existing?.aud || `dry-run-aud:${routeDomain}`
    const id = existing?.id || `dry-run-id:${routeDomain}`
    console.log(`[dry-run] upsert app ${routeDomain} (${existing ? "update" : "create"})`)
    return { id, aud }
  }

  const result = existing
    ? await cfApi({
        token,
        method: "PUT",
        path: `/accounts/${accountId}/access/apps/${existing.id}`,
        body: payload,
      })
    : await cfApi({
        token,
        method: "POST",
        path: `/accounts/${accountId}/access/apps`,
        body: payload,
      })

  const appId = result?.result?.id || existing?.id
  const aud = result?.result?.aud || existing?.aud

  if (!appId || !aud) {
    throw new Error(`Unable to determine app id/audience for ${routeDomain}`)
  }

  return { id: appId, aud }
}

async function replacePolicy({
  token,
  accountId,
  appId,
  policyName,
  includeRules,
  dryRun,
}) {
  if (dryRun) {
    console.log(`[dry-run] replace policy ${policyName} on app ${appId}`)
    return
  }

  const existingPolicies = await cfApi({
    token,
    method: "GET",
    path: `/accounts/${accountId}/access/apps/${appId}/policies?per_page=1000`,
  })

  for (const policy of existingPolicies.result || []) {
    if (policy?.name !== policyName) {
      continue
    }

    await cfApi({
      token,
      method: "DELETE",
      path: `/accounts/${accountId}/access/apps/${appId}/policies/${policy.id}`,
    })
  }

  await cfApi({
    token,
    method: "POST",
    path: `/accounts/${accountId}/access/apps/${appId}/policies`,
    body: {
      name: policyName,
      decision: "allow",
      include: includeRules,
      require: [],
      exclude: [],
    },
  })
}

function buildIncludeRules({ emails, domains }) {
  const rules = []

  for (const email of emails) {
    rules.push({ email: { email } })
  }

  for (const domain of domains) {
    rules.push({ email_domain: { domain: domain.replace(/^@/, "").toLowerCase() } })
  }

  return rules
}

function buildRouteDefinitions(siteHost, calHost, crmHost) {
  return [
    {
      key: "tina-admin-root",
      domain: `${siteHost}/admin`,
      name: "GenFix Tina Admin (/admin)",
      includeInOriginAud: true,
    },
    {
      key: "tina-admin-index",
      domain: `${siteHost}/admin/index.html`,
      name: "GenFix Tina Admin (/admin/index.html)",
      includeInOriginAud: true,
    },
    {
      key: "tina-api-tina",
      domain: `${siteHost}/api/tina/*`,
      name: "GenFix Tina API (/api/tina/*)",
      includeInOriginAud: true,
    },
    {
      key: "tina-api-cms",
      domain: `${siteHost}/api/cms/*`,
      name: "GenFix CMS API (/api/cms/*)",
      includeInOriginAud: true,
    },
    {
      key: "tina-api-media",
      domain: `${siteHost}/api/media/*`,
      name: "GenFix Media API (/api/media/*)",
      includeInOriginAud: true,
    },
    {
      key: "tina-api-verify-zjwt",
      domain: `${siteHost}/api/verify-zjwt`,
      name: "GenFix Verify ZJWT (/api/verify-zjwt)",
      includeInOriginAud: true,
    },
    {
      key: "cal-admin-root",
      domain: `${calHost}/admin`,
      name: "GenFix Cal Admin (/admin)",
      includeInOriginAud: false,
    },
    {
      key: "cal-admin-prefix",
      domain: `${calHost}/admin/*`,
      name: "GenFix Cal Admin (/admin/*)",
      includeInOriginAud: false,
    },
    {
      key: "cal-apps-admin-root",
      domain: `${calHost}/apps/admin`,
      name: "GenFix Cal Admin (/apps/admin)",
      includeInOriginAud: false,
    },
    {
      key: "cal-apps-admin-prefix",
      domain: `${calHost}/apps/admin/*`,
      name: "GenFix Cal Admin (/apps/admin/*)",
      includeInOriginAud: false,
    },
    {
      key: "crm-root",
      domain: crmHost,
      name: "GenFix CRM (root)",
      includeInOriginAud: true,
    },
    {
      key: "crm-prefix",
      domain: `${crmHost}/*`,
      name: "GenFix CRM (all paths)",
      includeInOriginAud: true,
    },
  ]
}

async function getTeamDomain({ token, accountId, dryRun }) {
  if (dryRun) {
    return "dry-run.cloudflareaccess.com"
  }

  const org = await cfApi({
    token,
    method: "GET",
    path: `/accounts/${accountId}/access/organizations`,
  })

  const domain = (org?.result?.auth_domain || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "")
  if (!domain) {
    throw new Error("Unable to resolve Cloudflare Access team domain from access organization.")
  }

  return domain
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const siteHost = ensureHost(args.siteHost, "--site-host")
  const calHost = ensureHost(args.calHost, "--cal-host")
  const crmHost = ensureHost(args.crmHost || `crm.${siteHost}`, "--crm-host")

  const token =
    process.env.CLOUDFLARE_API_TOKEN?.trim() || process.env.CF_API_TOKEN?.trim() || ""
  if (!token) {
    throw new Error("CLOUDFLARE_API_TOKEN (or CF_API_TOKEN) is required.")
  }

  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ||
    process.env.CF_ACCOUNT_ID?.trim() ||
    resolveAccountIdFromWrangler()

  if (!accountId) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID (or CF_ACCOUNT_ID) is required when wrangler account auto-resolution is unavailable."
    )
  }

  const allowEmails = parseCsv(args.allowEmails || process.env.ACCESS_ALLOW_EMAILS || process.env.TINA_ALLOWED_GOOGLE_EMAILS)
  const allowDomains = parseCsv(
    args.allowDomains || process.env.ACCESS_ALLOW_DOMAINS || process.env.TINA_ALLOWED_GOOGLE_DOMAINS
  ).map((domain) => domain.replace(/^@/, "").toLowerCase())

  if (allowEmails.length === 0 && allowDomains.length === 0) {
    throw new Error(
      "Access allowlist is empty. Provide --allow-emails and/or --allow-domains (or set ACCESS_ALLOW_EMAILS / ACCESS_ALLOW_DOMAINS)."
    )
  }

  const includeRules = buildIncludeRules({ emails: allowEmails, domains: allowDomains })
  const routes = buildRouteDefinitions(siteHost, calHost, crmHost)

  console.log(`Using account_id=${accountId}`)
  console.log(`Site host=${siteHost}`)
  console.log(`Cal host=${calHost}`)
  console.log(`CRM host=${crmHost}`)

  const results = []
  for (const route of routes) {
    const app = await upsertAccessApp({
      token,
      accountId,
      routeDomain: route.domain,
      appName: route.name,
      dryRun: args.dryRun,
    })

    await replacePolicy({
      token,
      accountId,
      appId: app.id,
      policyName: args.policyName,
      includeRules,
      dryRun: args.dryRun,
    })

    results.push({
      ...route,
      appId: app.id,
      aud: app.aud,
    })

    console.log(`Access app ready: ${route.domain}`)
  }

  const teamDomain = await getTeamDomain({ token, accountId, dryRun: args.dryRun })

  const tinaAuds = Array.from(
    new Set(results.filter((route) => route.includeInOriginAud).map((route) => route.aud).filter(Boolean))
  )

  if (tinaAuds.length === 0) {
    throw new Error("No Tina route audiences were collected for CLOUDFLARE_ACCESS_AUD.")
  }

  console.log("\nZero Trust environment values:")
  console.log(`CLOUDFLARE_ACCESS_TEAM_DOMAIN=${teamDomain}`)
  console.log(`CLOUDFLARE_ACCESS_AUD=${tinaAuds.join(",")}`)

  if (allowEmails.length > 0) {
    console.log(`TINA_ALLOWED_GOOGLE_EMAILS=${allowEmails.join(",")}`)
  }

  if (allowDomains.length > 0) {
    console.log(`TINA_ALLOWED_GOOGLE_DOMAINS=${allowDomains.join(",")}`)
  }

  console.log("\nTina protected routes covered:")
  for (const route of results.filter((item) => item.includeInOriginAud)) {
    console.log(`- ${route.domain}`)
  }

  console.log("\nCal admin routes covered:")
  for (const route of results.filter((item) => !item.includeInOriginAud)) {
    console.log(`- ${route.domain}`)
  }

  console.log("\nCRM routes covered:")
  for (const route of results.filter((item) => item.key.startsWith("crm-"))) {
    console.log(`- ${route.domain}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
