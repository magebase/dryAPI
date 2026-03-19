import path from 'node:path'
import { spawn } from 'node:child_process'

const DAY_MS = 24 * 60 * 60 * 1000
const scriptPath = path.join(process.cwd(), 'scripts', 'sync-runpod-pricing.ts')

function runSyncJob(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', scriptPath], {
      stdio: 'inherit',
      env: process.env,
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`RunPod pricing sync exited with code ${String(code)}`))
    })
  })
}

async function runForever(): Promise<void> {
  while (true) {
    const startedAt = new Date().toISOString()
    console.log(`[runpod-pricing] Starting daily sync at ${startedAt}`)

    try {
      await runSyncJob()
      console.log(`[runpod-pricing] Completed daily sync at ${new Date().toISOString()}`)
    } catch (error) {
      console.error(`[runpod-pricing] Daily sync failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    await new Promise((resolve) => setTimeout(resolve, DAY_MS))
  }
}

runForever().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
