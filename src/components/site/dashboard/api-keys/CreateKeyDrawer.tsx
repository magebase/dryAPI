"use client"
/* eslint-disable react/no-children-prop */

/*
 UI Guidelines — Modals vs Drawers

 - NEVER use native JavaScript dialogs (`alert`, `confirm`, `prompt`).
   They are blocking, inconsistent across browsers, and fail accessibility
   and styling expectations. Always implement confirmations and critical
   notices using the project's ShadCN `Dialog`/modal components.

 - When to use a Modal (`Dialog`):
   - Critical, interrupting actions that require explicit user confirmation
     (destructive actions, acceptance of terms, displaying one-time secrets).
   - Short, focused forms or flows that must complete before proceeding.
   - Showing sensitive values that should be copied and stored by the user
     (for example: created API keys shown once).
   - Any UX that must trap focus and present a clear primary CTA.

 - When to use a Drawer / Side Panel:
   - Longer or multi-field forms that are contextual to the current page
     (editing settings, extended create/edit flows).
   - Non-blocking workflows where the user may need to reference the
     underlying page while editing.
   - Panels that can remain open while users interact with surrounding UI.

 - Accessibility & implementation notes:
   - Ensure focus is trapped inside the modal/drawer while open and is
     returned to the triggering element when closed.
   - Provide clear primary/secondary CTAs, visible labels, and explicit
     loading/disabled states for async actions.
   - Use `toast` for non-blocking notifications; use `Dialog` for
     confirmations and sensitive or one-time displays.
   - Replace existing `alert`/`confirm`/`prompt` usage with `Dialog` flows.

 Rationale: using the ShadCN components preserves visual consistency,
 accessibility, keyboard focus management, and predictable behavior across
 the app.
*/

import React, { useState } from "react"
import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import ApiKeyCopyIconButton from "./ApiKeyCopyIconButton"

type Props = {
  open: boolean
  onClose(): void
  onCreated?(): void
}

type PermissionPreset = "all" | "read-only" | "models:infer" | "billing:read" | "custom"
type ExpirationPreset = "never" | "7d" | "30d" | "90d"

type CreatedKeyState = {
  secret: string
}

const permissionPresets = ["all", "read-only", "models:infer", "billing:read", "custom"] as const
const expirationPresets = ["never", "7d", "30d", "90d"] as const

const createKeySchema = z
  .object({
    name: z.string().trim(),
    environment: z.enum(["production", "staging", "local", "ci"]),
    permissionPreset: z.enum(permissionPresets),
    customPermissions: z.string().trim(),
    expirationPreset: z.enum(expirationPresets),
  })
  .superRefine((values, ctx) => {
    if (values.permissionPreset === "custom") {
      const permissions = parseCustomCsv(values.customPermissions)
      if (permissions.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["customPermissions"],
          message: "Add at least one custom permission or choose a preset.",
        })
      }
    }
  })

type CreateKeyFormValues = z.infer<typeof createKeySchema>

const INITIAL_VALUES: CreateKeyFormValues = {
  name: "",
  environment: "production",
  permissionPreset: "all",
  customPermissions: "",
  expirationPreset: "never",
}

function parseCustomCsv(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
}

function getExpiresAt(preset: ExpirationPreset) {
  if (preset === "never") return undefined
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90
  return Date.now() + days * 24 * 60 * 60 * 1000
}

function getPermissions(preset: PermissionPreset, customPermissions: string) {
  if (preset === "custom") {
    return parseCustomCsv(customPermissions)
  }

  if (preset === "all") return ["all"]
  return [preset]
}

export default function CreateKeyDrawer({ open, onClose, onCreated }: Props) {
  const [createdKey, setCreatedKey] = useState<CreatedKeyState | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  const createKeyMutation = useMutation({
    mutationFn: async (values: CreateKeyFormValues) => {
      const permissions = getPermissions(values.permissionPreset, values.customPermissions)

      const response = await fetch("/api/dashboard/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name || undefined,
          permissions,
          expires: getExpiresAt(values.expirationPreset),
          meta: {
            environment: values.environment,
          },
        }),
      })

      const json = (await response.json().catch(() => null)) as { data?: { key?: string; start?: string }; message?: string } | null
      const keyStr = typeof json?.data?.key === "string" ? json.data.key : null

      if (!response.ok || !keyStr) {
        throw new Error(json?.message || "Failed to create key. Please try again.")
      }

      return {
        secret: keyStr,
      }
    },
    onSuccess: (key) => {
      setCreatedKey(key)
      setCreateError(null)
    },
    onError: (mutationError) => {
      setCreatedKey(null)
      setCreateError(mutationError instanceof Error ? mutationError.message : "Error creating key. Please try again.")
    },
  })

  const form = useForm({
    defaultValues: INITIAL_VALUES,
    validators: {
      onSubmit: createKeySchema,
    },
    onSubmit: async ({ value }) => {
      setCreatedKey(null)
      setCreateError(null)
      await createKeyMutation.mutateAsync(value)
    },
  })

  const isBusy = createKeyMutation.isPending || form.state.isSubmitting

  function resetForm() {
    form.reset(INITIAL_VALUES)
    setCreatedKey(null)
    setCreateError(null)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose()
      }}
    >
      <DialogContent className="sm:max-w-xl" showCloseButton={!isBusy}>
        <DialogHeader>
          <DialogTitle>{createdKey ? "Save your secret key" : "Create API key"}</DialogTitle>
          <DialogDescription className="text-sm">
            {createdKey
              ? "This secret will only be shown once. If you lose it, you'll need to rotate the key."
              : "Create a scoped API key for a specific environment and service."}
          </DialogDescription>
        </DialogHeader>

        {createdKey ? (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Secret key</p>
              <div className="flex items-center gap-2">
                <Input readOnly type="password" value={createdKey.secret} className="font-mono text-sm" />
                <ApiKeyCopyIconButton
                  value={createdKey.secret}
                  label="Copy new API key"
                  variant="outline"
                  size="icon-sm"
                  onCopyError={() => {
                    toast.error("Failed to copy API key.")
                  }}
                />
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground italic leading-relaxed">
                Copy it now. For security, we never store full keys and cannot show them again.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => {
                  onCreated?.()
                  handleClose()
                }}
              >
                I've copied the key
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="space-y-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
          >
            <form.Field
              name="name"
              children={(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Name</Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Production Server"
                  />
                </div>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field
                name="environment"
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Environment</Label>
                    <NativeSelect
                      id={field.name}
                      className="w-full"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value as CreateKeyFormValues["environment"])}
                    >
                      <NativeSelectOption value="production">Production</NativeSelectOption>
                      <NativeSelectOption value="staging">Staging</NativeSelectOption>
                      <NativeSelectOption value="local">Local</NativeSelectOption>
                      <NativeSelectOption value="ci">CI/CD</NativeSelectOption>
                    </NativeSelect>
                  </div>
                )}
              />

              <form.Field
                name="expirationPreset"
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Expiration</Label>
                    <NativeSelect
                      id={field.name}
                      className="w-full"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value as CreateKeyFormValues["expirationPreset"])}
                    >
                      <NativeSelectOption value="never">Never</NativeSelectOption>
                      <NativeSelectOption value="7d">7 days</NativeSelectOption>
                      <NativeSelectOption value="30d">30 days</NativeSelectOption>
                      <NativeSelectOption value="90d">90 days</NativeSelectOption>
                    </NativeSelect>
                  </div>
                )}
              />
            </div>

            <form.Field
              name="permissionPreset"
              children={(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Permissions</Label>
                  <NativeSelect
                    id={field.name}
                    className="w-full"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value as CreateKeyFormValues["permissionPreset"])}
                  >
                    <NativeSelectOption value="all">All</NativeSelectOption>
                    <NativeSelectOption value="read-only">Read-only</NativeSelectOption>
                    <NativeSelectOption value="models:infer">models:infer</NativeSelectOption>
                    <NativeSelectOption value="billing:read">billing:read</NativeSelectOption>
                    <NativeSelectOption value="custom">Custom list</NativeSelectOption>
                  </NativeSelect>
                </div>
              )}
            />

            <form.Field
              name="customPermissions"
              children={(field) => {
                const isCustom = form.state.values.permissionPreset === "custom"
                const isInvalid = (field.state.meta.isTouched || form.state.isSubmitted) && !field.state.meta.isValid
                const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "")

                return isCustom ? (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Custom permissions</Label>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="models:infer,billing:read"
                    />
                    {isInvalid ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
                  </div>
                ) : null
              }}
            />

            {createError ? <p className="text-sm text-red-600 dark:text-red-300">{createError}</p> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isBusy}>
                Cancel
              </Button>
              <Button type="submit" disabled={isBusy}>
                {isBusy ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
