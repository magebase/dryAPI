#!/usr/bin/env node

import { promises as fs } from "node:fs"
import path from "node:path"

const rootDir = process.cwd()
const appDir = path.join(rootDir, "src", "app")

const metadataHookPattern = /generateMetadata\(|export const metadata\s*:/
const takumiMetadataPattern = /buildTakumiMetadata\(|generateDocsMetadata\(/

type Violation = {
  file: string
  reason: string
}

async function readText(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8")
}

async function listFilesRecursive(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)))
      continue
    }

    if (entry.isFile()) {
      files.push(fullPath)
    }
  }

  return files
}

async function verifyMetadataCoverage(): Promise<Violation[]> {
  const files = await listFilesRecursive(appDir)
  const pageOrLayoutFiles = files.filter((filePath) => filePath.endsWith(".tsx"))
  const violations: Violation[] = []

  for (const filePath of pageOrLayoutFiles) {
    const relative = path.relative(rootDir, filePath)
    const text = await readText(filePath)

    if (!metadataHookPattern.test(text)) {
      continue
    }

    if (!takumiMetadataPattern.test(text)) {
      violations.push({
        file: relative,
        reason: "metadata is defined but does not use Takumi metadata helpers",
      })
    }
  }

  return violations
}

async function verifyCoreOgFiles(): Promise<Violation[]> {
  const violations: Violation[] = []

  const checks: Array<{ file: string; patterns: RegExp[]; reason: string }> = [
    {
      file: "src/app/api/og/route.tsx",
      patterns: [
        /@takumi-rs\/image-response\/wasm/,
        /renderTakumiOgTemplate/,
        /NEXT_INC_CACHE_R2_BUCKET/,
        /X-OG-Cache/,
      ],
      reason: "OG route is missing required Takumi/Worker caching pieces",
    },
    {
      file: "src/lib/og/templates.tsx",
      patterns: [
        /marketing/,
        /pricing/,
        /dashboard/,
        /blog/,
        /pickAccessibleTextPalette/,
        /repeating-linear-gradient/,
      ],
      reason: "Takumi templates are missing required template families, contrast logic, or grainy gradients",
    },
    {
      file: "src/lib/og/metadata.ts",
      patterns: [
        /export type OgTemplateKind = "marketing" \| "pricing" \| "dashboard" \| "blog"/,
        /buildTakumiMetadata/,
        /buildTakumiOgImageUrl/,
      ],
      reason: "OG metadata helper is missing required template support",
    },
  ]

  for (const check of checks) {
    const absolutePath = path.join(rootDir, check.file)
    const text = await readText(absolutePath)

    const hasAllPatterns = check.patterns.every((pattern) => pattern.test(text))
    if (!hasAllPatterns) {
      violations.push({
        file: check.file,
        reason: check.reason,
      })
    }
  }

  return violations
}

async function run() {
  const [metadataViolations, coreViolations] = await Promise.all([
    verifyMetadataCoverage(),
    verifyCoreOgFiles(),
  ])

  const violations = [...metadataViolations, ...coreViolations]

  if (violations.length > 0) {
    console.error("Takumi OG verification failed.")
    for (const violation of violations) {
      console.error(`- ${violation.file}: ${violation.reason}`)
    }
    process.exit(1)
  }

  console.log("Takumi OG verification passed.")
}

run().catch((error) => {
  console.error("Takumi OG verification failed with an unexpected error.")
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
