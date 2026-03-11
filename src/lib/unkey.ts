import "server-only"

import { Unkey } from "@unkey/api"

import { env } from "@/env/server"

let cachedClient: Unkey | null = null

export function getUnkeyClient() {
  const rootKey = env.UNKEY_ROOT_KEY?.trim()

  if (!rootKey) {
    return null
  }

  if (!cachedClient) {
    cachedClient = new Unkey({ rootKey })
  }

  return cachedClient
}
