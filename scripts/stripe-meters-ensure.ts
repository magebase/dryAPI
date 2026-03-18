#!/usr/bin/env node
// @ts-nocheck

import { existsSync, readFileSync } from "node:fs"

const STRIPE_API_BASE = "https://api.stripe.com"

const EVENT_SPECS = [
  { env: "STRIPE_METER_EVENT_AI_MODEL_CALL", fallback: "genfix_ai_model_call", amountEnv: "STRIPE_METER_PRICE_AI_MODEL_CALL_UNIT_AMOUNT", defaultUnitAmount: "1" },
  { env: "STRIPE_METER_EVENT_MODERATION_MODEL_CALL", fallback: "genfix_moderation_model_call", amountEnv: "STRIPE_METER_PRICE_MODERATION_MODEL_CALL_UNIT_AMOUNT", defaultUnitAmount: "1" },
  { env: "STRIPE_METER_EVENT_BREVO_SMS_SEND", fallback: "genfix_brevo_sms_send", amountEnv: "STRIPE_METER_PRICE_BREVO_SMS_SEND_UNIT_AMOUNT", defaultUnitAmount: "1" },
  { env: "STRIPE_METER_EVENT_CAL_REQUEST", fallback: "genfix_cal_request", amountEnv: "STRIPE_METER_PRICE_CAL_REQUEST_UNIT_AMOUNT", defaultUnitAmount: "1" },
  { env: "STRIPE_METER_EVENT_CLOUDFLARE_WORKER_REQUEST", fallback: "genfix_cloudflare_worker_request", amountEnv: "STRIPE_METER_PRICE_CLOUDFLARE_WORKER_REQUEST_UNIT_AMOUNT", defaultUnitAmount: "1" },
  { env: "STRIPE_METER_EVENT_WORKFLOW_DISPATCH", fallback: "genfix_workflow_dispatch", amountEnv: "STRIPE_METER_PRICE_WORKFLOW_DISPATCH_UNIT_AMOUNT", defaultUnitAmount: "1" },
  { env: "STRIPE_METER_EVENT_WORKFLOW_RUN", fallback: "genfix_workflow_run", amountEnv: "STRIPE_METER_PRICE_WORKFLOW_RUN_UNIT_AMOUNT", defaultUnitAmount: "1" },
]

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
    const pagePath = new URL(`${STRIPE_API_BASE}${path}`)
    pagePath.searchParams.set("limit", "100")
    if (startingAfter) {
      pagePath.searchParams.set("starting_after", startingAfter)
    }

    const relative = pagePath.pathname + pagePath.search
    const payload = await stripeRequest(apiKey, relative)
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

function buildEventSpecs() {
  return EVENT_SPECS.map((spec) => {
    const eventName = clean(process.env[spec.env]) || spec.fallback
    const unitAmountDecimal = clean(process.env[spec.amountEnv]) || spec.defaultUnitAmount
    return {
      ...spec,
      eventName,
      unitAmountDecimal,
    }
  })
}

async function ensureProduct(apiKey, { dryRun, projectKey, currency }) {
  const products = await listAll(apiKey, "/v1/products?active=true")
  const existing = products.find((item) => {
    const metadata = item?.metadata || {}
    return metadata.project_key === projectKey && metadata.kind === "metered_usage"
  })

  if (existing) {
    return { product: existing, created: false }
  }

  const payload = {
    name: `GenFix Metered Usage (${currency.toUpperCase()})`,
    active: true,
    metadata: {
      project_key: projectKey,
      kind: "metered_usage",
      managed_by: "stripe-meters-ensure-script",
    },
  }

  if (dryRun) {
    return { product: { id: "prod_dry_run", ...payload }, created: true }
  }

  const created = await stripeRequest(apiKey, "/v1/products", {
    method: "POST",
    body: payload,
  })

  return { product: created, created: true }
}

async function ensureMeter(apiKey, { dryRun, eventName, displayName }) {
  const meters = await listAll(apiKey, "/v1/billing/meters")
  const existing = meters.find((item) => item?.event_name === eventName)

  if (existing) {
    return { meter: existing, created: false }
  }

  const payload = {
    event_name: eventName,
    display_name: displayName,
    default_aggregation: {
      formula: "sum",
    },
    value_settings: {
      event_payload_key: "value",
    },
    customer_mapping: {
      type: "by_id",
      event_payload_key: "stripe_customer_id",
    },
  }

  if (dryRun) {
    return { meter: { id: `mtr_dry_${eventName}`, ...payload }, created: true }
  }

  const created = await stripeRequest(apiKey, "/v1/billing/meters", {
    method: "POST",
    body: payload,
  })

  return { meter: created, created: true }
}

async function ensurePrice(apiKey, {
  dryRun,
  projectKey,
  productId,
  meterId,
  eventName,
  currency,
  unitAmountDecimal,
}) {
  if (dryRun) {
    return {
      price: {
        id: `price_dry_${eventName}`,
        product: productId,
        currency,
        unit_amount_decimal: unitAmountDecimal,
        recurring: {
          interval: "month",
          usage_type: "metered",
          meter: meterId,
        },
      },
      created: true,
    }
  }

  const prices = await listAll(apiKey, `/v1/prices?active=true&product=${encodeURIComponent(productId)}`)
  const existing = prices.find((item) => item?.recurring?.meter === meterId)

  if (existing) {
    return { price: existing, created: false }
  }

  const payload = {
    product: productId,
    currency,
    billing_scheme: "per_unit",
    unit_amount_decimal: unitAmountDecimal,
    recurring: {
      interval: "month",
      usage_type: "metered",
      meter: meterId,
    },
    nickname: `Usage ${eventName}`,
    metadata: {
      project_key: projectKey,
      meter_event_name: eventName,
      managed_by: "stripe-meters-ensure-script",
    },
  }

  const created = await stripeRequest(apiKey, "/v1/prices", {
    method: "POST",
    body: payload,
  })

  return { price: created, created: true }
}

function toDisplayName(eventName) {
  return eventName
    .replace(/^genfix_/, "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

async function main() {
  loadEnvFile(".env")
  loadEnvFile(".env.local")

  const dryRun = process.argv.includes("--dry-run")
  const apiKey = clean(process.env.STRIPE_PRIVATE_KEY)

  if (!apiKey) {
    throw new Error("STRIPE_PRIVATE_KEY is required.")
  }

  const projectKey = clean(process.env.STRIPE_METER_PROJECT_KEY) || "genfix"
  const currency = (clean(process.env.STRIPE_METER_PRICE_CURRENCY) || "aud").toLowerCase()
  const specs = buildEventSpecs()

  const { product, created: productCreated } = await ensureProduct(apiKey, {
    dryRun,
    projectKey,
    currency,
  })

  const summary = {
    product: {
      id: product.id,
      created: productCreated,
      currency,
    },
    meters: [],
  }

  for (const spec of specs) {
    const { meter, created: meterCreated } = await ensureMeter(apiKey, {
      dryRun,
      eventName: spec.eventName,
      displayName: toDisplayName(spec.eventName),
    })

    const { price, created: priceCreated } = await ensurePrice(apiKey, {
      dryRun,
      projectKey,
      productId: product.id,
      meterId: meter.id,
      eventName: spec.eventName,
      currency,
      unitAmountDecimal: spec.unitAmountDecimal,
    })

    summary.meters.push({
      eventName: spec.eventName,
      meterId: meter.id,
      meterCreated,
      priceId: price.id,
      priceCreated,
      unitAmountDecimal: spec.unitAmountDecimal,
    })
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
