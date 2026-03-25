import { WorkerEntrypoint } from "cloudflare:workers"

import {
  handleCdnCgiImageRequest,
  handleImageRequest,
} from "../../.open-next/cloudflare/images.js"
import { runWithCloudflareRequestContext } from "../../.open-next/cloudflare/init.js"
import { maybeGetSkewProtectionResponse } from "../../.open-next/cloudflare/skew-protection.js"
import { handler as middlewareHandler } from "../../.open-next/middleware/handler.mjs"

export { DOQueueHandler } from "../../.open-next/.build/durable-objects/queue.js"
export { DOShardedTagCache } from "../../.open-next/.build/durable-objects/sharded-tag-cache.js"
export { BucketCachePurge } from "../../.open-next/.build/durable-objects/bucket-cache-purge.js"

class MiddlewareWorker extends WorkerEntrypoint {
  async fetch(request) {
    return runWithCloudflareRequestContext(request, this.env, this.ctx, async () => {
      const skewResponse = maybeGetSkewProtectionResponse(request)
      if (skewResponse) {
        return skewResponse
      }

      const url = new URL(request.url)

      if (url.pathname.startsWith("/cdn-cgi/image/")) {
        return handleCdnCgiImageRequest(url, this.env)
      }

      if (
        url.pathname
        === `${globalThis.__NEXT_BASE_PATH__}/_next/image${globalThis.__TRAILING_SLASH__ ? "/" : ""}`
      ) {
        return await handleImageRequest(url, request.headers, this.env)
      }

      const reqOrResp = await middlewareHandler(request, this.env, this.ctx)
      if (reqOrResp instanceof Response) {
        return reqOrResp
      }

      const serverVersionId = String(this.env.WORKER_VERSION_ID ?? "").trim()
      if (!serverVersionId) {
        throw new Error("WORKER_VERSION_ID is required for multi-worker version affinity")
      }

      reqOrResp.headers.set(
        "Cloudflare-Workers-Version-Overrides",
        `server=\"${serverVersionId}\"`,
      )

      return this.env.DEFAULT_WORKER.fetch(reqOrResp, {
        redirect: "manual",
        cf: {
          cacheEverything: false,
        },
      })
    })
  }
}

export default MiddlewareWorker
