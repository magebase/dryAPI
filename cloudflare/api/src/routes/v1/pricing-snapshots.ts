import { describeRoute, validator } from 'hono-openapi'
import type { Hono } from 'hono'
import { Type } from 'typebox'

import { getCurrentPricingQuote, listPricingSnapshotsForSurface } from '../../lib/db'
import { resolveRunpodEndpointId } from '../../lib/runpod'
import { toStandardTypeboxSchema } from '../../lib/typebox-standard'
import type { WorkerEnv } from '../../types'
import { ModelSlugSchema, surfaceParamValidator } from './schemas'

const PricingSnapshotsQuerySchema = Type.Object({
  model: Type.Optional(ModelSlugSchema),
  endpointId: Type.Optional(Type.String({
    minLength: 1,
    description: 'Optional endpoint filter and quote override.',
    examples: ['chat-endpoint'],
  })),
  limit: Type.Optional(Type.Integer({
    minimum: 1,
    maximum: 100,
    description: 'Maximum snapshots to return, newest first.',
    examples: [25],
  })),
})

const pricingSnapshotsQueryValidator = toStandardTypeboxSchema(PricingSnapshotsQuerySchema)

export function registerPricingSnapshotsRoute(app: Hono<WorkerEnv>) {
  app.get(
    '/v1/pricing/:surface',
    describeRoute({
      tags: ['Pricing'],
      operationId: 'listPricingSnapshots',
      summary: 'List dynamic pricing snapshots for a surface',
      description:
        'Returns worker-calculated pricing snapshots derived from runtime analytics. Prices are computed with a hard 200% profit floor (3x effective unit cost) and refreshed continuously from recent request statistics.',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'surface',
          in: 'path',
          required: true,
          description: 'Inference surface to inspect pricing for.',
          schema: { type: 'string', enum: ['chat', 'images', 'embeddings', 'transcribe'] },
          example: 'images',
        },
        {
          name: 'model',
          in: 'query',
          required: false,
          description: 'Optional model slug filter.',
          schema: { type: 'string' },
          example: 'Flux1schnell',
        },
        {
          name: 'endpointId',
          in: 'query',
          required: false,
          description: 'Optional endpoint filter.',
          schema: { type: 'string' },
          example: 'images-endpoint',
        },
        {
          name: 'limit',
          in: 'query',
          required: false,
          description: 'Maximum rows to return.',
          schema: { type: 'integer', minimum: 1, maximum: 100 },
          example: 25,
        },
      ],
      responses: {
        200: {
          description: 'Pricing snapshots and active quote for the current routing context.',
        },
        401: {
          description: 'Missing or invalid bearer API key.',
        },
      },
    }),
    validator('param', surfaceParamValidator),
    validator('query', pricingSnapshotsQueryValidator),
    async (c) => {
      const { surface } = c.req.valid('param') as {
        surface: 'chat' | 'images' | 'embeddings' | 'transcribe'
      }
      const query = c.req.valid('query') as {
        model?: string
        endpointId?: string
        limit?: number
      }

      const modelSlug = query.model ?? null
      const endpointId = resolveRunpodEndpointId({
        c,
        surface,
        model: modelSlug,
        explicitEndpointId: query.endpointId ?? null,
      })

      const snapshots = await listPricingSnapshotsForSurface({
        c,
        surface,
        modelSlug,
        endpointId,
        limit: query.limit,
      })

      const activeQuote = endpointId
        ? await getCurrentPricingQuote({
            c,
            surface,
            endpointId,
            modelSlug,
          })
        : null

      return c.json(
        {
          surface,
          model: modelSlug,
          endpoint_id: endpointId,
          active_quote: activeQuote
            ? {
                price_key: activeQuote.priceKey,
                source: activeQuote.source,
                unit_price_usd: activeQuote.recommendedPriceUsd,
                min_price_usd: activeQuote.minPriceUsd,
                sample_size: activeQuote.sampleSize,
                p95_execution_seconds: activeQuote.p95ExecutionSeconds,
                min_profit_multiple: activeQuote.minProfitMultiple,
                updated_at: activeQuote.updatedAt,
              }
            : null,
          snapshots,
        },
        200,
      )
    },
  )
}
