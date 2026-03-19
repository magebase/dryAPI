"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  MoreHorizontal,
  RotateCcw,
  Ban,
  Trash2,
  Copy,
  AlertTriangle,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import ApiKeyCopyIconButton from "./ApiKeyCopyIconButton"
import { toast } from "sonner"

type Props = {
  keyId: string
  keyPrefix: string
  isDisabled?: boolean
  onDone?(): void
}

type ActionName = "rotate" | "disable" | "delete"

type RotatedKeyState = {
  secret: string
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
        body: JSON.stringify({}),
      })
      const json = await res.json().catch(() => null)
      const newKey = typeof json?.data?.key === "string" ? json.data.key : null
      if (res.ok && newKey) {
        setRotatedKey({
          secret: newKey,
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
        description: "Rotate this key and receive a new secret now? The old key will be deleted immediately.",
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            disabled={busy}
          >
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Open actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[160px]">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => {
              navigator.clipboard.writeText(keyPrefix)
              toast.success("Key prefix copied to clipboard")
            }}
          >
            <Copy className="mr-2 size-3.5" />
            Copy prefix
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => setConfirmAction("rotate")}
          >
            <RotateCcw className="mr-2 size-3.5" />
            Rotate key
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer text-orange-600 dark:text-orange-400 focus:text-orange-600 dark:focus:text-orange-400"
            disabled={isDisabled}
            onClick={() => setConfirmAction("disable")}
          >
            <Ban className="mr-2 size-3.5" />
            Disable key
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:text-destructive"
            onClick={() => setConfirmAction("delete")}
          >
            <Trash2 className="mr-2 size-3.5" />
            Delete key
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              {confirmAction === "delete" && <AlertTriangle className="size-5" />}
              {confirmCopy.title}
            </AlertDialogTitle>
            <AlertDialogDescription>{confirmCopy.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={confirmAction === "delete" ? "destructive" : "default"}
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                void handleConfirmedAction()
              }}
            >
              {busy ? "Working..." : confirmCopy.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(rotatedKey)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setRotatedKey(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Secret Key Generated</DialogTitle>
            <DialogDescription>
              The previous key is now disabled. This secret will only be shown once.
            </DialogDescription>
          </DialogHeader>
          {rotatedKey && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Secret key</p>
                <div className="flex items-center gap-2">
                  <Input readOnly type="password" value={rotatedKey.secret} className="font-mono text-sm" />
                  <ApiKeyCopyIconButton
                    value={rotatedKey.secret}
                    label="Copy new API key"
                    variant="outline"
                    size="icon-sm"
                    onCopyError={() => {
                      toast.error("Failed to copy API key.")
                    }}
                  />
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground italic">You will not be able to view this token again.</p>
              </div>
              <DialogFooter>
                <Button type="button" onClick={() => setRotatedKey(null)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              This is the only time you'll be able to view this key. Please copy it now. The old key remains valid for 24 hours, then it is revoked.
            </DialogDescription>
          </DialogHeader>

          {rotatedKey ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="rotated-api-key">Secret key</Label>
                <div className="flex items-center gap-2">
                  <Input id="rotated-api-key" disabled type="password" value={rotatedKey.secret} />
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
              </div>
              <p className="text-xs text-muted-foreground">Copy it now. You will not be able to view the secret again.</p>
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
