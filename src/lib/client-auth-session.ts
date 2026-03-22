"use client"

type JsonRecord = Record<string, unknown>

export type ClientAuthSessionSnapshot = {
  user: JsonRecord | null
  session: JsonRecord | null
}

type ClientAuthSessionCacheEntry = {
  snapshot: ClientAuthSessionSnapshot
  expiresAt: number
}

const CLIENT_AUTH_SESSION_CACHE_TTL_MS = 30_000

let cachedSessionSnapshot: ClientAuthSessionCacheEntry | null = null
let pendingSessionSnapshotRequest: Promise<ClientAuthSessionSnapshot> | null = null

function parseSessionObject(value: unknown, fieldName: "user" | "session"): JsonRecord | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord
  }

  throw new Error(`Invalid get-session payload: ${fieldName} must be an object or null`)
}

function normalizeClientAuthSessionSnapshot(payload: unknown): ClientAuthSessionSnapshot {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid get-session payload: expected an object")
  }

  const record = payload as Record<string, unknown>

  return {
    user: parseSessionObject(record.user, "user"),
    session: parseSessionObject(record.session, "session"),
  }
}

async function fetchClientAuthSessionSnapshot(): Promise<ClientAuthSessionSnapshot> {
  const response = await fetch("/api/auth/get-session", {
    method: "GET",
    cache: "no-store",
    credentials: "include",
  })

  if (!response.ok) {
    throw new Error(`Failed to load auth session (${response.status})`)
  }

  const payload = await response.json().catch(() => null)
  return normalizeClientAuthSessionSnapshot(payload)
}

export async function getClientAuthSessionSnapshot(
  options: { forceRefresh?: boolean } = {},
): Promise<ClientAuthSessionSnapshot> {
  if (!options.forceRefresh) {
    if (cachedSessionSnapshot && cachedSessionSnapshot.expiresAt > Date.now()) {
      return cachedSessionSnapshot.snapshot
    }

    if (pendingSessionSnapshotRequest) {
      return pendingSessionSnapshotRequest
    }
  }

  const requestPromise = fetchClientAuthSessionSnapshot()
  if (!options.forceRefresh) {
    pendingSessionSnapshotRequest = requestPromise
  }

  try {
    const snapshot = await requestPromise
    cachedSessionSnapshot = {
      snapshot,
      expiresAt: Date.now() + CLIENT_AUTH_SESSION_CACHE_TTL_MS,
    }
    return snapshot
  } finally {
    if (pendingSessionSnapshotRequest === requestPromise) {
      pendingSessionSnapshotRequest = null
    }
  }
}

export function invalidateClientAuthSessionSnapshot(): void {
  cachedSessionSnapshot = null
  pendingSessionSnapshotRequest = null
}