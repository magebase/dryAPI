"use client"

import React, { useCallback, useEffect, useState } from "react"
import { KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import CreateKeyDrawer from "./CreateKeyDrawer"
import KeyRowActions from "./KeyRowActions"

type KeyItem = {
  keyId: string
  start?: string
  name?: string
  createdAt?: number
  updatedAt?: number
  permissions?: string[]
  roles?: string[]
  enabled?: boolean
  expires?: number
  meta?: {
    environment?: string
    [key: string]: unknown
  }
}

type KeyTableProps = {
  initialKeys?: KeyItem[]
}

type UsageSummary = {
  lastUsed: string
  usage24h: string
}

async function parseJsonSafely(response: Response): Promise<Record<string, unknown> | null> {
  const bodyText = await response.text().catch(() => "")
  if (!bodyText) return null

  try {
    return JSON.parse(bodyText) as Record<string, unknown>
  } catch {
    return null
  }
}

function formatRelativeTime(input: unknown) {
  if (!input) return "Never"

  let date: Date | null = null
  if (typeof input === "number") {
    const maybeMs = input < 1_000_000_000_000 ? input * 1000 : input
    date = new Date(maybeMs)
  } else if (typeof input === "string") {
    const parsed = new Date(input)
    if (!Number.isNaN(parsed.getTime())) date = parsed
  }

  if (!date || Number.isNaN(date.getTime())) return "Never"

  const diffMs = date.getTime() - Date.now()
  const absMs = Math.abs(diffMs)
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

  if (absMs < 60_000) return "just now"
  if (absMs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), "minute")
  if (absMs < 86_400_000) return rtf.format(Math.round(diffMs / 3_600_000), "hour")
  if (absMs < 2_592_000_000) return rtf.format(Math.round(diffMs / 86_400_000), "day")
  return rtf.format(Math.round(diffMs / 2_592_000_000), "month")
}

function getEnvironmentLabel(key: KeyItem) {
  const fromMeta = typeof key.meta?.environment === "string" ? key.meta.environment : ""
  const normalizedMeta = fromMeta.trim().toLowerCase()
  if (normalizedMeta === "production") return "Production"
  if (normalizedMeta === "staging") return "Staging"
  if (normalizedMeta === "local") return "Local"
  if (normalizedMeta === "ci") return "CI/CD"

  const hint = `${key.name ?? ""} ${key.start ?? ""}`.toLowerCase()
  if (hint.includes("prod") || hint.includes("live")) return "Production"
  if (hint.includes("stag") || hint.includes("test")) return "Staging"
  if (hint.includes("local")) return "Local"
  if (hint.includes("ci") || hint.includes("cd")) return "CI/CD"
  return "-"
}

function formatPermissions(key: KeyItem) {
  const values = key.permissions?.length ? key.permissions : key.roles?.length ? key.roles : []
  if (!values.length) return "-"

  const normalized = values.map((value) => value.toLowerCase())
  if (normalized.includes("all") || normalized.includes("*")) return "all"
  return values.join(", ")
}

function areStringArraysEqual(left?: string[], right?: string[]) {
  const leftValues = left ?? []
  const rightValues = right ?? []

  if (leftValues.length !== rightValues.length) return false
  return leftValues.every((value, index) => value === rightValues[index])
}

function areKeyItemsEqual(previous: KeyItem[], next: KeyItem[]) {
  if (previous.length !== next.length) return false

  return previous.every((previousItem, index) => {
    const nextItem = next[index]
    if (!nextItem) return false

    return (
      previousItem.keyId === nextItem.keyId &&
      previousItem.start === nextItem.start &&
      previousItem.name === nextItem.name &&
      previousItem.createdAt === nextItem.createdAt &&
      previousItem.updatedAt === nextItem.updatedAt &&
      previousItem.enabled === nextItem.enabled &&
      previousItem.expires === nextItem.expires &&
      previousItem.meta?.environment === nextItem.meta?.environment &&
      areStringArraysEqual(previousItem.permissions, nextItem.permissions) &&
      areStringArraysEqual(previousItem.roles, nextItem.roles)
    )
  })
}

function getStatus(key: KeyItem) {
  if (key.enabled === false) return "Disabled"
  if (typeof key.expires === "number" && key.expires <= Date.now()) return "Expired"
  return "Active"
}

export default function KeyTable({ initialKeys }: KeyTableProps) {
  const hasInitialKeys = Array.isArray(initialKeys)
  const [keys, setKeys] = useState<KeyItem[]>(initialKeys ?? [])
  const [loading, setLoading] = useState(!hasInitialKeys)
  const [usageByKey, setUsageByKey] = useState<Record<string, UsageSummary>>({})
  const [usageLoading, setUsageLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const loadKeys = useCallback(async (options?: { background?: boolean }) => {
    if (!options?.background) {
      setLoading(true)
    }

    try {
      const res = await fetch("/api/dashboard/api-keys")
      const payload = await parseJsonSafely(res)

      if (!res.ok) {
        if (res.status === 401) {
          setLoadError("Please sign in to manage API keys.")
          setKeys([])
          return
        }
        throw new Error(`Failed to load keys (${res.status})`)
      }

      const rawData = payload?.data
      const data = Array.isArray(rawData) ? (rawData as KeyItem[]) : []
      setKeys((previous) => (areKeyItemsEqual(previous, data) ? previous : data))
      setLoadError(null)
    } catch (err) {
      console.error(err)
      setLoadError("Unable to load API keys.")
    } finally {
      if (!options?.background) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadKeys({ background: hasInitialKeys })
  }, [hasInitialKeys, loadKeys])

  useEffect(() => {
    let cancelled = false

    async function loadUsage() {
      if (keys.length === 0) {
        setUsageByKey((previous) => (Object.keys(previous).length === 0 ? previous : {}))
        return
      }

      setUsageLoading(true)
      try {
        const summaryEntries = await Promise.all(
          keys.map(async (key) => {
            try {
              const res = await fetch(`/api/dashboard/api-keys/${encodeURIComponent(key.keyId)}/usage`)
              if (!res.ok) throw new Error(`usage_${res.status}`)

              const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
              const data = (json?.data ?? null) as unknown
              const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : (data as Record<string, unknown> | null)

              const usageCost = typeof row?.cost_24h_usd === "number" ? row.cost_24h_usd : null
              const usageTotal =
                typeof row?.total_24h === "number"
                  ? row.total_24h
                  : typeof row?.total === "number"
                    ? row.total
                    : 0

              return [
                key.keyId,
                {
                  lastUsed: formatRelativeTime(row?.last_used ?? row?.lastUsed ?? null),
                  usage24h: usageCost !== null ? `$${usageCost.toFixed(2)}` : `${Number(usageTotal).toLocaleString()} req`,
                },
              ] as const
            } catch {
              return [
                key.keyId,
                {
                  lastUsed: "Never",
                  usage24h: "-",
                },
              ] as const
            }
          }),
        )

        if (!cancelled) {
          setUsageByKey(Object.fromEntries(summaryEntries))
        }
      } finally {
        if (!cancelled) {
          setUsageLoading(false)
        }
      }
    }

    void loadUsage()
    return () => {
      cancelled = true
    }
  }, [keys])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <KeyRound className="size-4" /> API Keys
        </h3>
        <Button onClick={() => setShowCreate(true)} size="sm">
          + Create API Key
        </Button>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <Table aria-busy={loading}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[180px]">Name</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead className="w-[120px]">Last Used</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }, (_, index) => (
                <TableRow key={`api-key-skeleton-${index}`} aria-hidden="true">
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40 max-w-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="ml-auto h-8 w-8 rounded-full" /></TableCell>
                </TableRow>
              ))
            ) : loadError ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p className="text-sm text-destructive">{loadError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void loadKeys()
                      }}
                    >
                      Retry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : keys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  No API keys found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              keys.map((key) => {
                const status = getStatus(key)
                const usage = usageByKey[key.keyId]

                return (
                  <TableRow key={key.keyId} className="group">
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-sm leading-none">{key.name || "Unnamed key"}</span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                          {getEnvironmentLabel(key)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {formatPermissions(key)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {usageLoading && !usage ? (
                          <Skeleton className="h-3 w-16" />
                        ) : (
                          usage?.lastUsed || "Never"
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      {status === "Active" ? (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold uppercase tracking-tight bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                          Active
                        </Badge>
                      ) : status === "Expired" ? (
                        <Badge variant="destructive" className="h-5 px-1.5 text-[10px] font-bold uppercase tracking-tight">
                          Expired
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
                          Disabled
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <KeyRowActions
                        keyId={key.keyId}
                        keyPrefix={key.start ?? key.keyId}
                        isDisabled={key.enabled === false}
                        onDone={() => {
                          void loadKeys({ background: true })
                        }}
                      />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CreateKeyDrawer
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          void loadKeys({ background: true })
        }}
      />
    </div>
  )
}
