import { describeRoute, validator } from 'hono-openapi'
import type { Hono } from 'hono'
import { Type } from 'typebox'

import { enqueueOpenAiCompatible } from './openai-enqueue'
import { ModelSlugSchema } from './schemas'
import { toStandardTypeboxSchema } from '../../lib/typebox-standard'
import type { WorkerEnv } from '../../types'

const EmbeddingsPayloadSchema = Type.Object({
  model: Type.Optional(ModelSlugSchema),
  input: Type.Union([
    Type.String({
      minLength: 1,
      description: 'Single input string to embed.',
      examples: ['How to optimize cold starts for serverless GPUs'],
    }),
    Type.Array(Type.String({ minLength: 1 }), {
      minItems: 1,
      description: 'Batch input strings to embed in one request.',
      examples: [['Serverless', 'Inference', 'Embeddings']],
    }),
  ]),
  dimensions: Type.Optional(Type.Integer({
    minimum: 1,
    description: 'Optional embedding dimensionality override when supported by the model.',
    examples: [1024],
  })),
  encoding_format: Type.Optional(Type.Union([Type.Literal('float'), Type.Literal('base64')], {
    description: 'Vector encoding preference when supported by the provider.',
    examples: ['float'],
  })),
  user: Type.Optional(Type.String({
    minLength: 1,
    description: 'Caller-provided user identifier for tracing and abuse monitoring.',
    examples: ['user_42'],
  })),
  webhook_url: Type.Optional(Type.String({
    format: 'uri',
    description: 'Optional HTTPS webhook URL for async status updates.',
    examples: ['https://example.com/webhooks/dryapi/embeddings'],
  })),
}, { additionalProperties: true })

const embeddingsPayloadValidator = toStandardTypeboxSchema(EmbeddingsPayloadSchema)

export function registerEmbeddingsRoute(app: Hono<WorkerEnv>) {
  app.post(
    '/v1/embeddings',
    describeRoute({
      tags: ['OpenAI-Compatible'],
      operationId: 'createEmbeddingJob',
      summary: 'Queue an embeddings request',
      description:
        'Queues embedding generation for one or many input strings and returns async job metadata. Use job status/download routes to resolve final vectors.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: EmbeddingsPayloadSchema,
            examples: {
              single: {
                summary: 'Single embedding input',
                value: {
                  model: 'BGE_Large',
                  input: 'RunPod queue depth and latency optimization strategies',
                  encoding_format: 'float',
                },
              },
              batch: {
                summary: 'Batch embedding input',
                value: {
                  model: 'E5_Large',
                  input: ['cold start mitigation', 'webhook retries', 'token cost accounting'],
                  webhook_url: 'https://example.com/webhooks/dryapi/embeddings',
                },
              },
            },
          },
        },
      },
      responses: {
        202: {
          description: 'Embeddings request accepted and queued.',
          content: {
            'application/json': {
              example: {
                id: 'f3de27f8-61d5-4d58-aad1-a7d63f8a6e0f',
                object: 'embedding.enqueue',
                created: 1773504000,
                status: 'queued',
                surface: 'embeddings',
                model: 'BGE_Large',
                endpoint_id: 'o6r4i5q9j8k7l6',
                runpod: {
                  id: 'f3de27f8-61d5-4d58-aad1-a7d63f8a6e0f',
                  status: 'IN_QUEUE',
                },
              },
            },
          },
        },
        400: {
          description: 'Invalid request payload or missing endpoint configuration.',
        },
        401: {
          description: 'Missing or invalid bearer API key.',
        },
        429: {
          description: 'Rate-limited by gateway quota controls.',
        },
        502: {
          description: 'Provider returned a non-success response.',
        },
        500: {
          description: 'Gateway configuration or execution error.',
        },
      },
    }),
    validator('json', embeddingsPayloadValidator),
    async (c) => {
      const payload = c.req.valid('json') as Record<string, unknown>
      const model = typeof payload.model === 'string' ? payload.model : null

      return enqueueOpenAiCompatible({
        c,
        surface: 'embeddings',
        payload,
        modelSlug: model,
        objectName: 'embedding.enqueue',
        cacheTtlSeconds: 30,
      })
    },
  )
}
