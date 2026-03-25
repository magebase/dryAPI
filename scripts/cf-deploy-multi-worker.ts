import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

type RunResult = {
  stdout: string
  stderr: string
  combinedOutput: string
}

const SERVER_CONFIG_PATH = "wrangler.server.jsonc"
const MIDDLEWARE_CONFIG_PATH = "wrangler.middleware.jsonc"

function ensureConfigExists(configPath: string): void {
  const resolvedPath = path.resolve(process.cwd(), configPath)
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Missing required wrangler config: ${configPath}`)
  }
}

function runPnpm(args: string[]): RunResult {
  const printable = ["pnpm", ...args].join(" ")
  process.stdout.write(`\n$ ${printable}\n`)

  const result = spawnSync("pnpm", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  })

  const stdout = result.stdout ?? ""
  const stderr = result.stderr ?? ""

  if (stdout) {
    process.stdout.write(stdout)
  }

  if (stderr) {
    process.stderr.write(stderr)
  }

  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${printable}`)
  }

  return {
    stdout,
    stderr,
    combinedOutput: `${stdout}\n${stderr}`,
  }
}

function parseUploadedVersionId(output: string, label: string): string {
  const match = output.match(/Worker Version ID:\s*([A-Za-z0-9-]+)/i)
  if (!match || !match[1]) {
    throw new Error(`Unable to parse uploaded ${label} worker version id from wrangler output.`)
  }

  return match[1]
}

type VersionCandidate = {
  id: string
  percentage: number
}

function toPercentage(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return 0
}

function readVersionId(value: Record<string, unknown>): string | null {
  const candidates = [
    value.version_id,
    value.versionId,
    value.version,
    value.id,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }

  return null
}

function collectVersionCandidates(node: unknown, candidates: VersionCandidate[]): void {
  if (!node || typeof node !== "object") {
    return
  }

  if (Array.isArray(node)) {
    for (const entry of node) {
      collectVersionCandidates(entry, candidates)
    }
    return
  }

  const record = node as Record<string, unknown>

  if (Array.isArray(record.versions)) {
    for (const entry of record.versions) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        continue
      }

      const versionEntry = entry as Record<string, unknown>
      const versionId = readVersionId(versionEntry)
      if (!versionId) {
        continue
      }

      candidates.push({
        id: versionId,
        percentage: toPercentage(versionEntry.percentage),
      })
    }
  }

  for (const value of Object.values(record)) {
    collectVersionCandidates(value, candidates)
  }
}

function parseCurrentDeploymentVersionId(output: string, configPath: string): string | null {
  let parsed: unknown

  try {
    parsed = JSON.parse(output)
  } catch {
    throw new Error(`Failed to parse deployments status JSON for ${configPath}`)
  }

  const candidates: VersionCandidate[] = []
  collectVersionCandidates(parsed, candidates)

  if (candidates.length === 0) {
    return null
  }

  candidates.sort((left, right) => right.percentage - left.percentage)

  return candidates[0]?.id ?? null
}

function resolveCurrentDeploymentVersionId(configPath: string): string | null {
  const { stdout } = runPnpm([
    "exec",
    "wrangler",
    "deployments",
    "status",
    "--json",
    "--config",
    configPath,
  ])

  return parseCurrentDeploymentVersionId(stdout.trim(), configPath)
}

function uploadWorkerVersion(configPath: string, label: string, extraArgs: string[] = []): string {
  const { combinedOutput } = runPnpm([
    "exec",
    "wrangler",
    "versions",
    "upload",
    "--config",
    configPath,
    "--message",
    `${label} upload ${new Date().toISOString()}`,
    ...extraArgs,
  ])

  const versionId = parseUploadedVersionId(combinedOutput, label)
  process.stdout.write(`Parsed ${label} version id: ${versionId}\n`)
  return versionId
}

function deployVersionSplit(configPath: string, splits: string[], message: string): void {
  runPnpm([
    "exec",
    "wrangler",
    "versions",
    "deploy",
    ...splits,
    "-y",
    "--message",
    message,
    "--config",
    configPath,
  ])
}

function deployTriggers(configPath: string): void {
  runPnpm([
    "exec",
    "wrangler",
    "triggers",
    "deploy",
    "--config",
    configPath,
  ])
}

function main(): void {
  ensureConfigExists(SERVER_CONFIG_PATH)
  ensureConfigExists(MIDDLEWARE_CONFIG_PATH)

  const serverVersionId = uploadWorkerVersion(SERVER_CONFIG_PATH, "server")
  const currentServerVersionId = resolveCurrentDeploymentVersionId(SERVER_CONFIG_PATH)

  if (currentServerVersionId && currentServerVersionId !== serverVersionId) {
    deployVersionSplit(
      SERVER_CONFIG_PATH,
      [`${currentServerVersionId}@100%`, `${serverVersionId}@0%`],
      `staged server deployment ${serverVersionId}`,
    )
  }

  const middlewareVersionId = uploadWorkerVersion(
    MIDDLEWARE_CONFIG_PATH,
    "middleware",
    ["--var", `WORKER_VERSION_ID:${serverVersionId}`],
  )

  deployVersionSplit(
    MIDDLEWARE_CONFIG_PATH,
    [`${middlewareVersionId}@100%`],
    `activate middleware ${middlewareVersionId}`,
  )

  // Ensure public routes/custom domains stay attached to middleware.
  deployTriggers(MIDDLEWARE_CONFIG_PATH)

  deployVersionSplit(
    SERVER_CONFIG_PATH,
    [`${serverVersionId}@100%`],
    `activate server ${serverVersionId}`,
  )

  process.stdout.write("\nMulti-worker deployment completed successfully.\n")
}

main()
