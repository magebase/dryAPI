#!/usr/bin/env node
// @ts-nocheck

import path from "node:path"
import { pathToFileURL } from "node:url"
import { existsSync, readFileSync, writeFileSync } from "node:fs"

const STRIPE_API_BASE = "https://api.stripe.com"

const PLAN_SPECS = [
  {
    slug: "starter",
    label: "Starter",
    monthlyEnvKey: "STRIPE_SAAS_PRICE_STARTER",
    annualEnvKey: "STRIPE_SAAS_ANNUAL_PRICE_STARTER",
    portalProductEnvKey: "STRIPE_PORTAL_BASIC_PRODUCT_ID",
    portalMonthlyEnvKey: "STRIPE_PORTAL_BASIC_MONTHLY_PRICE_ID",
    portalAnnualEnvKey: "STRIPE_PORTAL_BASIC_ANNUAL_PRICE_ID",
    defaultMonthlyUnitAmountCents: 4900,
    annualDiscountPercent: 15,
    discountPercent: 15,
    monthlyTokens: 100_000,
  },
  {
    slug: "growth",
    label: "Growth",
    monthlyEnvKey: "STRIPE_SAAS_PRICE_GROWTH",
    annualEnvKey: "STRIPE_SAAS_ANNUAL_PRICE_GROWTH",
    portalProductEnvKey: "STRIPE_PORTAL_GROWTH_PRODUCT_ID",
    portalMonthlyEnvKey: "STRIPE_PORTAL_GROWTH_MONTHLY_PRICE_ID",
    portalAnnualEnvKey: "STRIPE_PORTAL_GROWTH_ANNUAL_PRICE_ID",
    defaultMonthlyUnitAmountCents: 19900,
    annualDiscountPercent: 10,
    discountPercent: 10,
    monthlyTokens: 500_000,
  },
  {
    slug: "scale",
    label: "Scale",
    monthlyEnvKey: "STRIPE_SAAS_PRICE_SCALE",
    annualEnvKey: "STRIPE_SAAS_ANNUAL_PRICE_SCALE",
    portalProductEnvKey: "STRIPE_PORTAL_PRO_PRODUCT_ID",
    portalMonthlyEnvKey: "STRIPE_PORTAL_PRO_MONTHLY_PRICE_ID",
    portalAnnualEnvKey: "STRIPE_PORTAL_PRO_ANNUAL_PRICE_ID",
    defaultMonthlyUnitAmountCents: 79900,
    annualDiscountPercent: 5,
    discountPercent: 5,
    monthlyTokens: 2_000_000,
  },
]

function buildPlanEnvOutput(plan, { productId, monthlyPriceId, annualPriceId }) {
  return {
    [plan.monthlyEnvKey]: monthlyPriceId,
    [plan.annualEnvKey]: annualPriceId,
    [plan.portalProductEnvKey]: productId,
    [plan.portalMonthlyEnvKey]: monthlyPriceId,
    [plan.portalAnnualEnvKey]: annualPriceId,
  }
}

function isEntrypoint() {
  const argvPath = process.argv[1]

  if (!argvPath) {
    return false
  }

  return pathToFileURL(path.resolve(argvPath)).href === import.meta.url
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return
  }

  const content = readFileSync(filePath, "utf8")
  const lines = content.split(/\r?\n/)

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
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
      continue
    }

    process.env[key] = line.slice(separatorIndex + 1)
  }
}

function loadStripeSaasPlanEnvFiles() {
  loadEnvFile(".env.local")
  loadEnvFile(".env")
}

function upsertEnvFile(filePath, entries) {
  const existing = existsSync(filePath) ? readFileSync(filePath, "utf8") : ""
  const lines = existing.length > 0 ? existing.split(/\r?\n/) : []
  const nextLines = [...lines]

  for (const [key, value] of Object.entries(entries)) {
    const linePrefix = `${key}=`
    const existingIndex = nextLines.findIndex((line) => line.trimStart().startsWith(linePrefix))

    if (existingIndex >= 0) {
      nextLines[existingIndex] = `${key}=${value}`
    } else {
      if (nextLines.length > 0 && nextLines[nextLines.length - 1].trim() !== "") {
        nextLines.push("")
      }
      nextLines.push(`${key}=${value}`)
    }
  }

  const finalContent = `${nextLines.join("\n").replace(/\n*$/, "")}\n`
  writeFileSync(filePath, finalContent, "utf8")
}

function clean(value) {
  return typeof value === "string" ? value.trim() : ""
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    writeEnvFiles: [],
  }

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--") {
      continue
    }

    if (arg === "--dry-run") {
      options.dryRun = true
      continue
    }

    if (arg === "--write-env") {
      const filePath = clean(argv[index + 1])
      if (!filePath) {
        throw new Error("--write-env requires a file path")
      }
      options.writeEnvFiles.push(filePath)
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function appendStripeParam(params, key, value) {
  if (value === undefined || value === null) {
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      appendStripeParam(params, `${key}[${index}]`, entry)
    })
    return
  }

  if (typeof value === "object") {
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      appendStripeParam(params, `${key}[${nestedKey}]`, nestedValue)
    }
    return
  }

  if (typeof value === "boolean") {
    params.append(key, value ? "true" : "false")
    return
  }

  params.append(key, String(value))
}

function toStripeBody(payload) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(payload)) {
    appendStripeParam(params, key, value)
  }

  return params
}

function resolveDefaultAnnualUnitAmountCents(monthlyUnitAmountCents, annualDiscountPercent) {
  return Math.round(monthlyUnitAmountCents * 12 * (1 - annualDiscountPercent / 100))
}

async function stripeRequest(apiKey, path, { method = "GET", body } = {}) {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${apiKey}`,
      ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body ? toStripeBody(body).toString() : undefined,
  })

  const responseText = await response.text()

  if (!response.ok) {
    throw new Error(`Stripe ${method} ${path} failed (${response.status}): ${responseText}`)
  }

  return responseText ? JSON.parse(responseText) : {}
}

async function listAll(apiKey, path) {
  const out = []
  let hasMore = true
  let startingAfter = ""

  while (hasMore) {
    const pageUrl = new URL(`${STRIPE_API_BASE}${path}`)
    pageUrl.searchParams.set("limit", "100")

    if (startingAfter) {
      pageUrl.searchParams.set("starting_after", startingAfter)
    }

    const payload = await stripeRequest(apiKey, pageUrl.pathname + pageUrl.search)
    const items = Array.isArray(payload.data) ? payload.data : []
    out.push(...items)

    hasMore = Boolean(payload.has_more)
    startingAfter = items.length > 0 ? items[items.length - 1].id : ""

    if (!startingAfter && hasMore) {
      break
    }
  }

  return out
}

async function ensurePlanProduct(apiKey, { dryRun, currency, plan }) {
  const products = await listAll(apiKey, "/v1/products?active=true")
  const existing = products.find((item) => {
    const metadata = item?.metadata || {}
    return metadata.kind === "saas_credit_discount" && metadata.plan_slug === plan.slug
  })

  if (existing) {
    return { created: false, product: existing }
  }

  const payload = {
    name: `dryAPI ${plan.label}`,
    active: true,
    metadata: {
      kind: "saas_credit_discount",
      plan_slug: plan.slug,
      plan_discount_percent: String(plan.discountPercent),
      annual_discount_percent: String(plan.annualDiscountPercent),
      monthly_tokens: String(plan.monthlyTokens),
      currency,
      managed_by: "stripe-saas-plans-ensure-script",
    },
  }

  if (dryRun) {
    return { created: true, product: { id: `prod_dry_${plan.slug}`, ...payload } }
  }

  const product = await stripeRequest(apiKey, "/v1/products", {
    method: "POST",
    body: payload,
  })

  return { created: true, product }
}

async function ensurePlanPrice(apiKey, {
  dryRun,
  currency,
  plan,
  productId,
  unitAmountCents,
  billingPeriod,
  interval,
}) {
  if (dryRun) {
    return {
      created: true,
      price: {
        id: `price_dry_${plan.slug}_${billingPeriod}`,
        product: productId,
        currency,
        unit_amount: unitAmountCents,
        recurring: {
          interval,
          usage_type: "licensed",
        },
      },
    }
  }

  const activePrices = await listAll(apiKey, `/v1/prices?active=true&product=${encodeURIComponent(productId)}`)
  const existing = activePrices.find((price) => {
    const metadata = price?.metadata || {}
    const metadataPeriod = clean(metadata.billing_period)
      || (price?.recurring?.interval === "year" ? "annual" : "monthly")

    return (
      price?.recurring?.interval === interval
      && price?.type === "recurring"
      && Number(price?.unit_amount || 0) === unitAmountCents
      && metadata.plan_slug === plan.slug
      && metadataPeriod === billingPeriod
    )
  })

  if (existing) {
    return { created: false, price: existing }
  }

  const payload = {
    product: productId,
    currency,
    unit_amount: unitAmountCents,
    recurring: {
      interval,
      usage_type: "licensed",
    },
    nickname: `dryAPI ${plan.label} ${billingPeriod}`,
    metadata: {
      kind: "saas_credit_discount",
      plan_slug: plan.slug,
      billing_period: billingPeriod,
      plan_discount_percent: String(plan.discountPercent),
      annual_discount_percent: String(plan.annualDiscountPercent),
      monthly_tokens: String(plan.monthlyTokens),
      managed_by: "stripe-saas-plans-ensure-script",
    },
  }

  const price = await stripeRequest(apiKey, "/v1/prices", {
    method: "POST",
    body: payload,
  })

  return { created: true, price }
}

async function main() {
  const options = parseArgs(process.argv)

  loadStripeSaasPlanEnvFiles()
  for (const filePath of options.writeEnvFiles) {
    loadEnvFile(filePath)
  }

  const apiKey = clean(process.env.STRIPE_PRIVATE_KEY)
  if (!apiKey) {
    throw new Error("Missing STRIPE_PRIVATE_KEY in environment")
  }

  const currency = clean(process.env.STRIPE_SAAS_PRICE_CURRENCY).toLowerCase() || "usd"
  if (!/^[a-z]{3}$/.test(currency)) {
    throw new Error(`Invalid STRIPE_SAAS_PRICE_CURRENCY: ${currency}`)
  }

  const summary = []
  const envOutput = {}

  for (const plan of PLAN_SPECS) {
    const slugUpper = plan.slug.toUpperCase()
    const configuredMonthlyAmount = Number.parseInt(clean(process.env[`STRIPE_SAAS_${slugUpper}_UNIT_AMOUNT_CENTS`]), 10)
    const monthlyUnitAmountCents = Number.isFinite(configuredMonthlyAmount) && configuredMonthlyAmount > 0
      ? configuredMonthlyAmount
      : plan.defaultMonthlyUnitAmountCents

    const defaultAnnualUnitAmountCents = resolveDefaultAnnualUnitAmountCents(
      monthlyUnitAmountCents,
      plan.annualDiscountPercent,
    )

    const configuredAnnualAmount = Number.parseInt(clean(process.env[`STRIPE_SAAS_${slugUpper}_ANNUAL_UNIT_AMOUNT_CENTS`]), 10)
    const annualUnitAmountCents = Number.isFinite(configuredAnnualAmount) && configuredAnnualAmount > 0
      ? configuredAnnualAmount
      : defaultAnnualUnitAmountCents

    const { product } = await ensurePlanProduct(apiKey, {
      dryRun: options.dryRun,
      currency,
      plan,
    })

    const { created: createdMonthlyPrice, price: monthlyPrice } = await ensurePlanPrice(apiKey, {
      dryRun: options.dryRun,
      currency,
      plan,
      productId: product.id,
      unitAmountCents: monthlyUnitAmountCents,
      billingPeriod: "monthly",
      interval: "month",
    })

    const { created: createdAnnualPrice, price: annualPrice } = await ensurePlanPrice(apiKey, {
      dryRun: options.dryRun,
      currency,
      plan,
      productId: product.id,
      unitAmountCents: annualUnitAmountCents,
      billingPeriod: "annual",
      interval: "year",
    })

    summary.push({
      plan: plan.slug,
      billingPeriod: "monthly",
      envKey: plan.monthlyEnvKey,
      priceId: monthlyPrice.id,
      createdPrice: createdMonthlyPrice,
      unitAmountCents: monthlyUnitAmountCents,
      interval: "month",
    })

    summary.push({
      plan: plan.slug,
      billingPeriod: "annual",
      envKey: plan.annualEnvKey,
      priceId: annualPrice.id,
      createdPrice: createdAnnualPrice,
      unitAmountCents: annualUnitAmountCents,
      interval: "year",
    })

    Object.assign(
      envOutput,
      buildPlanEnvOutput(plan, {
        productId: product.id,
        monthlyPriceId: monthlyPrice.id,
        annualPriceId: annualPrice.id,
      }),
    )
  }

  for (const row of summary) {
    const status = row.createdPrice ? "created" : "existing"
    console.log(`[${status}] ${row.plan}/${row.billingPeriod}: ${row.envKey}=${row.priceId} (${row.unitAmountCents} cents/${row.interval})`)
  }

  console.log("\nEnvironment variables to set:")
  for (const [key, value] of Object.entries(envOutput)) {
    console.log(`${key}=${value}`)
  }

  if (options.writeEnvFiles.length > 0) {
    for (const filePath of options.writeEnvFiles) {
      if (options.dryRun) {
        console.log(`[dry-run] would write ${Object.keys(envOutput).length} keys into ${filePath}`)
        continue
      }

      upsertEnvFile(filePath, envOutput)
      console.log(`Wrote ${Object.keys(envOutput).length} keys into ${filePath}`)
    }
  }

  console.log("\nProduction secret sync helper (optional):")
  for (const [key, value] of Object.entries(envOutput)) {
    console.log(`SYNC_SECRET_${key}=${value}`)
  }
}

if (isEntrypoint()) {
  main().catch((error) => {
    console.error("Failed to ensure Stripe SaaS plans", error)
    process.exit(1)
  })
}

export { buildPlanEnvOutput, loadStripeSaasPlanEnvFiles }
