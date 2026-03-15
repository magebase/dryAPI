import { describeRoute, validator } from 'hono-openapi'
import type { Hono } from 'hono'
import { Type } from 'typebox'

import { enqueueOpenAiCompatible } from './openai-enqueue'
import { ModelSlugSchema } from './schemas'
import { toStandardTypeboxSchema } from '../../lib/typebox-standard'
import type { WorkerEnv } from '../../types'

const TranscriptionPayloadSchema = Type.Object({
  model: Type.Optional(ModelSlugSchema),
  audioUrl: Type.String({
    format: 'uri',
    description: 'Publicly accessible audio URL to transcribe.',
    examples: ['https://cdn.example.com/audio/customer-call-2026-03-15.mp3'],
  }),
  language: Type.Optional(Type.String({
    minLength: 2,
    description: 'Optional BCP-47 language hint, such as `en` or `es`.',
    examples: ['en'],
  })),
  prompt: Type.Optional(Type.String({
    minLength: 1,
    description: 'Optional prompt to bias transcription output.',
    examples: ['The call discusses GPU usage billing and webhook retries.'],
  })),
  response_format: Type.Optional(Type.Union([
    Type.Literal('json'),
    Type.Literal('text'),
    Type.Literal('srt'),
    Type.Literal('verbose_json'),
    Type.Literal('vtt'),
  ], {
    description: 'Preferred output format when provider supports custom transcript renderers.',
    examples: ['verbose_json'],
  })),
  webhook_url: Type.Optional(Type.String({
    format: 'uri',
    description: 'Optional HTTPS webhook URL for async status updates.',
    examples: ['https://example.com/webhooks/dryapi/transcribe'],
  })),
}, { additionalProperties: true })

const transcriptionPayloadValidator = toStandardTypeboxSchema(TranscriptionPayloadSchema)

export function registerAudioTranscriptionsRoute(app: Hono<WorkerEnv>) {
  app.post(
    '/v1/audio/transcriptions',
    describeRoute({
      tags: ['OpenAI-Compatible'],
      operationId: 'createAudioTranscription',
      summary: 'Queue an audio transcription request',
      description:
        'Submits an async transcription job using the configured provider endpoint. Returns quickly with queue metadata and provider job state.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: TranscriptionPayloadSchema,
            examples: {
              englishTranscript: {
                summary: 'English transcript',
                value: {
                  model: 'WhisperLargeV3',
                  audioUrl: 'https://cdn.example.com/audio/product-demo.mp3',
                  language: 'en',
                  response_format: 'verbose_json',
                },
              },
              webhookFlow: {
                summary: 'Callback-enabled request',
                value: {
                  model: 'WhisperX',
                  audioUrl: 'https://cdn.example.com/audio/support-call.wav',
                  webhook_url: 'https://example.com/webhooks/dryapi/transcribe',
                },
              },
            },
          },
        },
      },
      responses: {
        202: {
          description: 'Transcription request accepted and queued.',
          content: {
            'application/json': {
              example: {
                id: 'f3de27f8-61d5-4d58-aad1-a7d63f8a6e0f',
                object: 'audio.transcription.enqueue',
                created: 1773504000,
                status: 'queued',
                surface: 'transcribe',
                model: 'WhisperLargeV3',
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
    validator('json', transcriptionPayloadValidator),
    async (c) => {
      const payload = c.req.valid('json') as Record<string, unknown>
      const model = typeof payload.model === 'string' ? payload.model : null

      return enqueueOpenAiCompatible({
        c,
        surface: 'transcribe',
        payload,
        modelSlug: model,
        objectName: 'audio.transcription.enqueue',
        cacheTtlSeconds: 15,
      })
    },
  )
}
