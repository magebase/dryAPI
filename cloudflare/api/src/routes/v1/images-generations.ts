import { describeRoute, validator } from 'hono-openapi'
import type { Hono } from 'hono'
import { Type } from 'typebox'

import { enqueueOpenAiCompatible } from './openai-enqueue'
import { ModelSlugSchema } from './schemas'
import { toStandardTypeboxSchema } from '../../lib/typebox-standard'
import type { WorkerEnv } from '../../types'

const ImagePayloadSchema = Type.Object({
  model: Type.Optional(ModelSlugSchema),
  prompt: Type.String({
    minLength: 1,
    description: 'Natural-language prompt used for image generation.',
    examples: ['A moody cyberpunk alley at night with rain reflections, 35mm film look'],
  }),
  negative_prompt: Type.Optional(Type.String({
    minLength: 1,
    description: 'Optional content to discourage in the generated output.',
    examples: ['blurry, low quality, watermark'],
  })),
  n: Type.Optional(Type.Integer({
    minimum: 1,
    maximum: 8,
    default: 1,
    description: 'Number of images to generate.',
  })),
  size: Type.Optional(Type.String({
    minLength: 3,
    description: 'Requested output size in WIDTHxHEIGHT format.',
    examples: ['1024x1024'],
  })),
  response_format: Type.Optional(Type.Union([Type.Literal('url'), Type.Literal('b64_json')], {
    description: 'Preferred image payload format when provider supports it.',
    examples: ['url'],
  })),
  webhook_url: Type.Optional(Type.String({
    format: 'uri',
    description: 'Optional HTTPS webhook URL for async status updates.',
    examples: ['https://example.com/webhooks/dryapi/images'],
  })),
}, { additionalProperties: true })

const imagePayloadValidator = toStandardTypeboxSchema(ImagePayloadSchema)

export function registerImageGenerationsRoute(app: Hono<WorkerEnv>) {
  app.post(
    '/v1/images/generations',
    describeRoute({
      tags: ['OpenAI-Compatible'],
      operationId: 'createImageGeneration',
      summary: 'Queue an image generation request',
      description:
        'Queues image generation using the configured model and endpoint mapping. The response is asynchronous and includes a provider job payload for downstream polling.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: ImagePayloadSchema,
            examples: {
              photoreal: {
                summary: 'Photoreal generation',
                value: {
                  model: 'Flux1schnell',
                  prompt: 'A studio portrait of an astronaut with dramatic rim lighting',
                  negative_prompt: 'blurry, overexposed',
                  n: 1,
                  size: '1024x1024',
                },
              },
              webhook: {
                summary: 'Generation with callback',
                value: {
                  model: 'SDXL',
                  prompt: 'Architectural rendering of a glass research campus at sunrise',
                  webhook_url: 'https://example.com/webhooks/dryapi/images',
                },
              },
            },
          },
        },
      },
      responses: {
        202: {
          description: 'Image generation request accepted and queued.',
          content: {
            'application/json': {
              example: {
                id: 'f3de27f8-61d5-4d58-aad1-a7d63f8a6e0f',
                object: 'image.generation.enqueue',
                created: 1773504000,
                status: 'queued',
                surface: 'images',
                model: 'Flux1schnell',
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
    validator('json', imagePayloadValidator),
    async (c) => {
      const payload = c.req.valid('json') as Record<string, unknown>
      const model = typeof payload.model === 'string' ? payload.model : null

      return enqueueOpenAiCompatible({
        c,
        surface: 'images',
        payload,
        modelSlug: model,
        objectName: 'image.generation.enqueue',
        cacheTtlSeconds: 20,
      })
    },
  )
}
