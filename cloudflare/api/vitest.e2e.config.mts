import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export default defineConfig({
  test: {
    name: 'cloudflare-api-e2e',
    include: ['cloudflare/api/test/e2e/**/*.spec.ts'],
    globalSetup: 'cloudflare/api/test/e2e/global-setup.ts',
    testTimeout: 45_000,
    hookTimeout: 180_000,
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: Math.max(2, Math.floor(os.cpus().length / 2)),
      },
    },
    reporters: ['verbose'],
    outputFile: {
      html: path.join(rootDir, 'playwright-report', 'cloudflare-api-e2e', 'index.html'),
    },
  },
})
