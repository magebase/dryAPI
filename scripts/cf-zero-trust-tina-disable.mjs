#!/usr/bin/env node

import { spawnSync } from "node:child_process"

function usage() {
  console.log(`Usage:
  node scripts/cf-zero-trust-tina-disable.mjs --site-host <host> [options]

Example:
  node scripts/cf-zero-trust-tina-disable.mjs --site-host genfix.com.au

Required:
  --site-host <host>     Public site hostname where Tina routes are served

Optional:
  --dry-run              Print planned deletions without API changes
  -h, --help             Show this help

Environment:
  CLOUDFLARE_API_TOKEN or CF_API_TOKEN
  CLOUDFLARE_ACCOUNT_ID or CF_ACCOUNT_ID (auto-resolved via wrangler when omitted)
`)
}

function parseArgs(argv) {
  const args = {
    siteHost: "",
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

    throw new Error(`Unknown argument: ${value}`)
  }

  return args
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

async function cfApi({ token, method, path }) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
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

async function deleteAccessAppsByDomains({ token, accountId, domains, dryRun }) {
  const apps = await cfApi({
    token,
    method: "GET",
    path: `/accounts/${accountId}/access/apps?per_page=1000`,
  })

  const byDomain = new Map()
  for (const app of apps.result || []) {
    const list = byDomain.get(app?.domain) || []
    list.push(app)
    byDomain.set(app?.domain, list)
  }

  let deletedCount = 0

  for (const domain of domains) {
    const matches = byDomain.get(domain) || []
    if (matches.length === 0) {
      console.log(`No Access app found for ${domain}`)
      continue
    }

    for (const app of matches) {
      if (dryRun) {
        console.log(`[dry-run] delete ${domain} (app id: ${app.id})`)
      } else {
        await cfApi({
          token,
          method: "DELETE",
          path: `/accounts/${accountId}/access/apps/${app.id}`,
        })
        console.log(`Deleted ${domain} (app id: ${app.id})`)
      }
      deletedCount += 1
    }
  }

  return deletedCount
}

function buildTinaDomains(siteHost) {
  return [
    `${siteHost}/admin`,
    `${siteHost}/admin/index.html`,
    `${siteHost}/api/tina/*`,
    `${siteHost}/api/tina/gql`,
    `${siteHost}/api/cms/*`,
    `${siteHost}/api/media/*`,
    `${siteHost}/api/verify-zjwt`,
  ]
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const siteHost = ensureHost(args.siteHost, "--site-host")

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

  const domains = buildTinaDomains(siteHost)

  console.log(`Using account_id=${accountId}`)
  console.log(`Site host=${siteHost}`)
  console.log(`Mode=${args.dryRun ? "dry-run" : "apply"}`)

  const deletedCount = await deleteAccessAppsByDomains({
    token,
    accountId,
    domains,
    dryRun: args.dryRun,
  })

  console.log(`\nProcessed ${domains.length} route domains; removed ${deletedCount} Access app(s).`)
  console.log("Tina routes should now be reachable without Cloudflare Access challenges.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
