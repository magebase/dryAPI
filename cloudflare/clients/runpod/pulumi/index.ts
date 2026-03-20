import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import * as pulumi from "@pulumi/pulumi"
import * as runpod from "@runpod-infra/pulumi"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function resolveManifestPath(config) {
  const configuredPath = config.get("manifestPath")
  const manifestPath = configuredPath || "../runpod-image-endpoints.manifest.json"
  return path.resolve(__dirname, manifestPath)
}

function resolveTemplateId(templateIdEnv) {
  const value = process.env[templateIdEnv]
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${templateIdEnv}`)
  }

  return value.trim()
}

function sanitizeGpuIds(gpuTypes) {
  if (!Array.isArray(gpuTypes) || gpuTypes.length === 0) {
    return ""
  }

  return gpuTypes
    .map((gpu) => String(gpu || "").trim())
    .filter(Boolean)
    .join(",")
}

function parsePositiveInt(value) {
  if (value === undefined || value === null || value === "") {
    return null
  }

  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null
  }

  return parsed
}

const ENDPOINT_PROFILES = {
  all: null,
  // Exactly 10 endpoints, including all user-requested serverless models.
  serverless10: [
    "acestep-1-5-turbo",
    "bge-m3-int8",
    "ben2",
    "flux-2-klein-4b-bf16",
    "ltx2-3-22b-dist-int8",
    "nanonets-ocr-s-f16",
    "qwen3-tts-12hz-1-7b-customvoice",
    "realesrgan-x4",
    "whisperlargev3",
    "zimageturbo-int8",
  ],
}

function resolveEndpointProfileName(config) {
  const fromConfig = config.get("endpointProfile")
  const fromEnv = process.env.RUNPOD_ENDPOINT_PROFILE
  const selected = (fromConfig || fromEnv || "serverless10").trim()

  if (!(selected in ENDPOINT_PROFILES)) {
    const valid = Object.keys(ENDPOINT_PROFILES).join(", ")
    throw new Error(`Unknown endpoint profile '${selected}'. Valid profiles: ${valid}`)
  }

  return selected
}

function filterEndpointsByProfile(manifest, profileName) {
  const requestedIds = ENDPOINT_PROFILES[profileName]
  if (!requestedIds) {
    return manifest.endpoints
  }

  const endpointMap = new Map(manifest.endpoints.map((endpoint) => [endpoint.endpointId, endpoint]))
  const missing = requestedIds.filter((endpointId) => !endpointMap.has(endpointId))

  if (missing.length > 0) {
    throw new Error(
      `Manifest ${profileName} profile is missing endpoint IDs: ${missing.join(", ")}. `
      + `Regenerate manifest or update profile IDs.`
    )
  }

  return requestedIds.map((endpointId) => endpointMap.get(endpointId))
}

const config = new pulumi.Config()
const manifestPath = resolveManifestPath(config)
const manifest = readJsonFile(manifestPath)
const endpointProfile = resolveEndpointProfileName(config)
const selectedEndpoints = filterEndpointsByProfile(manifest, endpointProfile)
const defaultLocations = config.get("locations") || undefined
const defaultScalerType = config.get("scalerType") || "REQUEST_COUNT"
const defaultScalerValue = Number(config.get("scalerValue") || 1)
const networkVolumeId = config.get("networkVolumeId") || process.env.RUNPOD_NETWORK_VOLUME_ID || undefined
const workersMaxOverride =
  parsePositiveInt(process.env.RUNPOD_ENDPOINTS_WORKERS_MAX_OVERRIDE)
  ?? parsePositiveInt(config.get("workersMaxOverride"))

if (!Array.isArray(manifest.endpoints) || manifest.endpoints.length === 0) {
  throw new Error(`No endpoints found in manifest: ${manifestPath}`)
}

if (!Array.isArray(selectedEndpoints) || selectedEndpoints.length === 0) {
  throw new Error(`No endpoints selected for profile '${endpointProfile}' from manifest: ${manifestPath}`)
}

const endpoints = selectedEndpoints.map((endpoint) => {
  const templateId = resolveTemplateId(endpoint.runpod.templateIdEnv)
  const gpuIds = sanitizeGpuIds(endpoint.runpod.gpuTypes)

  if (!gpuIds) {
    throw new Error(`Endpoint ${endpoint.endpointId} has no GPU candidates in manifest`)
  }

  const args = {
    gpuIds,
    name: endpoint.endpointName,
    templateId,
    idleTimeout: endpoint.runpod.idleTimeoutSeconds,
    workersMax: workersMaxOverride ?? endpoint.runpod.workersMax,
    workersMin: endpoint.runpod.workersMin,
    scalerType: defaultScalerType,
    scalerValue: defaultScalerValue,
  }

  if (args.workersMin > args.workersMax) {
    args.workersMin = args.workersMax
  }

  if (defaultLocations) {
    args.locations = defaultLocations
  }

  if (networkVolumeId) {
    args.networkVolumeId = networkVolumeId
  }

  return new runpod.Endpoint(`endpoint-${endpoint.endpointId}`, args)
})

export const endpointIds = endpoints.map((endpoint) => endpoint.id)
export const endpointNames = selectedEndpoints.map((endpoint) => endpoint.endpointName)
export const manifestSourcePath = manifestPath
export const selectedEndpointProfile = endpointProfile
