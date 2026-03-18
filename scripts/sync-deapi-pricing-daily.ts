// @ts-nocheck
import { spawn } from "node:child_process"
import path from "node:path"

const DAY_MS = 24 * 60 * 60 * 1000
const scriptPath = path.join(process.cwd(), "scripts", "sync-deapi-pricing.ts")

function runSyncJob() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", scriptPath], {
      stdio: "inherit",
      env: process.env,
    })

    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`Pricing sync exited with code ${String(code)}`))
    })
  })
}

async function runForever() {
  while (true) {
    const startedAt = new Date().toISOString()
    console.log(`[deapi-pricing] Starting daily sync at ${startedAt}`)

    try {
      await runSyncJob()
      console.log(`[deapi-pricing] Completed daily sync at ${new Date().toISOString()}`)
    } catch (error) {
      console.error(`[deapi-pricing] Sync failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    await new Promise((resolve) => setTimeout(resolve, DAY_MS))
  }
}

runForever().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
