import { LocalBackendAuthProvider, TinaNodeBackend } from "@tinacms/datalayer"
import type { NextApiRequest, NextApiResponse } from "next"

import databaseClient from "@/lib/tina-database-client"
import { normalizeTinaBackendUrl } from "@/lib/tina-backend-url"

const handler = TinaNodeBackend({
  authProvider: LocalBackendAuthProvider(),
  databaseClient,
})

export default async function tinaBackend(req: NextApiRequest, res: NextApiResponse) {
  const originalUrl = req.url

  try {
    req.url = normalizeTinaBackendUrl(req.url || "")
    return await handler(req, res)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Tina API error"

    if (!res.headersSent && message.startsWith("Unsupported Tina backend path:")) {
      res.status(400).json({ error: message })
      return
    }

    if (!res.headersSent) {
      res.status(500).json({ error: message })
      return
    }

    throw error
  } finally {
    req.url = originalUrl
  }
}
