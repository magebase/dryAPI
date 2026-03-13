import { LocalBackendAuthProvider, TinaNodeBackend } from "@tinacms/datalayer"
import type { NextApiRequest, NextApiResponse } from "next"

import databaseClient from "@/lib/tina-database-client"

const handler = TinaNodeBackend({
  authProvider: LocalBackendAuthProvider(),
  databaseClient,
})

export default async function tinaBackend(req: NextApiRequest, res: NextApiResponse) {
  return handler(req, res)
}
