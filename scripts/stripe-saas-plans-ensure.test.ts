import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  buildPlanEnvOutput,
  loadStripeSaasPlanEnvFiles,
} from "./stripe-saas-plans-ensure"

describe("buildPlanEnvOutput", () => {
  it("maps product and price ids to the SaaS and portal env keys", () => {
    const plan = {
      monthlyEnvKey: "STRIPE_SAAS_PRICE_STARTER",
      annualEnvKey: "STRIPE_SAAS_ANNUAL_PRICE_STARTER",
      portalProductEnvKey: "STRIPE_PORTAL_BASIC_PRODUCT_ID",
      portalMonthlyEnvKey: "STRIPE_PORTAL_BASIC_MONTHLY_PRICE_ID",
      portalAnnualEnvKey: "STRIPE_PORTAL_BASIC_ANNUAL_PRICE_ID",
    }

    expect(
      buildPlanEnvOutput(plan, {
        productId: "prod_basic",
        monthlyPriceId: "price_basic_monthly",
        annualPriceId: "price_basic_annual",
      }),
    ).toEqual({
      STRIPE_SAAS_PRICE_STARTER: "price_basic_monthly",
      STRIPE_SAAS_ANNUAL_PRICE_STARTER: "price_basic_annual",
      STRIPE_PORTAL_BASIC_PRODUCT_ID: "prod_basic",
      STRIPE_PORTAL_BASIC_MONTHLY_PRICE_ID: "price_basic_monthly",
      STRIPE_PORTAL_BASIC_ANNUAL_PRICE_ID: "price_basic_annual",
    })
  })
})

describe("loadStripeSaasPlanEnvFiles", () => {
  it("keeps .env.local values ahead of .env values", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "stripe-saas-plans-ensure-"))
    const previousCwd = process.cwd()
    const previousPriceId = process.env.STRIPE_SAAS_PRICE_STARTER

    delete process.env.STRIPE_SAAS_PRICE_STARTER

    writeFileSync(
      join(tempDir, ".env"),
      "STRIPE_SAAS_PRICE_STARTER=price_from_env\n",
    )
    writeFileSync(
      join(tempDir, ".env.local"),
      "STRIPE_SAAS_PRICE_STARTER=price_from_env_local\n",
    )

    process.chdir(tempDir)

    try {
      loadStripeSaasPlanEnvFiles()

      expect(process.env.STRIPE_SAAS_PRICE_STARTER).toBe(
        "price_from_env_local",
      )
    } finally {
      process.chdir(previousCwd)

      if (previousPriceId === undefined) {
        delete process.env.STRIPE_SAAS_PRICE_STARTER
      } else {
        process.env.STRIPE_SAAS_PRICE_STARTER = previousPriceId
      }
    }
  })
})
