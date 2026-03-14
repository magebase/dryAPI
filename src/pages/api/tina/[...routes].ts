import { LocalBackendAuthProvider, TinaNodeBackend } from "@tinacms/datalayer"
import type { NextApiRequest, NextApiResponse } from "next"

import databaseClient from "@/lib/tina-database-client"

const handler = TinaNodeBackend({
  authProvider: LocalBackendAuthProvider(),
  databaseClient,
})

export default async function tinaBackend(req: NextApiRequest, res: NextApiResponse) {
  try {
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
