#!/usr/bin/env node
// @ts-nocheck

import { existsSync, readFileSync } from "node:fs"

const STRIPE_API_BASE = "https://api.stripe.com"
const DEFAULT_SITE_URL = "https://genfix.com.au"

const PLAN_SPECS = [
  {
    key: "basic",
    label: "Basic",
    productEnv: "STRIPE_PORTAL_BASIC_PRODUCT_ID",
    monthlyPriceEnv: "STRIPE_PORTAL_BASIC_MONTHLY_PRICE_ID",
    annualPriceEnv: "STRIPE_PORTAL_BASIC_ANNUAL_PRICE_ID",
  },
  {
    key: "growth",
    label: "Growth",
    productEnv: "STRIPE_PORTAL_GROWTH_PRODUCT_ID",
    monthlyPriceEnv: "STRIPE_PORTAL_GROWTH_MONTHLY_PRICE_ID",
    annualPriceEnv: "STRIPE_PORTAL_GROWTH_ANNUAL_PRICE_ID",
  },
  {
    key: "pro",
    label: "Pro",
    productEnv: "STRIPE_PORTAL_PRO_PRODUCT_ID",
    monthlyPriceEnv: "STRIPE_PORTAL_PRO_MONTHLY_PRICE_ID",
    annualPriceEnv: "STRIPE_PORTAL_PRO_ANNUAL_PRICE_ID",
  },
]

const TIER_ALIASES = {
  basic: ["basic", "starter", "standard"],
  growth: ["growth", "plus", "scale"],
  pro: ["pro", "professional", "premium"],
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

    const value = line.slice(separatorIndex + 1)
    process.env[key] = value
  }
}

function clean(value) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeSiteUrl() {
  return (clean(process.env.NEXT_PUBLIC_SITE_URL) || clean(process.env.SITE_URL) || DEFAULT_SITE_URL).replace(/\/+$/, "")
}

function appendStripeParam(params, key, value) {
  if (value === undefined || value === null) {
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      appendStripeParam(params, `${key}[${index}]`, item)
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
    const url = new URL(`${STRIPE_API_BASE}${path}`)
    if (!url.searchParams.has("limit")) {
      url.searchParams.set("limit", "100")
    }

    if (startingAfter) {
      url.searchParams.set("starting_after", startingAfter)
    }

    const payload = await stripeRequest(apiKey, url.pathname + url.search)
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

function detectTier(valueParts) {
  const normalized = valueParts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  for (const [tier, aliases] of Object.entries(TIER_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(alias))) {
      return tier
    }
  }

  return null
}

function chooseBestTierCandidate(candidatesByProductId) {
  let best = null

  for (const candidate of candidatesByProductId.values()) {
    const intervalScore = (candidate.monthly ? 1 : 0) + (candidate.annual ? 1 : 0)
    const score = intervalScore * 100 + candidate.count

    if (!best || score > best.score) {
      best = {
        ...candidate,
        score,
      }
    }
  }

  return best
}

async function autoDiscoverTierProducts(apiKey) {
  const prices = await listAll(apiKey, "/v1/prices?active=true&type=recurring&expand[]=data.product")
  const tierCandidates = new Map()

  for (const price of prices) {
    const recurring = price?.recurring
    const interval = recurring?.interval
    if (!recurring || (interval !== "month" && interval !== "year")) {
      continue
    }

    const product = price?.product
    if (!product || typeof product !== "object") {
      continue
    }

    const productId = clean(product.id)
    if (!productId || product.active === false) {
      continue
    }

    const tier = detectTier([
      product?.metadata?.plan_tier,
      price?.lookup_key,
      price?.nickname,
      product?.name,
      product?.description,
    ])

    if (!tier) {
      continue
    }

    if (!tierCandidates.has(tier)) {
      tierCandidates.set(tier, new Map())
    }

    const productMap = tierCandidates.get(tier)
    if (!productMap.has(productId)) {
      productMap.set(productId, {
        productId,
        monthly: "",
        annual: "",
        count: 0,
      })
    }

    const bucket = productMap.get(productId)
    bucket.count += 1

    if (interval === "month" && !bucket.monthly) {
      bucket.monthly = clean(price.id)
    }

    if (interval === "year" && !bucket.annual) {
      bucket.annual = clean(price.id)
    }
  }

  const discovered = []

  for (const plan of PLAN_SPECS) {
    const productMap = tierCandidates.get(plan.key)
    if (!productMap) {
      continue
    }

    const best = chooseBestTierCandidate(productMap)
    if (!best) {
      continue
    }

    const pricesForPlan = [best.monthly, best.annual].filter(Boolean)
    if (pricesForPlan.length === 0) {
      continue
    }

    discovered.push({
      product: best.productId,
      prices: pricesForPlan,
    })
  }

  return discovered
}

function buildTierProducts({ allowEmpty = false } = {}) {
  const products = []

  for (const plan of PLAN_SPECS) {
    const productId = clean(process.env[plan.productEnv])
    const prices = [clean(process.env[plan.monthlyPriceEnv]), clean(process.env[plan.annualPriceEnv])].filter(Boolean)

    if (!productId && prices.length === 0) {
      continue
    }

    if (!productId && prices.length > 0) {
      throw new Error(`${plan.productEnv} is required when ${plan.label} prices are set.`)
    }

    if (productId && prices.length === 0) {
      throw new Error(
        `At least one price is required for ${plan.label}. Set ${plan.monthlyPriceEnv} and/or ${plan.annualPriceEnv}.`
      )
    }

    products.push({
      product: productId,
      prices,
    })
  }

  if (products.length === 0) {
    if (allowEmpty) {
      return []
    }

    throw new Error(
      "No tier products configured. Set at least one of STRIPE_PORTAL_BASIC_*, STRIPE_PORTAL_GROWTH_*, or STRIPE_PORTAL_PRO_* env values."
    )
  }

  return products
}

function buildPortalPayload(products) {
  const siteUrl = normalizeSiteUrl()

  return {
    name: clean(process.env.STRIPE_PORTAL_CONFIGURATION_NAME) || "GenFix Consultancy Plans",
    default_return_url: clean(process.env.STRIPE_PORTAL_RETURN_URL) || `${siteUrl}/contact`,
    business_profile: {
      headline:
        clean(process.env.STRIPE_PORTAL_BUSINESS_HEADLINE) ||
        "Manage your consultancy plan, billing details, and invoices.",
      privacy_policy_url: clean(process.env.STRIPE_PORTAL_PRIVACY_POLICY_URL) || `${siteUrl}/privacy-policy`,
      terms_of_service_url: clean(process.env.STRIPE_PORTAL_TERMS_URL) || `${siteUrl}/terms`,
    },
    features: {
      customer_update: {
        enabled: true,
        allowed_updates: ["email", "address", "tax_id"],
      },
      invoice_history: {
        enabled: true,
      },
      payment_method_update: {
        enabled: true,
      },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        cancellation_reason: {
          enabled: true,
          options: ["too_expensive", "missing_features", "switched_service", "unused", "other"],
        },
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price", "promotion_code"],
        proration_behavior: "create_prorations",
        products,
      },
    },
    login_page: {
      enabled: true,
    },
    metadata: {
      project_key: clean(process.env.STRIPE_METER_PROJECT_KEY) || "genfix",
      plan_model: "consultancy_tiered",
      managed_by: "stripe-portal-ensure-script",
    },
  }
}

async function resolveExistingPortalConfigurationId(apiKey) {
  const explicitId = clean(process.env.STRIPE_PORTAL_CONFIGURATION_ID)
  if (explicitId) {
    return { id: explicitId, source: "env" }
  }

  const projectKey = clean(process.env.STRIPE_METER_PROJECT_KEY) || "genfix"
  const listResponse = await stripeRequest(apiKey, "/v1/billing_portal/configurations?active=true&limit=100")
  const configs = Array.isArray(listResponse.data) ? listResponse.data : []

  const existing = configs.find((item) => {
    const metadata = item?.metadata || {}
    return metadata.project_key === projectKey && metadata.plan_model === "consultancy_tiered"
  })

  if (!existing?.id) {
    return null
  }

  return { id: existing.id, source: "lookup" }
}

async function main() {
  loadEnvFile(".env")
  loadEnvFile(".env.local")

  const dryRun = process.argv.includes("--dry-run")
  const apiKey = clean(process.env.STRIPE_PRIVATE_KEY)

  let products = buildTierProducts({ allowEmpty: true })
  if (products.length === 0) {
    if (!apiKey) {
      throw new Error(
        "No tier products configured. Set STRIPE_PORTAL_* IDs or configure STRIPE_PRIVATE_KEY so auto-discovery can run."
      )
    }

    products = await autoDiscoverTierProducts(apiKey)
    if (products.length === 0) {
      throw new Error(
        "No tier products configured and auto-discovery found none. Set STRIPE_PORTAL_* IDs in .env or make sure Stripe prices/products include plan names like Basic/Growth/Pro (or metadata plan_tier)."
      )
    }

    console.log(`Auto-discovered ${products.length} tier product group(s) from Stripe.`)
  }

  const payload = buildPortalPayload(products)

  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2))
    return
  }

  if (!apiKey) {
    throw new Error("STRIPE_PRIVATE_KEY is required.")
  }

  const existing = await resolveExistingPortalConfigurationId(apiKey)
  let result

  if (existing) {
    result = await stripeRequest(apiKey, `/v1/billing_portal/configurations/${existing.id}`, {
      method: "POST",
      body: payload,
    })
    console.log(`Updated Stripe Billing Portal configuration: ${result.id} (source: ${existing.source})`)
  } else {
    result = await stripeRequest(apiKey, "/v1/billing_portal/configurations", {
      method: "POST",
      body: payload,
    })
    console.log(`Created Stripe Billing Portal configuration: ${result.id}`)
  }

  console.log(`Set STRIPE_PORTAL_CONFIGURATION_ID=${result.id}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
