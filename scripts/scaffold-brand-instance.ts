#!/usr/bin/env node
// @ts-nocheck

import { promises as fs } from "node:fs"
import path from "node:path"

const CONTENT_ROOT = path.join(process.cwd(), "content")
const BRAND_CATALOG_PATH = path.join(CONTENT_ROOT, "site", "brands.json")
const BASE_SITE_CONFIG_PATH = path.join(CONTENT_ROOT, "site", "site-config.json")
const BASE_HOME_PATH = path.join(CONTENT_ROOT, "site", "home.json")

function parseArgs(argv) {
  const options = {
    brand: "",
    force: false,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--brand") {
      const value = String(argv[index + 1] || "").trim().toLowerCase()
      if (!value) {
        throw new Error("--brand requires a brand key")
      }
      options.brand = value
      index += 1
      continue
    }

    if (arg === "--force") {
      options.force = true
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!options.brand) {
    throw new Error("Missing --brand. Example: tsx scripts/scaffold-brand-instance.ts --brand embedapi")
  }

  return options
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8")
  return JSON.parse(raw)
}

async function writeJson(filePath, payload, force) {
  try {
    await fs.access(filePath)
    if (!force) {
      return false
    }
  } catch {
    // File does not exist.
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
  return true
}

function toDomainFromUrl(siteUrl) {
  try {
    return new URL(siteUrl).hostname.toLowerCase()
  } catch {
    return "example.dev"
  }
}

async function run() {
  const options = parseArgs(process.argv)
  const [catalog, baseSiteConfig, baseHome] = await Promise.all([
    readJson(BRAND_CATALOG_PATH),
    readJson(BASE_SITE_CONFIG_PATH),
    readJson(BASE_HOME_PATH),
  ])

  const brand = Array.isArray(catalog?.brands)
    ? catalog.brands.find((entry) => String(entry?.key || "").toLowerCase() === options.brand)
    : null

  if (!brand) {
    throw new Error(`Brand key \"${options.brand}\" was not found in content/site/brands.json`)
  }

  const domain = toDomainFromUrl(String(brand.siteUrl || ""))
  const brandRoot = path.join(CONTENT_ROOT, "brands", options.brand)
  const siteRoot = path.join(brandRoot, "site")

  const siteConfigOverride = {
    brand: {
      name: `${brand.displayName} Platform`,
      mark: brand.mark,
    },
    contact: {
      contactEmail: `support@${domain}`,
      quoteEmail: `sales@${domain}`,
    },
    announcement: `Unified AI API infrastructure for ${brand.persona || "developer teams"}.`,
  }

  const homeOverride = {
    seoTitle: `${brand.displayName} | Unified AI API Platform`,
    seoDescription: `${brand.displayName} gives teams one API for shared model access, billing controls, and production routing guardrails.`,
    hero: {
      kicker: `${brand.displayName} for production AI apps`,
      heading: `Ship faster with ${brand.displayName}`,
      subheading: `Use the same shared model catalog with brand-specific UX, pricing, and SEO positioning.`,
    },
  }

  const writes = await Promise.all([
    writeJson(path.join(siteRoot, "site-config.json"), siteConfigOverride, options.force),
    writeJson(path.join(siteRoot, "home.json"), homeOverride, options.force),
    fs.mkdir(path.join(brandRoot, "pages"), { recursive: true }).then(() => true),
    fs.mkdir(path.join(brandRoot, "blog"), { recursive: true }).then(() => true),
  ])

  console.log(
    JSON.stringify(
      {
        ok: true,
        brand: options.brand,
        brandRoot,
        wroteSiteConfig: writes[0],
        wroteHome: writes[1],
        sharedModels: catalog?.sharedModels || null,
        databaseNames: brand.databaseNames || null,
        nextSteps: [
          `SITE_BRAND_KEY=${options.brand} pnpm dev:next`,
          `tsx scripts/generate-model-keyword-pages.ts --brand ${options.brand} --dry-run --max-new-posts 3`,
        ],
        referenceDefaults: {
          baseSiteConfig: baseSiteConfig?.brand?.mark || null,
          baseHomeTitle: baseHome?.seoTitle || null,
        },
      },
      null,
      2,
    ),
  )
}

run().catch((error) => {
  console.error("Failed to scaffold brand instance", error)
  process.exit(1)
})
