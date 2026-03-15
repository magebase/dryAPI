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

const config = new pulumi.Config()
const manifestPath = resolveManifestPath(config)
const manifest = readJsonFile(manifestPath)
const defaultLocations = config.get("locations") || undefined
const defaultScalerType = config.get("scalerType") || "REQUEST_COUNT"
const defaultScalerValue = Number(config.get("scalerValue") || 1)
const networkVolumeId = config.get("networkVolumeId") || process.env.RUNPOD_NETWORK_VOLUME_ID || undefined

if (!Array.isArray(manifest.endpoints) || manifest.endpoints.length === 0) {
  throw new Error(`No endpoints found in manifest: ${manifestPath}`)
}

const endpoints = manifest.endpoints.map((endpoint) => {
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
    workersMax: endpoint.runpod.workersMax,
    workersMin: endpoint.runpod.workersMin,
    scalerType: defaultScalerType,
    scalerValue: defaultScalerValue,
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
export const endpointNames = manifest.endpoints.map((endpoint) => endpoint.endpointName)
export const manifestSourcePath = manifestPath
