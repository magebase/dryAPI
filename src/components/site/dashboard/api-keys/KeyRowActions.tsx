"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"

type Props = {
  keyId: string
  onDone?(): void
}

export default function KeyRowActions({ keyId, onDone }: Props) {
  const [busy, setBusy] = useState(false)

  async function handleRotate() {
    if (!confirm("Rotate this key and receive a new secret now?")) return
    setBusy(true)
    try {
      const res = await fetch(`/api/dashboard/api-keys/${encodeURIComponent(keyId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiration: 0 }),
      })
      const json = await res.json()
      const newKey = json?.data?.key
      if (newKey) {
        try { await navigator.clipboard.writeText(newKey) } catch {}
        alert("Key rotated. New key copied to clipboard.\nThis is the only time you'll see it.")
        onDone?.()
      } else {
        alert("Failed to rotate key")
        console.error(json)
      }
    } catch (err) {
      console.error(err)
      alert("Error rotating key")
    } finally {
      setBusy(false)
    }
  }

  async function handleRevoke() {
    if (!confirm("Revoke this key? This will immediately disable it.")) return
    setBusy(true)
    try {
      const res = await fetch(`/api/dashboard/api-keys/${encodeURIComponent(keyId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permanent: false }),
      })
      if (res.ok) {
        alert("Key revoked")
        onDone?.()
      } else {
        const json = await res.json().catch(() => null)
        console.error(json)
        alert("Failed to revoke key")
      }
    } catch (err) {
      console.error(err)
      alert("Error revoking key")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="ghost" onClick={handleRotate} disabled={busy}>Rotate</Button>
      <Button size="sm" variant="destructive" onClick={handleRevoke} disabled={busy}>Revoke</Button>
    </div>
  )
}
