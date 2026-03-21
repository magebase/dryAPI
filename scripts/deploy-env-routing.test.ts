import { promises as fs } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

describe('deploy env routing', () => {
  it('preloads .env before the Cloudflare build', async () => {
    const packageJsonPath = path.join(process.cwd(), 'package.json')
    const packageJsonRaw = await fs.readFile(packageJsonPath, 'utf8')
    const packageJson = JSON.parse(packageJsonRaw) as {
      scripts?: Record<string, string>
    }

    const cfBuildScript = packageJson.scripts?.['cf:build'] ?? ''

    expect(cfBuildScript).toContain('dotenv -e .env --')
    expect(cfBuildScript).not.toContain('.env.local')
  })

  it('forces the GitHub env sync wrapper to use .env', async () => {
    const wrapperPath = path.join(process.cwd(), 'scripts', 'sync-github-en.sh')
    const wrapperRaw = await fs.readFile(wrapperPath, 'utf8')

    expect(wrapperRaw).toContain('--env-file .env')
    expect(wrapperRaw).not.toContain('.env.local')
  })
})