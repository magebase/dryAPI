import { describeRoute, validator } from 'hono-openapi'
import type { Hono } from 'hono'
import { Type } from 'typebox'

import { enqueueOpenAiCompatible } from './openai-enqueue'
import { ModelSlugSchema } from './schemas'
import { toStandardTypeboxSchema } from '../../lib/typebox-standard'
import type { WorkerEnv } from '../../types'

const ChatMessageSchema = Type.Object({
  role: Type.Union([
    Type.Literal('system'),
    Type.Literal('user'),
    Type.Literal('assistant'),
  ], {
    description: 'Role for each chat message in the conversation history.',
    examples: ['user'],
  }),
  content: Type.String({
    minLength: 1,
    description: 'Message text content passed to the selected model.',
    examples: ['Summarize this document in 5 bullets.'],
  }),
})

const ChatPayloadSchema = Type.Object({
  model: Type.Optional(ModelSlugSchema),
  messages: Type.Array(ChatMessageSchema, {
    minItems: 1,
    description: 'Conversation message list in OpenAI chat format.',
  }),
  temperature: Type.Optional(Type.Number({
    minimum: 0,
    maximum: 2,
    description: 'Sampling temperature. Lower values are more deterministic.',
    examples: [0.2],
  })),
  max_tokens: Type.Optional(Type.Integer({
    minimum: 1,
    maximum: 8192,
    description: 'Maximum number of output tokens.',
    examples: [512],
  })),
  stream: Type.Optional(Type.Boolean({
    description: 'Request token streaming from the upstream provider when supported.',
    default: false,
  })),
  user: Type.Optional(Type.String({
    minLength: 1,
    description: 'Caller-provided user identifier for traceability and abuse monitoring.',
    examples: ['user_42'],
  })),
  webhook_url: Type.Optional(Type.String({
    format: 'uri',
    description: 'Optional HTTPS webhook URL for async status updates.',
    examples: ['https://example.com/webhooks/dryapi/chat'],
  })),
}, { additionalProperties: true })

const chatPayloadValidator = toStandardTypeboxSchema(ChatPayloadSchema)

export function registerChatCompletionsRoute(app: Hono<WorkerEnv>) {
  app.post(
    '/v1/chat/completions',
    describeRoute({
      tags: ['OpenAI-Compatible'],
      operationId: 'createChatCompletion',
      summary: 'Queue a chat completion request',
      description:
        'Accepts an OpenAI-compatible chat payload and queues execution on the routed provider endpoint. Returns `202 Accepted` immediately with request metadata and provider job details.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: ChatPayloadSchema,
            examples: {
              basic: {
                summary: 'Basic prompt',
                value: {
                  model: 'Llama3_8B_Instruct',
                  messages: [
                    { role: 'system', content: 'You are a concise assistant.' },
                    { role: 'user', content: 'List three caching strategies for LLM APIs.' },
                  ],
                  temperature: 0.3,
                  max_tokens: 320,
                },
              },
              withWebhook: {
                summary: 'Async callback flow',
                value: {
                  model: 'Mixtral_8x7B_Instruct',
                  messages: [{ role: 'user', content: 'Generate a release checklist for a GPU endpoint.' }],
                  webhook_url: 'https://example.com/webhooks/dryapi/chat',
                },
              },
            },
          },
        },
      },
      responses: {
        202: {
          description: 'Chat request accepted and queued.',
          content: {
            'application/json': {
              examples: {
                queued: {
                  summary: 'Queued response',
                  value: {
                    id: 'f3de27f8-61d5-4d58-aad1-a7d63f8a6e0f',
                    object: 'chat.completion.enqueue',
                    created: 1773504000,
                    status: 'queued',
                    surface: 'chat',
                    model: 'Llama3_8B_Instruct',
                    endpoint_id: 'o6r4i5q9j8k7l6',
                    runpod: {
                      id: 'f3de27f8-61d5-4d58-aad1-a7d63f8a6e0f',
                      status: 'IN_QUEUE',
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Invalid payload or missing endpoint routing configuration.',
          content: {
            'application/json': {
              example: {
                error: {
                  code: 'missing_endpoint_id',
                  message: 'No RunPod endpoint configured for surface chat',
                },
              },
            },
          },
        },
        401: {
          description: 'Missing or invalid bearer API key.',
        },
        429: {
          description: 'Rate-limited by edge or API-key quota controls.',
        },
        502: {
          description: 'Upstream provider returned a non-success response.',
        },
        500: {
          description: 'Gateway configuration or execution error.',
        },
      },
    }),
    validator('json', chatPayloadValidator),
    async (c) => {
      const payload = c.req.valid('json') as Record<string, unknown>
      const model = typeof payload.model === 'string' ? payload.model : null

      return enqueueOpenAiCompatible({
        c,
        surface: 'chat',
        payload,
        modelSlug: model,
        objectName: 'chat.completion.enqueue',
        cacheTtlSeconds: 10,
      })
    },
  )
}
