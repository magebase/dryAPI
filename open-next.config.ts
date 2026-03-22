import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache"
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache"
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue"
import queueCache from "@opennextjs/cloudflare/overrides/queue/queue-cache"
import doShardedTagCache from "@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache"
import { purgeCache } from "@opennextjs/cloudflare/overrides/cache-purge/index"

export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, {
    mode: "long-lived",
    bypassTagCacheOnCacheHit: true,
  }),
  queue: queueCache(doQueue, {
    regionalCacheTtlSec: 30,
    // Do not block responses on cache queue acknowledgements.
    waitForQueueAck: false,
  }),
  tagCache: doShardedTagCache({
    baseShardSize: 12,
    regionalCache: true,
    regionalCacheTtlSec: 30,
  }),
  cachePurge: purgeCache({ type: "durableObject" }),
  enableCacheInterception: true,
})
