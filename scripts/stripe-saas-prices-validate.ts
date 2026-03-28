#!/usr/bin/env node
// @ts-nocheck

import { listSaasPlans } from "../src/lib/stripe-saas-plans"
import { validateConfiguredStripeSaasPrices } from "../src/lib/stripe-saas-price-validation"

function clean(value) {
  return typeof value === "string" ? value.trim() : ""
}

async function main() {
  const stripePrivateKey = clean(process.env.STRIPE_PRIVATE_KEY)
  if (!stripePrivateKey) {
    throw new Error("Missing STRIPE_PRIVATE_KEY in environment")
  }

  const results = await validateConfiguredStripeSaasPrices({
    stripePrivateKey,
    env: process.env,
    plans: listSaasPlans(),
  })

  const failures = results.filter((result) => !result.ok)
  for (const result of failures) {
    console.error(`[fail] ${result.envKey}: ${result.message}`)
  }

  if (failures.length > 0) {
    throw new Error(`Failed to validate ${failures.length} Stripe SaaS price env vars.`)
  }

  console.log(`Validated ${results.length} Stripe SaaS price env vars.`)
}

if (process.argv[1]) {
  const entrypoint = new URL(`file://${process.argv[1]}`).href
  if (entrypoint === import.meta.url) {
    main().catch((error) => {
      console.error("Failed to validate Stripe SaaS prices", error)
      process.exit(1)
    })
  }
}