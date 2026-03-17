import type { Hono } from 'hono'

import type { WorkerEnv } from '../../types'
import { registerAudioTranscriptionsRoute } from './audio-transcriptions'
import { registerChatCompletionsRoute } from './chat-completions'
import { registerClientBalanceRoute } from './client-balance'
import { registerEmbeddingsRoute } from './embeddings'
import { registerImageGenerationsRoute } from './images-generations'
import { registerJobsDownloadRoute } from './jobs-download'
import { registerJobsStatusRoute } from './jobs-status'
import { registerJobsWebSocketRoute } from './jobs-websocket'
import { registerPricingSnapshotsRoute } from './pricing-snapshots'
import { registerQueueBatchScalingRoute } from './queue-batch-scaling'
import { registerRunpodCancelRoute } from './runpod-cancel'
import { registerRunpodHealthRoute } from './runpod-health'
import { registerRunpodPurgeQueueRoute } from './runpod-purge-queue'
import { registerRunpodRetryRoute } from './runpod-retry'
import { registerRunpodRunRoute } from './runpod-run'
import { registerRunpodRunSyncRoute } from './runpod-runsync'
import { registerRunpodStatusRoute } from './runpod-status'
import { registerRunpodStreamRoute } from './runpod-stream'
import { registerWebhookTestRoute } from './webhooks-test'

export function registerV1Routes(app: Hono<WorkerEnv>) {
  registerChatCompletionsRoute(app)
  registerClientBalanceRoute(app)
  registerImageGenerationsRoute(app)
  registerAudioTranscriptionsRoute(app)
  registerEmbeddingsRoute(app)
  registerJobsStatusRoute(app)
  registerJobsDownloadRoute(app)
  registerJobsWebSocketRoute(app)
  registerPricingSnapshotsRoute(app)
  registerQueueBatchScalingRoute(app)
  registerWebhookTestRoute(app)

  // Internal provider routes retained for operational control.
  registerRunpodRunRoute(app)
  registerRunpodRunSyncRoute(app)
  registerRunpodStatusRoute(app)
  registerRunpodStreamRoute(app)
  registerRunpodCancelRoute(app)
  registerRunpodRetryRoute(app)
  registerRunpodPurgeQueueRoute(app)
  registerRunpodHealthRoute(app)
}
