import type { Hono } from 'hono'

import { getOpenApiDocument } from '../openapi/document'
import type { WorkerEnv } from '../types'

export function registerOpenApiJsonRoute(app: Hono<WorkerEnv>) {
  app.get('/openapi.json', async (c) => {
    const document = await getOpenApiDocument(app)
    return c.json(document)
  })
}
