"use client"
/* eslint-disable react/no-children-prop */

import { useEffect, useState } from "react"
import { useForm, useStore } from "@tanstack/react-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, CircleAlert, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { updateDashboardSettingsAction, validateDashboardWebhookAction } from "@/app/actions/dashboard-settings-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DASHBOARD_SETTINGS_DEFAULTS,
  dashboardWebhookEntrySchema,
  dashboardWebhooksSettingsFormSchema,
  type DashboardWebhookEntry,
  type DashboardWebhooksSettingsFormValues,
} from "@/lib/dashboard-settings-schema"

type WebhooksSettingsFormProps = {
  initialValues?: DashboardWebhooksSettingsFormValues
}

type WebhookValidationState = "unknown" | "checking" | "healthy" | "unhealthy"

type WebhookHealth = DashboardWebhookEntry["health"]

const DEFAULT_WEBHOOK_HEALTH: WebhookHealth = {
  validationStatus: "unknown",
  validationMessage: "",
  lastValidatedAt: null,
  lastStatusCode: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  consecutiveFailures: 0,
  alertCount: 0,
  lastAlertAt: null,
}

function randomSecret(): string {
  const bytes = new Uint8Array(18)
  window.crypto.getRandomValues(bytes)
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  return `whsec_${token}`
}

function createWebhookDraft(): DashboardWebhookEntry {
  return {
    id: window.crypto.randomUUID(),
    name: "",
    endpointUrl: "",
    signingSecret: randomSecret(),
    sendOnCompleted: true,
    sendOnFailed: true,
    sendOnQueued: false,
    includeFullPayload: false,
    health: { ...DEFAULT_WEBHOOK_HEALTH },
  }
}

function formatFieldError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim()
  }

  return ""
}

function normalizeValidationState(health: WebhookHealth): WebhookValidationState {
  if (health.validationStatus === "healthy" || health.validationStatus === "unhealthy" || health.validationStatus === "checking") {
    return health.validationStatus
  }

  return "unknown"
}

function isValidWebhookEndpointUrl(value: string): boolean {
  return dashboardWebhookEntrySchema.shape.endpointUrl.safeParse(value).success
}

function formatCheckedAt(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Never"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "Never"
  }

  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`
}

function statusBadgeClass(state: WebhookValidationState): string {
  switch (state) {
    case "healthy":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
    case "checking":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300"
    case "unhealthy":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300"
  }
}

async function loadWebhookSettings(): Promise<DashboardWebhooksSettingsFormValues> {
  const response = await fetch("/api/dashboard/settings", {
    cache: "no-store",
    credentials: "include",
  })

  if (!response.ok) {
    throw new Error("Unable to load webhook settings.")
  }

  const payload = (await response.json().catch(() => null)) as {
    data?: { webhooks?: DashboardWebhooksSettingsFormValues }
  } | null

  return payload?.data?.webhooks ?? DASHBOARD_SETTINGS_DEFAULTS.webhooks
}

function WebhooksSettingsFormSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[180px]">Name</TableHead>
              <TableHead>Webhook URL</TableHead>
              <TableHead className="w-[180px]">Signing secret</TableHead>
              <TableHead className="w-[160px]">Status</TableHead>
              <TableHead className="w-[88px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 2 }, (_, index) => (
              <TableRow key={`webhook-skeleton-${index}`} aria-hidden="true">
                <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-10 flex-1" />
                    <Skeleton className="h-10 w-10 rounded-md" />
                  </div>
                  <Skeleton className="mt-2 h-3 w-72 max-w-full" />
                </TableCell>
                <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-24 rounded-full" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-9 w-9 rounded-full" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 border-t border-zinc-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700/80">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  )
}

export function WebhooksSettingsForm({ initialValues }: WebhooksSettingsFormProps) {
  const queryClient = useQueryClient()
  const [endpointUrlErrors, setEndpointUrlErrors] = useState<Record<string, string>>({})
  const webhooksSettingsQuery = useQuery<DashboardWebhooksSettingsFormValues>({
    queryKey: ["dashboard-settings", "webhooks"],
    queryFn: loadWebhookSettings,
    enabled: !initialValues,
    initialData: initialValues,
    staleTime: initialValues ? Number.POSITIVE_INFINITY : 0,
  })

  const saveMutation = useMutation({
    mutationFn: async (values: DashboardWebhooksSettingsFormValues) => {
      const bundle = await updateDashboardSettingsAction({
        section: "webhooks",
        values,
      })

      return bundle.webhooks
    },
    onSuccess: (savedValues) => {
      queryClient.setQueryData(["dashboard-settings", "webhooks"], savedValues)
      setEndpointUrlErrors({})
      toast.success("Webhook settings saved")
    },
    onError: (error) => {
      if (error instanceof Error && error.message.includes("Enter a valid webhook URL.")) {
        return
      }

      toast.error(error instanceof Error ? error.message : "Unable to save webhook settings")
    },
  })

  const validationMutation = useMutation({
    mutationFn: async (args: { index: number; webhook: DashboardWebhookEntry }) => {
      const result = await validateDashboardWebhookAction({
        webhook: args.webhook,
      })

      return {
        ...result,
        index: args.index,
      }
    },
    onSuccess: (result) => {
      form.setFieldValue(`webhooks[${result.index}]`, result.webhook)
      if (result.ok) {
        toast.success("Webhook validated", {
          description: result.message,
        })
      } else {
        toast.error("Webhook validation failed", {
          description: result.message,
        })
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to validate webhook")
    },
  })

  const initialFormValues = webhooksSettingsQuery.data ?? DASHBOARD_SETTINGS_DEFAULTS.webhooks

  const form = useForm({
    defaultValues: initialFormValues,
    validators: {
      onSubmit: dashboardWebhooksSettingsFormSchema,
    },
    onSubmit: async ({ value }) => {
      await saveMutation.mutateAsync(value)
    },
  })

  useEffect(() => {
    if (webhooksSettingsQuery.data) {
      form.reset(webhooksSettingsQuery.data)
    }
  }, [form, webhooksSettingsQuery.data])

  const webhooks = useStore(form.store, (state) => state.values.webhooks)
  const hasWebhookUrlErrors = webhooks.some((webhook) => !isValidWebhookEndpointUrl(webhook.endpointUrl))
  const canSave = webhooks.length === 0 || webhooks.every((webhook) => {
    const state = normalizeValidationState(webhook.health)
    return state === "healthy" && webhook.health.lastStatusCode === 200
  })
  const canSubmit = canSave && !hasWebhookUrlErrors
  const pendingValidationId = validationMutation.variables ? validationMutation.variables.webhook.id : null

  if (webhooksSettingsQuery.isLoading) {
    return <WebhooksSettingsFormSkeleton />
  }

  if (webhooksSettingsQuery.isError) {
    return (
      <div className="space-y-3 rounded-lg border border-red-200/80 bg-red-50/70 p-4 dark:border-red-900/40 dark:bg-red-900/20">
        <p className="text-sm text-red-700 dark:text-red-300">
          {webhooksSettingsQuery.error instanceof Error
            ? webhooksSettingsQuery.error.message
            : "Unable to load webhook settings."}
        </p>
        <Button type="button" variant="outline" onClick={() => void webhooksSettingsQuery.refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Webhook destinations</p>
          <p className="text-xs text-muted-foreground">
            Every webhook must return HTTP 200 during validation before you can save it.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            form.setFieldValue("webhooks", [...webhooks, createWebhookDraft()])
          }}
        >
          <Plus className="mr-2 size-4" />
          Add webhook
        </Button>
      </div>

      <div className="rounded-xl border border-zinc-200/80 bg-white/90 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/70">
        <Table aria-busy={validationMutation.isPending || saveMutation.isPending || form.state.isSubmitting}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[180px]">Name</TableHead>
              <TableHead>Webhook URL</TableHead>
              <TableHead className="w-[180px]">Signing secret</TableHead>
              <TableHead className="w-[160px]">Status</TableHead>
              <TableHead className="w-[88px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {webhooks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-28 text-center text-sm text-muted-foreground">
                  No webhooks configured yet. Add one to start routing job events.
                </TableCell>
              </TableRow>
            ) : (
              webhooks.map((webhook, index) => {
                const validationState = normalizeValidationState(webhook.health)
                const isValidationPending = validationMutation.isPending && pendingValidationId === webhook.id
                const statusLabel =
                  validationState === "healthy"
                    ? "Validated"
                    : validationState === "unhealthy"
                      ? "Needs attention"
                      : validationState === "checking"
                        ? "Validating"
                        : "Not validated"
                const statusDescription =
                  validationState === "healthy"
                    ? `HTTP ${webhook.health.lastStatusCode ?? 200} · ${formatCheckedAt(webhook.health.lastSuccessAt)}`
                    : validationState === "unhealthy"
                      ? `${webhook.health.validationMessage || "Last probe failed."} · ${formatCheckedAt(webhook.health.lastFailureAt)}`
                      : "Run validation to confirm the endpoint returns 200."

                return (
                  <TableRow key={webhook.id} className="align-top">
                    <TableCell className="align-top">
                      <form.Field
                        name={`webhooks[${index}].name`}
                        children={(field) => {
                          const isInvalid = (field.state.meta.isTouched || form.state.isSubmitted) && !field.state.meta.isValid
                          const errorMessage = formatFieldError(field.state.meta.errors[0])

                          return (
                            <div className="space-y-2">
                              <Label htmlFor={field.name} className="sr-only">Webhook name</Label>
                              <Input
                                id={field.name}
                                placeholder="Production events"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(event) => field.handleChange(event.target.value)}
                              />
                              {isInvalid ? <p className="text-xs text-red-600">{errorMessage}</p> : null}
                            </div>
                          )
                        }}
                      />
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <form.Field
                            name={`webhooks[${index}].endpointUrl`}
                            children={(field) => {
                              const isInvalid = (field.state.meta.isTouched || form.state.isSubmitted) && !field.state.meta.isValid
                              const localError = endpointUrlErrors[webhook.id] ?? ""
                              const errorMessage = localError || formatFieldError(field.state.meta.errors[0])
                              const showError = Boolean(errorMessage) && (isInvalid || Boolean(localError))

                              return (
                                <div className="flex-1 space-y-2">
                                  <Label htmlFor={field.name} className="sr-only">Webhook URL</Label>
                                  <Input
                                    id={field.name}
                                    type="url"
                                    value={field.state.value}
                                    onChange={(event) => {
                                      const nextValue = event.target.value
                                      field.handleChange(nextValue)
                                      const validation = dashboardWebhookEntrySchema.shape.endpointUrl.safeParse(nextValue)
                                      setEndpointUrlErrors((previous) => {
                                        const nextErrors = { ...previous }

                                        if (validation.success || nextValue.trim().length === 0) {
                                          if (nextErrors[webhook.id]) {
                                            delete nextErrors[webhook.id]
                                          }

                                          return nextErrors
                                        }

                                        nextErrors[webhook.id] = validation.error.issues[0]?.message || "Enter a valid webhook URL."
                                        return nextErrors
                                      })
                                      form.setFieldValue(`webhooks[${index}].health`, {
                                        ...webhook.health,
                                        validationStatus: "unknown",
                                        validationMessage: "",
                                        lastValidatedAt: null,
                                        lastStatusCode: null,
                                      })
                                    }}
                                    onBlur={() => {
                                      field.handleBlur()

                                      const validation = dashboardWebhookEntrySchema.shape.endpointUrl.safeParse(field.state.value)
                                      if (validation.success) {
                                        setEndpointUrlErrors((previous) => {
                                          if (!previous[webhook.id]) {
                                            return previous
                                          }

                                          const nextErrors = { ...previous }
                                          delete nextErrors[webhook.id]
                                          return nextErrors
                                        })
                                        return
                                      }

                                      setEndpointUrlErrors((previous) => ({
                                        ...previous,
                                        [webhook.id]: validation.error.issues[0]?.message || "Enter a valid webhook URL.",
                                      }))
                                    }}
                                    placeholder="https://api.example.com/webhooks/dryapi"
                                  />
                                  {showError ? <p className="text-xs text-red-600">{errorMessage}</p> : null}
                                </div>
                              )
                            }}
                          />

                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className={validationState === "healthy" ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300" : ""}
                            aria-label={`Validate ${webhook.name || `webhook ${index + 1}`}`}
                            disabled={
                              isValidationPending ||
                              !webhook.endpointUrl.trim() ||
                              !webhook.signingSecret.trim() ||
                              !isValidWebhookEndpointUrl(webhook.endpointUrl) ||
                              Boolean(endpointUrlErrors[webhook.id])
                            }
                            onClick={() => {
                              form.setFieldValue(`webhooks[${index}].health`, {
                                ...webhook.health,
                                validationStatus: "checking",
                                validationMessage: "",
                              })
                              void validationMutation.mutateAsync({ index, webhook })
                            }}
                          >
                            {isValidationPending ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : validationState === "healthy" ? (
                              <Check className="size-4" />
                            ) : validationState === "unhealthy" ? (
                              <CircleAlert className="size-4" />
                            ) : (
                              <CircleAlert className="size-4 opacity-40" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs leading-5 text-muted-foreground">
                          Signed validation probe must return HTTP 200 before this webhook can be saved.
                        </p>
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <form.Field
                        name={`webhooks[${index}].signingSecret`}
                        children={(field) => {
                          const isInvalid = (field.state.meta.isTouched || form.state.isSubmitted) && !field.state.meta.isValid
                          const errorMessage = formatFieldError(field.state.meta.errors[0])

                          return (
                            <div className="space-y-2">
                              <Label htmlFor={field.name} className="sr-only">Signing secret</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  id={field.name}
                                  type="password"
                                  value={field.state.value}
                                  onBlur={field.handleBlur}
                                  onChange={(event) => {
                                    field.handleChange(event.target.value)
                                    form.setFieldValue(`webhooks[${index}].health`, {
                                      ...webhook.health,
                                      validationStatus: "unknown",
                                      validationMessage: "",
                                      lastValidatedAt: null,
                                      lastStatusCode: null,
                                    })
                                  }}
                                  placeholder="whsec_..."
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    field.handleChange(randomSecret())
                                    form.setFieldValue(`webhooks[${index}].health`, {
                                      ...webhook.health,
                                      validationStatus: "unknown",
                                      validationMessage: "",
                                      lastValidatedAt: null,
                                      lastStatusCode: null,
                                    })
                                  }}
                                >
                                  Regenerate
                                </Button>
                              </div>
                              {isInvalid ? <p className="text-xs text-red-600">{errorMessage}</p> : null}
                            </div>
                          )
                        }}
                      />
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="space-y-2">
                        <Badge variant="outline" className={`inline-flex h-6 w-fit items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide ${statusBadgeClass(validationState)}`}>
                          {validationState === "healthy" ? <Check className="size-3.5" /> : validationState === "checking" ? <Loader2 className="size-3.5 animate-spin" /> : validationState === "unhealthy" ? <CircleAlert className="size-3.5" /> : null}
                          {statusLabel}
                        </Badge>
                        <p className="text-xs leading-5 text-muted-foreground">{statusDescription}</p>
                      </div>
                    </TableCell>

                    <TableCell className="text-right align-top">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${webhook.name || `webhook ${index + 1}`}`}
                        onClick={() => {
                          form.setFieldValue(
                            "webhooks",
                            webhooks.filter((entry) => entry.id !== webhook.id),
                          )
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 border-t border-zinc-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700/80">
        <p className="text-xs text-muted-foreground">
          Health checks are rate-limited to keep repeated failures from generating noisy emails. Every webhook must respond with HTTP 200 before the settings can be saved.
        </p>
        <Button type="submit" disabled={saveMutation.isPending || form.state.isSubmitting || validationMutation.isPending || !canSubmit}>
          {saveMutation.isPending || form.state.isSubmitting ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  )
}
