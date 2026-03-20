import type { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'

import { seedCreditsForTestUser } from '../../lib/credit-ledger'
import { jsonError } from '../../lib/errors'
import type { WorkerEnv } from '../../types'

export function registerE2eSeedingRoute(app: Hono<WorkerEnv>) {
  // This route is ONLY enabled in test environments to seed credits for E2E tests.
  app.post(
    '/v1/internal/test/seed-credits',
    describeRoute({
      tags: ['Internal'],
      summary: 'Seed credits for a test user (E2E only)',
      responses: {
        200: { description: 'Credits seeded successfully' },
        403: { description: 'Forbidden in production' },
      },
    }),
    async (c) => {
      // Security: Only allow in non-production environments OR if explicit test flag is set.
      if (c.env.ENVIRONMENT === 'production' && !c.env.ALLOW_TEST_SEEDING) {
        return jsonError(c, 403, 'forbidden', 'Seeding is disabled in production')
      }

      const body = await c.req.json().catch(() => ({}))
      const userId = body.userId
      const amount = Number(body.amount)

      if (!userId || isNaN(amount)) {
        return jsonError(c, 400, 'invalid_request', 'userId and amount required')
      }

      const result = await seedCreditsForTestUser({
        c,
        userId,
        amount,
      })

      if (!result.ok) {
        return result.response
      }

      return c.json({
        ok: true,
        user_id: userId,
        balance: result.balance,
      })
    },
  )
}
