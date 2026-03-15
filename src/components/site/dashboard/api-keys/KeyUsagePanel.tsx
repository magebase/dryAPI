"use client"

import React, { useEffect, useState } from "react"

type Props = {
  keyId: string
}

export default function KeyUsagePanel({ keyId }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/dashboard/api-keys/${encodeURIComponent(keyId)}/usage`)
        const json = await res.json()
        if (!mounted) return
        setData(json?.data?.[0] ?? json?.data ?? null)
      } catch (err) {
        console.error(err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [keyId])

  if (loading) return <div>Loading usage…</div>
  if (!data) return <div>No usage data</div>

  const rawLast = data["last_used"]
  const lastUsed = typeof rawLast === "number" ? new Date(rawLast).toLocaleString() : typeof rawLast === "string" ? rawLast : "-"
  const total24 = (typeof data["total_24h"] === "number" ? data["total_24h"] : (typeof data["total"] === "number" ? data["total"] : 0))

  return (
    <div className="space-y-2 text-sm">
      <div><strong>Last used:</strong> {lastUsed}</div>
      <div><strong>Requests (24h):</strong> {total24}</div>
    </div>
  )
}
