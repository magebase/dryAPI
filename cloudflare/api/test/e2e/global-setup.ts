import { type ChildProcess, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  const values: Record<string, string> = {}

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) {
      continue
    }

    const normalized = line.startsWith('export ') ? line.slice(7) : line
    const separator = normalized.indexOf('=')
    if (separator <= 0) {
      continue
    }

    const key = normalized.slice(0, separator).trim()
    let value = normalized.slice(separator + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    values[key] = value
  }

  return values
}

async function pollUntilReady(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.status < 500) return
    } catch (err) {
      lastError = err
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  throw new Error(`Timed out waiting for ${url} to be ready. Last error: ${lastError}`)
}

const runningProcs: ChildProcess[] = []

export async function setup(): Promise<void> {
  const rootDir = process.cwd()
  const runpodMockScript = path.join(rootDir, 'scripts', 'cf-e2e-runpod-mock.sh')
  const workerScript = path.join(rootDir, 'scripts', 'cf-e2e-worker-dev.sh')
  const envFilePath = process.env.CF_E2E_ENV_FILE
    ? path.resolve(rootDir, process.env.CF_E2E_ENV_FILE)
    : path.join(rootDir, '.env.test')

  const envFromFile = readEnvFile(envFilePath)
  const mergedEnv: Record<string, string> = {
    ...envFromFile,
    ...(process.env as Record<string, string>),
  }

  const apiPort = mergedEnv['CF_E2E_API_PORT'] ?? '8877'
  const runpodPort = mergedEnv['CF_E2E_RUNPOD_PORT'] ?? '8878'
  const baseURL = mergedEnv['CF_E2E_BASE_URL'] ?? `http://127.0.0.1:${apiPort}`

  process.env['CF_E2E_BASE_URL'] = baseURL
  process.env['CF_E2E_API_KEY'] ??= mergedEnv['CF_E2E_API_KEY'] ?? 'test-api-key'
  process.env['CF_E2E_ENDPOINT_CHAT'] ??= mergedEnv['CF_E2E_ENDPOINT_CHAT'] ?? 'e2e-chat-endpoint'
  process.env['CF_E2E_ENDPOINT_IMAGES'] ??= mergedEnv['CF_E2E_ENDPOINT_IMAGES'] ?? 'e2e-images-endpoint'
  process.env['CF_E2E_ENDPOINT_EMBEDDINGS'] ??=
    mergedEnv['CF_E2E_ENDPOINT_EMBEDDINGS'] ?? 'e2e-embeddings-endpoint'
  process.env['CF_E2E_ENDPOINT_TRANSCRIBE'] ??=
    mergedEnv['CF_E2E_ENDPOINT_TRANSCRIBE'] ?? 'e2e-transcribe-endpoint'

  const runpodProc = spawn('bash', [runpodMockScript], {
    env: mergedEnv as NodeJS.ProcessEnv,
    stdio: 'inherit',
  })
  runningProcs.push(runpodProc)

  await pollUntilReady(`http://127.0.0.1:${runpodPort}/__health`, 120_000)

  const workerProc = spawn('bash', [workerScript], {
    env: mergedEnv as NodeJS.ProcessEnv,
    stdio: 'inherit',
  })
  runningProcs.push(workerProc)

  await pollUntilReady(`${baseURL}/openapi.json`, 180_000)
}

export async function teardown(): Promise<void> {
  for (const proc of runningProcs) {
    proc.kill('SIGTERM')
  }
  runningProcs.length = 0
}
