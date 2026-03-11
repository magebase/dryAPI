import { TinaNodeBackend } from "@tinacms/datalayer"
import type { NextApiRequest, NextApiResponse } from "next"

import databaseClient from "@/lib/tina-database-client"
import { getBearerToken, verifyTinaEditorToken } from "@/lib/tina-editor-auth"

const handler = TinaNodeBackend({
  authProvider: {
    isAuthorized: async (req) => {
      const authorizationHeader = Array.isArray(req.headers.authorization)
        ? req.headers.authorization[0]
        : req.headers.authorization

      const bearerToken = getBearerToken(authorizationHeader)
      if (!bearerToken) {
        return {
          isAuthorized: false,
          errorMessage: "Missing Tina editor token.",
          errorCode: 401,
        }
      }

      const payload = await verifyTinaEditorToken(bearerToken)
      if (!payload) {
        return {
          isAuthorized: false,
          errorMessage: "Invalid or expired Tina editor token.",
          errorCode: 401,
        }
      }

      return { isAuthorized: true }
    },
  },
  databaseClient,
})

export default async function tinaBackend(req: NextApiRequest, res: NextApiResponse) {
  return handler(req, res)
}
