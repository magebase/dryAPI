#!/usr/bin/env node
// @ts-nocheck

import { config as loadDotenv } from "dotenv"
import { spawnSync } from "node:child_process"

import { buildTinaProtectedDomains, normalizeHost, resolveBrandSiteHost } from "./lib/cf-zero-trust"

loadDotenv({ path: ".env" })

function usage() {
  console.log(`Usage:
  tsx scripts/cf-zero-trust-tina-disable.ts --brand-key <brand-key> [options]

Example:
  tsx scripts/cf-zero-trust-tina-disable.ts --brand-key dryapi

Required:
  --brand-key <key>      Brand key from content/site/brands.json (defaults to SITE_BRAND_KEY or dryAPI)

Optional:
  --site-host <host>     Override public site hostname from the brand catalog

  --dry-run              Print planned deletions without API changes
  -h, --help             Show this help

Environment:
  CLOUDFLARE_API_TOKEN or CF_API_TOKEN
  CLOUDFLARE_ACCOUNT_ID or CF_ACCOUNT_ID (auto-resolved via wrangler when omitted)
  SITE_BRAND_KEY or DRYAPI_BRAND_KEY (used when --brand-key is omitted)
`)
}

function parseArgs(argv) {
  const args = {
    brandKey: "",
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

    if (value === "--brand-key") {
      args.brandKey = next
      index += 1
      continue
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

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const brandKey = args.brandKey || process.env.SITE_BRAND_KEY || process.env.DRYAPI_BRAND_KEY || ""
  const resolvedBrand = await resolveBrandSiteHost({
    brandKey,
    siteHost: args.siteHost || undefined,
  })

  const siteHost = resolvedBrand.siteHost
  const routes = buildTinaProtectedDomains(siteHost)

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

  const domains = routes

  console.log(`Using account_id=${accountId}`)
  console.log(`Brand=${resolvedBrand.brand.displayName}${brandKey ? ` (${brandKey})` : ""}`)
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
