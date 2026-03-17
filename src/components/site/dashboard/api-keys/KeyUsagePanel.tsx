"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

type Props = {
  keyId: string
}

export default function KeyUsagePanel({ keyId }: Props) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/dashboard/api-keys/${encodeURIComponent(keyId)}/usage`)

        if (!res.ok) {
          throw new Error(`Failed to load key usage (${res.status})`)
        }

        const json = await res.json()
        if (!mounted) return
        setData(json?.data?.[0] ?? json?.data ?? null)
        setLoadError(null)
      } catch (err) {
        console.error(err)
        if (mounted) {
          setLoadError("Unable to load usage details.")
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [keyId, reloadToken])

  if (loading) {
    return (
      <div className="space-y-2 text-sm" aria-busy="true">
        <div className="flex items-center gap-2">
          <strong>Last used:</strong>
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="flex items-center gap-2">
          <strong>Requests (24h):</strong>
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-red-600 dark:text-red-300">{loadError}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => setReloadToken((value) => value + 1)}>
          Retry
        </Button>
      </div>
    )
  }

  if (!data) return <div>No usage data</div>

  const rawLast = data["last_used"]
  const lastUsed = typeof rawLast === "number" ? new Date(rawLast).toLocaleString() : typeof rawLast === "string" ? rawLast : "-"
  const total24 = (typeof data["total_24h"] === "number" ? data["total_24h"] : (typeof data["total"] === "number" ? data["total"] : 0))

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2"><strong>Last used:</strong> {lastUsed}</div>
      <div className="flex items-center gap-2"><strong>Requests (24h):</strong> {total24}</div>
    </div>
  )
}
