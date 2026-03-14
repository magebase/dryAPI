import type { NextApiRequest, NextApiResponse } from "next"

import databaseClient from "@/lib/tina-database-client"

type TinaApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<unknown>

let cachedHandler: TinaApiHandler | null = null

async function getTinaHandler(): Promise<TinaApiHandler> {
  if (cachedHandler) {
    return cachedHandler
  }

  // js-sha1 switches to a Node-specific path that uses eval("require(...)") when
  // process.versions.node is present; that fails in Cloudflare Workers.
  ;(globalThis as { JS_SHA1_NO_NODE_JS?: boolean }).JS_SHA1_NO_NODE_JS = true

  const { LocalBackendAuthProvider, TinaNodeBackend } = await import("@tinacms/datalayer")

  const handler = TinaNodeBackend({
    authProvider: LocalBackendAuthProvider(),
    databaseClient,
  })

  cachedHandler = async (req, res) => handler(req, res)
  return cachedHandler
}

export default async function tinaBackend(req: NextApiRequest, res: NextApiResponse) {
  try {
    const handler = await getTinaHandler()
    return await handler(req, res)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Tina API error"

    if (!res.headersSent) {
      res.status(500).json({ error: message })
      return
    }

    throw error
  }
}
