// @ts-nocheck
import { promises as fs } from "node:fs"
import path from "node:path"

import { selectGpuCandidates, summarizeRevenueOptimization } from "./lib/runpod-gpu-revenue"

const workspaceRoot = process.cwd()
const defaultCatalogPath = path.join(workspaceRoot, "cloudflare", "clients", "runpod", "image-model-catalog.json")

function parseArgs(argv) {
  const args = {
    catalog: defaultCatalogPath,
    write: false,
    minGpuTypes: 3,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === "--catalog" && argv[index + 1]) {
      args.catalog = path.resolve(workspaceRoot, argv[index + 1])
      index += 1
      continue
    }

    if (token === "--write") {
      args.write = true
      continue
    }

    if (token === "--min-gpu-types" && argv[index + 1]) {
      const parsed = Number.parseInt(argv[index + 1], 10)
      if (!Number.isFinite(parsed) || parsed < 3) {
        throw new Error("--min-gpu-types must be an integer >= 3")
      }
      args.minGpuTypes = parsed
      index += 1
      continue
    }

    if (token === "--help" || token === "-h") {
      printHelpAndExit(0)
    }

    throw new Error(`Unknown argument: ${token}`)
  }

  return args
}

function printHelpAndExit(exitCode) {
  const message = [
    "Optimize RunPod serverless GPU candidates for revenue efficiency.",
    "",
    "Usage:",
    "  tsx scripts/optimize-runpod-gpu-revenue.ts [options]",
    "",
    "Options:",
    "  --catalog <path>       Catalog JSON path",
    "  --min-gpu-types <n>    Minimum GPU fallback count (default: 3)",
    "  --write                Persist optimized GPU ordering into the catalog",
    "  -h, --help             Show this help",
  ].join("\n")

  console.log(message)
  process.exit(exitCode)
}

function readJsonFile(filePath) {
  return fs.readFile(filePath, "utf8").then((content) => JSON.parse(content))
}

function validateCatalog(catalog) {
  if (!catalog || typeof catalog !== "object") {
    throw new Error("Catalog must be a JSON object")
  }

  if (!Array.isArray(catalog.models) || catalog.models.length === 0) {
    throw new Error("Catalog must contain a non-empty models array")
  }

  for (const model of catalog.models) {
    if (!model.runpod || typeof model.runpod !== "object") {
      throw new Error(`Model ${model.slug} missing runpod config`)
    }

    if (typeof model.runpod.workerClass !== "string" || model.runpod.workerClass.trim().length === 0) {
      throw new Error(`Model ${model.slug} missing runpod.workerClass`)
    }
  }
}

function defaultMinCudaVersion(workerClass) {
  if (workerClass === "ltx-video") {
    return "12.2"
  }

  return "12.2"
}

function optimizeCatalog(catalog, minimumCount) {
  let updatedModels = 0

  for (const model of catalog.models) {
    const workerClass = model.runpod.workerClass
    const minCudaVersion = model.runpod.minCudaVersion || defaultMinCudaVersion(workerClass)

    const selected = selectGpuCandidates({
      workerClass,
      minCudaVersion,
      minimumCount,
    })

    const selectedTypes = selected.map((gpu) => gpu.gpuType)

    model.runpod.minCudaVersion = minCudaVersion
    model.runpod.recommendedGpus = selectedTypes
    model.runpod.recommendedGpu = selectedTypes[0]

    updatedModels += 1
  }

  return updatedModels
}

function printOptimizationSummary(catalog, minimumCount) {
  console.log(`Optimized ${catalog.models.length} models with minimum ${minimumCount} GPU types per endpoint.`)

  const workerClasses = [...new Set(catalog.models.map((model) => model.runpod.workerClass))]
  for (const workerClass of workerClasses) {
    const minCudaVersion = catalog.models
      .filter((model) => model.runpod.workerClass === workerClass)
      .map((model) => model.runpod.minCudaVersion)[0] || "12.2"

    const report = summarizeRevenueOptimization({
      workerClass,
      minCudaVersion,
      minimumCount,
    })

    const summary = report.selected
      .map((entry) => `${entry.gpuType} (eff=${entry.costEfficiency.toFixed(3)}, $${entry.pricePerHourUsd.toFixed(2)}/hr)`)
      .join(" > ")

    console.log(`- ${workerClass} (min CUDA ${minCudaVersion}): ${summary}`)
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const catalog = await readJsonFile(args.catalog)
  validateCatalog(catalog)

  optimizeCatalog(catalog, args.minGpuTypes)
  printOptimizationSummary(catalog, args.minGpuTypes)

  if (!args.write) {
    return
  }

  await fs.writeFile(args.catalog, JSON.stringify(catalog, null, 2) + "\n", "utf8")
  console.log(`Wrote optimized catalog: ${args.catalog}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
