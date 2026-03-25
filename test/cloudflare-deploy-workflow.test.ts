import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

const workflowPath = resolve(process.cwd(), ".github/workflows/cloudflare-deploy.yml")
const rootWranglerPath = resolve(process.cwd(), "wrangler.jsonc")
const packageJsonPath = resolve(process.cwd(), "package.json")

const workflowContent = readFileSync(workflowPath, "utf8")
const rootWranglerContent = readFileSync(rootWranglerPath, "utf8")
const packageJsonContent = readFileSync(packageJsonPath, "utf8")

function readServiceTarget(content: string, bindingName: string): string | null {
  const match = content.match(
    new RegExp(`\"binding\":\\s*\"${bindingName}\"[\\s\\S]*?\"service\":\\s*\"([^\"]+)\"`),
  )

  return match?.[1] ?? null
}

function readDurableObjectScriptTarget(content: string, bindingName: string): string | null {
  const match = content.match(
    new RegExp(`\"name\":\\s*\"${bindingName}\"[\\s\\S]*?\"script_name\":\\s*\"([^\"]+)\"`),
  )

  return match?.[1] ?? null
}

describe("cloudflare deploy workflow", () => {
  it("provisions the account export queue before deploying the API worker", () => {
    const ensureStep = "      - name: Ensure API account export queue exists"
    const queueName = '          queue_name="dryapi-account-exports"'
    const deployStep = "      - name: Deploy API worker to Cloudflare Workers"

    expect(workflowContent).toContain(ensureStep)
    expect(workflowContent).toContain(queueName)
    expect(workflowContent.indexOf(ensureStep)).toBeLessThan(workflowContent.indexOf(deployStep))
  })

  it("exports the Hyperdrive local connection string for OpenNext deploy", () => {
    const hyperdriveEnv =
      "      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: ${{ secrets.GH_ACTIONS_DATABASE_URL }}"

    expect(workflowContent).toContain(hyperdriveEnv)
  })

  it("deploys the single OpenNext worker directly", () => {
    expect(packageJsonContent).toContain(
      '"cf:deploy:only": "pnpm exec wrangler deploy --config wrangler.jsonc"',
    )
    expect(rootWranglerContent).toContain('"main": ".open-next/worker.js"')
    expect(readServiceTarget(rootWranglerContent, "WORKER_SELF_REFERENCE")).toBe("dryapi-site")
  })

  it("keeps Durable Object ownership on the OpenNext worker", () => {
    const bindingNames = [
      "NEXT_CACHE_DO_QUEUE",
      "NEXT_TAG_CACHE_DO_SHARDED",
      "NEXT_CACHE_DO_PURGE",
    ]

    for (const bindingName of bindingNames) {
      expect(readDurableObjectScriptTarget(rootWranglerContent, bindingName)).toBeNull()
    }
  })

  it("removes the split-worker artifacts", () => {
    const removedPaths = [
      "cloudflare/site/server-worker.js",
      "cloudflare/site/middleware-worker.js",
      "wrangler.server.jsonc",
      "wrangler.middleware.jsonc",
      "scripts/cf-deploy-multi-worker.ts",
    ]

    for (const relativePath of removedPaths) {
      expect(existsSync(resolve(process.cwd(), relativePath))).toBe(false)
    }
  })
})
