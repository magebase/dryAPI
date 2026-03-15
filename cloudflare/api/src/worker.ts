import { Hono } from 'hono'

import { registerCommonMiddleware } from './lib/middleware'
import { ApiQuotaDurableObject } from './durable/api-quota'
import { registerOpenApiJsonRoute } from './routes/openapi-json'
import { registerV1Routes } from './routes/v1'
import type { WorkerEnv } from './types'

const app = new Hono<WorkerEnv>()

registerCommonMiddleware(app)
registerOpenApiJsonRoute(app)
registerV1Routes(app)

export default app
export { ApiQuotaDurableObject }
