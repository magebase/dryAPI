import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { defineConfig } from '@playwright/test'

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  const values = {}

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

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    values[key] = value
  }

  return values
}

const rootDir = process.cwd()
const runpodMockScript = path.join(rootDir, 'scripts', 'cf-e2e-runpod-mock.sh')
const workerScript = path.join(rootDir, 'scripts', 'cf-e2e-worker-dev.sh')
const envFilePath = process.env.CF_E2E_ENV_FILE
  ? path.resolve(rootDir, process.env.CF_E2E_ENV_FILE)
  : path.join(rootDir, '.env.test')

const envFromFile = readEnvFile(envFilePath)
const mergedEnv = {
  ...envFromFile,
  ...process.env,
}

const isCi = mergedEnv.CI === 'true' || mergedEnv.CI === '1'
const apiPort = mergedEnv.CF_E2E_API_PORT ?? '8877'
const runpodPort = mergedEnv.CF_E2E_RUNPOD_PORT ?? '8878'
const baseURL = mergedEnv.CF_E2E_BASE_URL ?? `http://127.0.0.1:${apiPort}`

const sharedEnv = {
  ...envFromFile,
  ...process.env,
  CF_E2E_ENV_FILE: envFilePath,
}

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  workers: isCi ? 4 : Math.max(2, Math.floor(os.cpus().length / 2)),
  timeout: 45_000,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: path.join(rootDir, 'playwright-report', 'cloudflare-api-e2e') }],
  ],
  use: {
    baseURL,
    extraHTTPHeaders: {
      accept: 'application/json',
    },
  },
  webServer: [
    {
      command: `bash "${runpodMockScript}"`,
      url: `http://127.0.0.1:${runpodPort}/__health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: sharedEnv,
    },
    {
      command: `bash "${workerScript}"`,
      url: `${baseURL}/openapi.json`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: sharedEnv,
    },
  ],
})
