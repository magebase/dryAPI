import { Type } from 'typebox'
import type { Static } from 'typebox'

import { toStandardTypeboxSchema } from '../../lib/typebox-standard'

export const ModelSlugSchema = Type.Union([
  Type.Literal('Llama3_8B_Instruct'),
  Type.Literal('Mistral_7B_Instruct'),
  Type.Literal('Mixtral_8x7B_Instruct'),
  Type.Literal('Flux1schnell'),
  Type.Literal('Flux1dev'),
  Type.Literal('SDXL'),
  Type.Literal('JuggernautXL'),
  Type.Literal('RealVisXL'),
  Type.Literal('WhisperLargeV3'),
  Type.Literal('WhisperX'),
  Type.Literal('BGE_Large'),
  Type.Literal('E5_Large'),
  Type.Literal('GTE_Large'),
  Type.Literal('Bge_M3_FP16'),
], {
  description: 'Model slug used for endpoint routing and cost estimation.',
  examples: ['Flux1schnell', 'Llama3_8B_Instruct', 'WhisperLargeV3'],
})

export const SurfaceParamSchema = Type.Object({
  surface: Type.Union([
    Type.Literal('chat'),
    Type.Literal('images'),
    Type.Literal('embeddings'),
    Type.Literal('transcribe'),
  ], {
    description: 'Inference surface used to select the provider endpoint.',
    examples: ['chat'],
  }),
})

export const SurfaceJobParamSchema = Type.Object({
  surface: Type.Union([
    Type.Literal('chat'),
    Type.Literal('images'),
    Type.Literal('embeddings'),
    Type.Literal('transcribe'),
  ], {
    description: 'Inference surface used to select the provider endpoint.',
    examples: ['images'],
  }),
  jobId: Type.String({
    minLength: 1,
    description: 'Provider job identifier returned when a request is accepted.',
    examples: ['f3de27f8-61d5-4d58-aad1-a7d63f8a6e0f'],
  }),
})

export const EndpointQuerySchema = Type.Object({
  endpointId: Type.Optional(Type.String({
    minLength: 1,
    description: 'Optional provider endpoint override. If omitted, routing uses surface/model mapping.',
    examples: ['o6r4i5q9j8k7l6'],
  })),
})

export const JobDownloadQuerySchema = Type.Object({
  format: Type.Optional(
    Type.Union([
      Type.Literal('json'),
      Type.Literal('txt'),
    ], {
      description: 'Download file format when no direct media links are available.',
      examples: ['json'],
    }),
  ),
})

export const RunpodSubmitBodySchema = Type.Object(
  {
    endpointId: Type.Optional(Type.String({
      minLength: 1,
      description: 'Explicit RunPod endpoint ID. Overrides default endpoint mapping when provided.',
      examples: ['o6r4i5q9j8k7l6'],
    })),
    model: Type.Optional(ModelSlugSchema),
    input: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
      description: 'Provider input payload forwarded to RunPod as `input`.',
      examples: [{ prompt: 'A cinematic aerial shot of neon Tokyo in the rain.' }],
    })),
    webhook: Type.Optional(Type.String({
      format: 'uri',
      description: 'Deprecated webhook alias. Prefer `webhook_url`.',
      examples: ['https://example.com/webhooks/runpod'],
    })),
    webhook_url: Type.Optional(Type.String({
      format: 'uri',
      description: 'HTTPS URL that receives signed status updates for this job.',
      examples: ['https://example.com/webhooks/runpod'],
    })),
    policy: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
      description: 'Optional policy hints used by gateway routing and execution controls.',
      examples: [{ maxCostUsd: 0.04, maxLatencyMs: 18000 }],
    })),
    s3Config: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
      description: 'Optional object-storage output configuration for provider artifacts.',
      examples: [{ bucket: 'dryapi-output', region: 'auto' }],
    })),
  },
  { additionalProperties: true },
)

export const GenericJobParamSchema = Type.Object({
  surface: SurfaceParamSchema.properties.surface,
  jobId: Type.String({
    minLength: 1,
    description: 'Provider job identifier returned from an enqueue route.',
    examples: ['f3de27f8-61d5-4d58-aad1-a7d63f8a6e0f'],
  }),
})

export const GenericWebhookTestBodySchema = Type.Object({
  webhook_url: Type.String({
    format: 'uri',
    description: 'Destination URL that receives signed test events. HTTPS is required.',
    examples: ['https://example.com/webhooks/dryapi'],
  }),
  event: Type.Optional(
    Type.Union([
      Type.Literal('job.processing'),
      Type.Literal('job.completed'),
      Type.Literal('job.failed'),
    ], {
      description: 'Test webhook event type to send. Defaults to `job.processing`.',
      examples: ['job.completed'],
    }),
  ),
  data: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
    description: 'Optional payload object included as the webhook event data.',
    examples: [{ request_id: 'test_123', latency_ms: 4215 }],
  })),
})

export const surfaceParamValidator = toStandardTypeboxSchema(SurfaceParamSchema)
export const surfaceJobParamValidator = toStandardTypeboxSchema(SurfaceJobParamSchema)
export const endpointQueryValidator = toStandardTypeboxSchema(EndpointQuerySchema)
export const jobDownloadQueryValidator = toStandardTypeboxSchema(JobDownloadQuerySchema)
export const runpodSubmitBodyValidator = toStandardTypeboxSchema(RunpodSubmitBodySchema)
export const genericJobParamValidator = toStandardTypeboxSchema(GenericJobParamSchema)
export const webhookTestBodyValidator = toStandardTypeboxSchema(GenericWebhookTestBodySchema)

export type SurfaceParam = Static<typeof SurfaceParamSchema>
export type SurfaceJobParam = Static<typeof SurfaceJobParamSchema>
export type GenericJobParam = Static<typeof GenericJobParamSchema>
export type EndpointQuery = Static<typeof EndpointQuerySchema>
export type JobDownloadQuery = Static<typeof JobDownloadQuerySchema>
export type RunpodSubmitBody = Static<typeof RunpodSubmitBodySchema>
export type GenericWebhookTestBody = Static<typeof GenericWebhookTestBodySchema>
export type ModelSlug = Static<typeof ModelSlugSchema>
