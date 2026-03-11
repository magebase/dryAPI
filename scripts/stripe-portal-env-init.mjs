#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs"

const DEFAULT_ENV_FILE = ".env"
const DEFAULT_SITE_URL = "https://genfix.com.au"

const ENV_KEYS = [
  ["STRIPE_PRIVATE_KEY", ""],
  ["NEXT_PUBLIC_SITE_URL", ""],
  ["SITE_URL", ""],
  ["STRIPE_PORTAL_CONFIGURATION_ID", ""],
  ["STRIPE_PORTAL_CONFIGURATION_NAME", "GenFix Consultancy Plans"],
  ["STRIPE_PORTAL_RETURN_URL", ""],
  ["STRIPE_PORTAL_BUSINESS_HEADLINE", ""],
  ["STRIPE_PORTAL_PRIVACY_POLICY_URL", ""],
  ["STRIPE_PORTAL_TERMS_URL", ""],
  ["STRIPE_PORTAL_BASIC_PRODUCT_ID", ""],
  ["STRIPE_PORTAL_BASIC_MONTHLY_PRICE_ID", ""],
  ["STRIPE_PORTAL_BASIC_ANNUAL_PRICE_ID", ""],
  ["STRIPE_PORTAL_GROWTH_PRODUCT_ID", ""],
  ["STRIPE_PORTAL_GROWTH_MONTHLY_PRICE_ID", ""],
  ["STRIPE_PORTAL_GROWTH_ANNUAL_PRICE_ID", ""],
  ["STRIPE_PORTAL_PRO_PRODUCT_ID", ""],
  ["STRIPE_PORTAL_PRO_MONTHLY_PRICE_ID", ""],
  ["STRIPE_PORTAL_PRO_ANNUAL_PRICE_ID", ""],
]

function clean(value) {
  return typeof value === "string" ? value.trim() : ""
}

function parseArgs(argv) {
  let envFile = DEFAULT_ENV_FILE

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--env-file") {
      envFile = argv[index + 1] || ""
      index += 1
      continue
    }

    if (arg === "-h" || arg === "--help") {
      console.log("Usage: node scripts/stripe-portal-env-init.mjs [--env-file <path>]")
      process.exit(0)
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!envFile) {
    throw new Error("--env-file requires a value")
  }

  return { envFile }
}

function readEnvLines(filePath) {
  if (!existsSync(filePath)) {
    return []
  }

  const content = readFileSync(filePath, "utf8")
  return content.split(/\r?\n/)
}

function parseEnvMap(lines) {
  const map = new Map()

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) {
      continue
    }

    const separatorIndex = line.indexOf("=")
    if (separatorIndex <= 0) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const rawValue = line.slice(separatorIndex + 1)
    const value = rawValue.replace(/^['\"]|['\"]$/g, "")

    if (!map.has(key)) {
      map.set(key, value)
    }
  }

  return map
}

function resolveSiteUrl(localEnvMap) {
  return (
    clean(localEnvMap.get("NEXT_PUBLIC_SITE_URL")) ||
    clean(localEnvMap.get("SITE_URL")) ||
    clean(process.env.NEXT_PUBLIC_SITE_URL) ||
    clean(process.env.SITE_URL) ||
    DEFAULT_SITE_URL
  )
}

function buildDefaults(localEnvMap) {
  const siteUrl = resolveSiteUrl(localEnvMap).replace(/\/+$/, "")

  return {
    STRIPE_PORTAL_RETURN_URL: `${siteUrl}/contact`,
    STRIPE_PORTAL_PRIVACY_POLICY_URL: `${siteUrl}/privacy-policy`,
    STRIPE_PORTAL_TERMS_URL: `${siteUrl}/terms`,
  }
}

function main() {
  const { envFile } = parseArgs(process.argv.slice(2))
  const existingLines = readEnvLines(envFile)
  const existingMap = parseEnvMap(existingLines)
  const dynamicDefaults = buildDefaults(existingMap)

  const missing = []

  for (const [key, fallbackValue] of ENV_KEYS) {
    if (existingMap.has(key)) {
      continue
    }

    const defaultValue = key in dynamicDefaults ? dynamicDefaults[key] : fallbackValue
    missing.push(`${key}=${defaultValue}`)
  }

  if (missing.length === 0) {
    console.log(`No changes needed. All Stripe portal env keys already exist in ${envFile}.`)
    return
  }

  const before = existingLines.length > 0 ? existingLines.join("\n").replace(/\n*$/, "\n") : ""
  const block = [
    "# Stripe Billing Portal (tiered consultancy plans)",
    ...missing,
  ].join("\n")

  writeFileSync(envFile, `${before}\n${block}\n`, "utf8")

  console.log(`Added ${missing.length} Stripe portal env keys to ${envFile}.`)
  console.log("Next: fill in STRIPE_PRIVATE_KEY and tier product/price IDs, then run `pnpm stripe:portal:ensure`.")
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
