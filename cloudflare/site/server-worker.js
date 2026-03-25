import { runWithCloudflareRequestContext } from "../../.open-next/cloudflare/init.js"
import { handler } from "../../.open-next/server-functions/default/handler.mjs"

export { DOQueueHandler } from "../../.open-next/.build/durable-objects/queue.js"
export { DOShardedTagCache } from "../../.open-next/.build/durable-objects/sharded-tag-cache.js"
export { BucketCachePurge } from "../../.open-next/.build/durable-objects/bucket-cache-purge.js"

const worker = {
  async fetch(request, env, ctx) {
    return runWithCloudflareRequestContext(request, env, ctx, async () => {
      return handler(request, env, ctx, request.signal)
    })
  },
}

export default worker
