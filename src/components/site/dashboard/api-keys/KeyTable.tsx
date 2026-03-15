"use client"

import React, { useEffect, useState } from "react"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { KeyRound } from "lucide-react"

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
}

function formatDate(ts?: number) {
  if (!ts) return "-"
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return "-"
  }
}

export default function KeyTable() {
  const [keys, setKeys] = useState<KeyItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  async function loadKeys() {
    setLoading(true)
    try {
      const res = await fetch("/api/dashboard/api-keys")
      const payload = await res.json()
      const data = payload?.data ?? []
      setKeys(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadKeys()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <KeyRound className="size-4" /> API Keys
        </h3>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreate(true)}>Create key</Button>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-3 shadow-sm dark:bg-zinc-900">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prefix</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5}>Loading…</TableCell>
              </TableRow>
            ) : keys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>No keys found</TableCell>
              </TableRow>
            ) : (
              keys.map((k) => (
                <TableRow key={k.keyId}>
                  <TableCell>{k.start ? `${k.start}••••` : "-"}</TableCell>
                  <TableCell>{k.name ?? "-"}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{(k.permissions || []).join(", ") || (k.roles || []).join(", ") || "-"}</TableCell>
                  <TableCell>{formatDate(k.createdAt)}</TableCell>
                  <TableCell>
                    <KeyRowActions keyId={k.keyId} onDone={loadKeys} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateKeyDrawer open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadKeys(); }} />
    </div>
  )
}
