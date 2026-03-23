import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

const workflowPath = resolve(process.cwd(), ".github/workflows/cloudflare-deploy.yml")
const workflowContent = readFileSync(workflowPath, "utf8")

describe("cloudflare deploy workflow", () => {
  it("provisions the account export queue before deploying the API worker", () => {
    const ensureStep = "      - name: Ensure API account export queue exists"
    const queueName = '          queue_name="dryapi-account-exports"'
    const deployStep = "      - name: Deploy API worker to Cloudflare Workers"

    expect(workflowContent).toContain(ensureStep)
    expect(workflowContent).toContain(queueName)
    expect(workflowContent.indexOf(ensureStep)).toBeLessThan(workflowContent.indexOf(deployStep))
  })
})
