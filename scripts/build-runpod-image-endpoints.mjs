import { promises as fs } from "node:fs"
import path from "node:path"

import { selectGpuCandidates } from "./lib/runpod-gpu-revenue.mjs"

const workspaceRoot = process.cwd()
const defaultCatalogPath = path.join(workspaceRoot, "cloudflare", "clients", "runpod", "image-model-catalog.json")
const defaultManifestPath = path.join(workspaceRoot, "cloudflare", "clients", "runpod", "runpod-image-endpoints.manifest.json")
const defaultEnvExamplePath = path.join(workspaceRoot, "cloudflare", "clients", "runpod", "runpod-image-endpoints.env.example")
const defaultRequestsPath = path.join(workspaceRoot, "cloudflare", "clients", "runpod", "runpod-image-endpoints.create-requests.json")

const DEFAULT_QUEUE_DELAY_SECONDS = 10
const DEFAULT_IDLE_TIMEOUT_SECONDS = 60
const DEFAULT_WORKERS_MIN = 0
const DEFAULT_WORKERS_MAX = 3
const DEFAULT_FLASHBOOT = true
const MIN_GPU_FALLBACK_COUNT = 3

function pickNonNegativeNumber(value, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback
  }

  return value
}

function parseArgs(argv) {
  const args = {
    catalog: defaultCatalogPath,
    out: defaultManifestPath,
    envExampleOut: defaultEnvExamplePath,
    requestsOut: defaultRequestsPath,
    stdout: false,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === "--catalog" && argv[index + 1]) {
      args.catalog = path.resolve(workspaceRoot, argv[index + 1])
      index += 1
      continue
    }

    if (token === "--out" && argv[index + 1]) {
      args.out = path.resolve(workspaceRoot, argv[index + 1])
      index += 1
      continue
    }

    if (token === "--env-example-out" && argv[index + 1]) {
      args.envExampleOut = path.resolve(workspaceRoot, argv[index + 1])
      index += 1
      continue
    }

    if (token === "--requests-out" && argv[index + 1]) {
      args.requestsOut = path.resolve(workspaceRoot, argv[index + 1])
      index += 1
      continue
    }

    if (token === "--stdout") {
      args.stdout = true
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
    "Build RunPod image endpoint manifest from pinned model catalog.",
    "",
    "Usage:",
    "  node scripts/build-runpod-image-endpoints.mjs [options]",
    "",
    "Options:",
    "  --catalog <path>          Catalog JSON path",
    "  --out <path>              Output manifest JSON path",
    "  --env-example-out <path>  Output env example path",
    "  --requests-out <path>     Output endpoint-create requests JSON path",
    "  --stdout                  Print generated manifest to stdout",
    "  -h, --help                Show this help",
  ].join("\n")

  console.log(message)
  process.exit(exitCode)
}

function readJsonFile(filePath) {
  return fs.readFile(filePath, "utf8").then((content) => JSON.parse(content))
}

function toEndpointId(sourceSlug) {
  return sourceSlug
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
}

function normalizeWorkerClass(workerClass) {
  return workerClass.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()
}

function getTemplateEnvVar(workerClass) {
  return `RUNPOD_TEMPLATE_ID_${normalizeWorkerClass(workerClass)}`
}

function getMinCudaVersion(runpodConfig) {
  const configured = String(runpodConfig.minCudaVersion || "").trim()
  if (configured) {
    return configured
  }

  return "12.2"
}

function inferGpuTypes(runpodConfig) {
  const configured = Array.isArray(runpodConfig.recommendedGpus)
    ? runpodConfig.recommendedGpus.map((gpuType) => String(gpuType).trim()).filter(Boolean)
    : []

  if (configured.length >= MIN_GPU_FALLBACK_COUNT) {
    return configured
  }

  const selected = selectGpuCandidates({
    workerClass: runpodConfig.workerClass,
    minCudaVersion: getMinCudaVersion(runpodConfig),
    minimumCount: MIN_GPU_FALLBACK_COUNT,
  })

  return selected.map((gpu) => gpu.gpuType)
}

function validateCatalog(catalog) {
  if (!catalog || typeof catalog !== "object") {
    throw new Error("Catalog must be a JSON object")
  }

  if (!Array.isArray(catalog.models) || catalog.models.length === 0) {
    throw new Error("Catalog must contain a non-empty models array")
  }

  for (const model of catalog.models) {
    const requiredTopLevel = ["slug", "displayName", "tasks", "openSource", "runpod"]
    for (const field of requiredTopLevel) {
      if (!(field in model)) {
        throw new Error(`Model ${JSON.stringify(model)} is missing required field: ${field}`)
      }
    }

    const requiredOpenSource = ["kind", "repo", "revision", "artifact", "imageTag"]
    for (const field of requiredOpenSource) {
      if (!(field in model.openSource)) {
        throw new Error(`Model ${model.slug} missing openSource.${field}`)
      }
    }

    const requiredRunpod = ["workerClass", "executionTimeoutMs"]
    for (const field of requiredRunpod) {
      if (!(field in model.runpod)) {
        throw new Error(`Model ${model.slug} missing runpod.${field}`)
      }
    }
  }
}

function buildManifest(catalog) {
  const endpoints = catalog.models.map((model) => {
    const endpointId = toEndpointId(model.slug)
    const gpuTypes = inferGpuTypes(model.runpod)
    const minCudaVersion = getMinCudaVersion(model.runpod)
    const queueDelaySeconds = pickNonNegativeNumber(model.runpod.queueDelaySeconds, DEFAULT_QUEUE_DELAY_SECONDS)
    const workersMin = pickNonNegativeNumber(model.runpod.workersMin, DEFAULT_WORKERS_MIN)
    const workersMax = pickNonNegativeNumber(model.runpod.workersMax, DEFAULT_WORKERS_MAX)
    const batchWindowSeconds = pickNonNegativeNumber(model.runpod.batchWindowSeconds, queueDelaySeconds)
    const maxBatchSize = pickNonNegativeNumber(model.runpod.maxBatchSize, 1)
    const huggingFaceModel = model.openSource.kind === "huggingface"
      ? model.openSource.repo
      : ""

    return {
      endpointId,
      endpointName: endpointId,
      sourceModel: {
        slug: model.slug,
        displayName: model.displayName,
        tasks: model.tasks,
      },
      openSource: {
        kind: model.openSource.kind,
        repo: model.openSource.repo,
        revision: model.openSource.revision,
        artifact: model.openSource.artifact,
        imageTag: model.openSource.imageTag,
        confidence: model.openSource.confidence,
        notes: model.openSource.notes || [],
      },
      runpod: {
        workerClass: model.runpod.workerClass,
        gpuType: gpuTypes[0],
        gpuTypes,
        minCudaVersion,
        queueDelaySeconds,
        flashboot: DEFAULT_FLASHBOOT,
        executionTimeoutMs: model.runpod.executionTimeoutMs,
        idleTimeoutSeconds: DEFAULT_IDLE_TIMEOUT_SECONDS,
        workersMin,
        workersMax,
        batchWindowSeconds,
        maxBatchSize,
        templateIdEnv: getTemplateEnvVar(model.runpod.workerClass),
      },
      endpointEnvironment: {
        MODEL_SLUG: model.slug,
        MODEL_DISPLAY_NAME: model.displayName,
        MODEL_TASKS: model.tasks.join(","),
        MODEL_HUGGINGFACE_MODEL: huggingFaceModel,
        HUGGINGFACE_MODEL: huggingFaceModel,
        MODEL_OPEN_SOURCE_KIND: model.openSource.kind,
        MODEL_OPEN_SOURCE_REPO: model.openSource.repo,
        MODEL_OPEN_SOURCE_REVISION: model.openSource.revision,
        MODEL_OPEN_SOURCE_ARTIFACT: model.openSource.artifact,
        MODEL_OPEN_SOURCE_IMAGE_TAG: model.openSource.imageTag,
        MODEL_MIN_CUDA_VERSION: minCudaVersion,
        MODEL_GPU_CANDIDATES: gpuTypes.join(","),
        MODEL_QUEUE_DELAY_SECONDS: String(queueDelaySeconds),
        MODEL_BATCH_WINDOW_SECONDS: String(batchWindowSeconds),
        MODEL_MAX_BATCH_SIZE: String(maxBatchSize),
        MODEL_FLASHBOOT: DEFAULT_FLASHBOOT ? "1" : "0",
        MODEL_WORKER_CLASS: model.runpod.workerClass,
      },
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    sourceCatalogGeneratedAt: catalog.generatedAt || null,
    modelCount: endpoints.length,
    endpoints,
  }
}

function buildEnvExample(manifest) {
  const templateEnvVars = [...new Set(manifest.endpoints.map((endpoint) => endpoint.runpod.templateIdEnv))]

  const lines = [
    "# RunPod API settings",
    "RUNPOD_API_KEY=",
    "RUNPOD_GRAPHQL_URL=https://api.runpod.io/graphql",
    "",
    "# Endpoint template IDs by worker class",
    ...templateEnvVars.map((envVar) => `${envVar}=`),
    "",
    "# Optional network volume id if your template needs one",
    "RUNPOD_NETWORK_VOLUME_ID=",
    "",
    "# Optional defaults",
    "RUNPOD_DEFAULT_IDLE_TIMEOUT_SECONDS=60",
  ]

  return `${lines.join("\n")}\n`
}

function buildCreateRequests(manifest) {
  const requests = manifest.endpoints.map((endpoint) => {
    const envEntries = Object.entries(endpoint.endpointEnvironment).map(([key, value]) => ({
      key,
      value,
    }))

    return {
      kind: "runpod.serverless.endpoint.create",
      endpointId: endpoint.endpointId,
      endpointName: endpoint.endpointName,
      templateIdEnv: endpoint.runpod.templateIdEnv,
      payloadTemplate: {
        name: endpoint.endpointName,
        templateId: `\${${endpoint.runpod.templateIdEnv}}`,
        gpuType: endpoint.runpod.gpuType,
        gpuTypes: endpoint.runpod.gpuTypes,
        minCudaVersion: endpoint.runpod.minCudaVersion,
        workersMin: endpoint.runpod.workersMin,
        workersMax: endpoint.runpod.workersMax,
        queueDelaySeconds: endpoint.runpod.queueDelaySeconds,
        flashboot: endpoint.runpod.flashboot,
        idleTimeoutSeconds: endpoint.runpod.idleTimeoutSeconds,
        executionTimeoutMs: endpoint.runpod.executionTimeoutMs,
        env: envEntries,
      },
      sourceModel: endpoint.sourceModel,
      openSourceImageTag: endpoint.openSource.imageTag,
      confidence: endpoint.openSource.confidence,
      notes: endpoint.openSource.notes || [],
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    requestCount: requests.length,
    requests,
  }
}

async function ensureDirForFile(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
}

async function main() {
  const args = parseArgs(process.argv)
  const catalog = await readJsonFile(args.catalog)
  validateCatalog(catalog)

  const manifest = buildManifest(catalog)
  const envExample = buildEnvExample(manifest)
  const createRequests = buildCreateRequests(manifest)

  await ensureDirForFile(args.out)
  await fs.writeFile(args.out, JSON.stringify(manifest, null, 2) + "\n", "utf8")

  await ensureDirForFile(args.envExampleOut)
  await fs.writeFile(args.envExampleOut, envExample, "utf8")

  await ensureDirForFile(args.requestsOut)
  await fs.writeFile(args.requestsOut, JSON.stringify(createRequests, null, 2) + "\n", "utf8")

  if (args.stdout) {
    console.log(JSON.stringify(manifest, null, 2))
  }

  console.log(`Generated manifest: ${args.out}`)
  console.log(`Generated env example: ${args.envExampleOut}`)
  console.log(`Generated create requests: ${args.requestsOut}`)
  console.log(`Endpoints: ${manifest.modelCount}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
