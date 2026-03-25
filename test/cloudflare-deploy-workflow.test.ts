import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

const workflowPath = resolve(process.cwd(), ".github/workflows/cloudflare-deploy.yml")
const serverWranglerPath = resolve(process.cwd(), "wrangler.server.jsonc")
const middlewareWranglerPath = resolve(process.cwd(), "wrangler.middleware.jsonc")

const workflowContent = readFileSync(workflowPath, "utf8")
const serverWranglerContent = readFileSync(serverWranglerPath, "utf8")
const middlewareWranglerContent = readFileSync(middlewareWranglerPath, "utf8")

function readServiceTarget(content: string, bindingName: string): string | null {
  const match = content.match(
    new RegExp(`\"binding\":\\s*\"${bindingName}\"[\\s\\S]*?\"service\":\\s*\"([^\"]+)\"`),
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

  it("keeps the server worker self-referential and the middleware worker pointed at the server", () => {
    expect(readServiceTarget(serverWranglerContent, "WORKER_SELF_REFERENCE")).toBe("dryapi-site")
    expect(readServiceTarget(middlewareWranglerContent, "WORKER_SELF_REFERENCE")).toBe(
      "dryapi-site-middleware",
    )
    expect(readServiceTarget(middlewareWranglerContent, "DEFAULT_WORKER")).toBe("dryapi-site")
  })
})
