import type { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'

import { getCreditBalance, resolveCreditUserId } from '../../lib/credit-ledger'
import type { WorkerEnv } from '../../types'

export function registerClientBalanceRoute(app: Hono<WorkerEnv>) {
  app.get(
    '/v1/client/balance',
    describeRoute({
      tags: ['Client'],
      operationId: 'getClientBalance',
      summary: 'Get current available credits',
      description:
        'Returns available credits for the authenticated caller identity routed through the credit shard durable object ledger.',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Current available credit balance.',
          content: {
            'application/json': {
              example: {
                user_id: 'user_42',
                available_credits: 127.5,
              },
            },
          },
        },
        401: {
          description: 'Missing or invalid bearer API key.',
        },
      },
    }),
    async (c) => {
      const userId = await resolveCreditUserId({ c })

      const balanceResult = await getCreditBalance({
        c,
        userId,
      })
      if (!balanceResult.ok) {
        return balanceResult.response
      }

      return c.json(
        {
          user_id: userId,
          available_credits: Number(balanceResult.balance.toFixed(6)),
        },
        200,
      )
    },
  )
}
