"use client"

import React, { useState } from "react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Props = {
  open: boolean
  onClose(): void
  onCreated?(): void
}

export default function CreateKeyDrawer({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("")
  const [prefix, setPrefix] = useState("")
  const [permissions, setPermissions] = useState("")
  const [roles, setRoles] = useState("")
  const [creating, setCreating] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault()
    setCreating(true)
    setCreatedKey(null)
    try {
      const body = {
        name: name || undefined,
        prefix: prefix || undefined,
        permissions: permissions ? permissions.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        roles: roles ? roles.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      }

      const res = await fetch("/api/dashboard/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const json = await res.json()
      const keyStr = json?.data?.key
      if (keyStr) {
        setCreatedKey(keyStr)
        onCreated?.()
      } else {
        setCreatedKey(null)
        console.error("create key failed", json)
        alert("Failed to create key")
      }
    } catch (err) {
      console.error(err)
      alert("Error creating key")
    } finally {
      setCreating(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={(val) => { if (!val) onClose() }}>
      <DrawerContent direction="right">
        <div className="flex h-full flex-col">
          <DrawerHeader>
            <DrawerTitle>Create API Key</DrawerTitle>
            <DrawerDescription>Generate a new API key with scoped permissions.</DrawerDescription>
          </DrawerHeader>

          <div className="p-4">
            {createdKey ? (
              <div className="space-y-3">
                <p className="font-medium">Key created — copy it now</p>
                <div className="flex items-center gap-2">
                  <Input readOnly value={createdKey} />
                  <Button onClick={() => navigator.clipboard.writeText(createdKey)}>Copy</Button>
                </div>
                <p className="text-sm text-muted-foreground">This is the only time you will see the full key.</p>
                <div className="mt-4 flex gap-2">
                  <Button variant="ghost" onClick={() => { setCreatedKey(null); onClose(); }}>Done</Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My service key" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Prefix (optional)</label>
                  <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="prod_" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Permissions (comma-separated)</label>
                  <Input value={permissions} onChange={(e) => setPermissions(e.target.value)} placeholder="embeddings.create,images.generate" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Roles (comma-separated)</label>
                  <Input value={roles} onChange={(e) => setRoles(e.target.value)} placeholder="readonly" />
                </div>

                <DrawerFooter>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={creating}>{creating ? "Creating..." : "Create key"}</Button>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                  </div>
                </DrawerFooter>
              </form>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
