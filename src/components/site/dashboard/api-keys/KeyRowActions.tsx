"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import ApiKeyCopyIconButton from "./ApiKeyCopyIconButton"

type Props = {
  keyId: string
  keyPrefix: string
  isDisabled?: boolean
  onDone?(): void
}

type ActionName = "rotate" | "disable" | "delete"

type RotatedKeyState = {
  secret: string
  start: string
}

function formatKeyPrefix(start?: string) {
  if (!start) return "-"
  if (start.length <= 8) return `${start}****`
  return `${start}****${start.slice(-4)}`
}

function resolveStartFromSecret(secret: string) {
  return secret.slice(0, 16)
}

export default function KeyRowActions({ keyId, keyPrefix, isDisabled, onDone }: Props) {
  const [busyAction, setBusyAction] = useState<ActionName | null>(null)
  const [confirmAction, setConfirmAction] = useState<ActionName | null>(null)
  const [rotatedKey, setRotatedKey] = useState<RotatedKeyState | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const busy = busyAction !== null

  async function rotateKey() {
    setBusyAction("rotate")
    try {
      const res = await fetch(`/api/dashboard/api-keys/${encodeURIComponent(keyId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Keep previous key valid for 24h to support safe cutover.
        body: JSON.stringify({ expiration: 24 * 60 * 60 * 1000 }),
      })
      const json = await res.json().catch(() => null)
      const newKey = typeof json?.data?.key === "string" ? json.data.key : null
      const newStart = typeof json?.data?.start === "string" ? json.data.start : null
      if (res.ok && newKey) {
        setRotatedKey({
          secret: newKey,
          start: newStart ?? resolveStartFromSecret(newKey),
        })
        onDone?.()
      } else {
        console.error(json)
        setErrorMessage("Failed to rotate key. Please try again.")
      }
    } catch (err) {
      console.error(err)
      setErrorMessage("Error rotating key. Please try again.")
    } finally {
      setBusyAction(null)
    }
  }

  async function disableKey() {
    setBusyAction("disable")

    try {
      const res = await fetch(`/api/dashboard/api-keys/${encodeURIComponent(keyId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      })

      if (res.ok) {
        onDone?.()
      } else {
        const json = await res.json().catch(() => null)
        console.error(json)
        setErrorMessage("Failed to disable key. Please try again.")
      }
    } catch (err) {
      console.error(err)
      setErrorMessage("Error disabling key. Please try again.")
    } finally {
      setBusyAction(null)
    }
  }

  async function deleteKey() {
    setBusyAction("delete")

    try {
      const res = await fetch(`/api/dashboard/api-keys/${encodeURIComponent(keyId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permanent: true }),
      })

      if (res.ok) {
        onDone?.()
      } else {
        const json = await res.json().catch(() => null)
        console.error(json)
        setErrorMessage("Failed to delete key. Please try again.")
      }
    } catch (err) {
      console.error(err)
      setErrorMessage("Error deleting key. Please try again.")
    } finally {
      setBusyAction(null)
    }
  }

  async function handleConfirmedAction() {
    const action = confirmAction
    if (!action) return

    setConfirmAction(null)

    if (action === "rotate") {
      await rotateKey()
      return
    }

    if (action === "disable") {
      await disableKey()
      return
    }

    await deleteKey()
  }

  function getConfirmCopy(action: ActionName | null) {
    if (action === "rotate") {
      return {
        title: "Rotate key?",
        description: "Rotate this key and receive a new secret now?",
        actionLabel: "Rotate",
      }
    }

    if (action === "disable") {
      return {
        title: "Disable key?",
        description: "Disable this key? Requests with this key will stop immediately.",
        actionLabel: "Disable",
      }
    }

    return {
      title: "Delete key permanently?",
      description: "This action cannot be undone.",
      actionLabel: "Delete",
    }
  }

  const confirmCopy = getConfirmCopy(confirmAction)

  return (
    <>
      <div className="flex items-center gap-1">
        <ApiKeyCopyIconButton
          value={keyPrefix}
          label="Copy key prefix"
          disabled={busy}
          variant="ghost"
          size="icon-sm"
          onCopyError={() => {
            setErrorMessage("Unable to copy key prefix. Please try again.")
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setConfirmAction("rotate")}
          disabled={busy}
        >
          Rotate
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setConfirmAction("disable")}
          disabled={busy || isDisabled}
        >
          Disable
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={() => setConfirmAction("delete")}
          disabled={busy}
        >
          Delete
        </Button>
      </div>

      <AlertDialog
        open={Boolean(confirmAction)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !busy) {
            setConfirmAction(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmCopy.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmCopy.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={confirmAction === "delete" ? "destructive" : "default"}
              disabled={busy}
              onClick={() => {
                void handleConfirmedAction()
              }}
            >
              {busy ? "Working..." : confirmCopy.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(errorMessage)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setErrorMessage(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Action failed</DialogTitle>
            <DialogDescription>{errorMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setErrorMessage(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rotatedKey)} onOpenChange={(nextOpen) => !nextOpen && setRotatedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotated API Key</DialogTitle>
            <DialogDescription>
              A new key was issued. Only the prefix is shown here. The old key remains valid for 24 hours, then it is revoked.
            </DialogDescription>
          </DialogHeader>

          {rotatedKey ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input readOnly value={formatKeyPrefix(rotatedKey.start)} />
                <ApiKeyCopyIconButton
                  value={rotatedKey.secret}
                  label="Copy rotated API key"
                  variant="outline"
                  size="icon-sm"
                  onCopyError={() => {
                    setErrorMessage("Unable to copy rotated key. Please try again.")
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">This secret is shown once.</p>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" onClick={() => setRotatedKey(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
