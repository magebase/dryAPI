"use client"
/* eslint-disable react/no-children-prop */

import { useEffect } from "react"
import { useForm } from "@tanstack/react-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { updateDashboardSettingsAction } from "@/app/actions/dashboard-settings-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  DASHBOARD_SETTINGS_DEFAULTS,
  dashboardWebhooksSettingsFormSchema,
  type DashboardWebhooksSettingsFormValues,
} from "@/lib/dashboard-settings-schema"

type WebhooksSettingsFormProps = {
  initialValues?: DashboardWebhooksSettingsFormValues
}

function randomSecret(): string {
  const bytes = new Uint8Array(18)
  window.crypto.getRandomValues(bytes)
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  return `whsec_${token}`
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
    data?: { webhooks?: Partial<DashboardWebhooksSettingsFormValues> }
  } | null

  return {
    ...DASHBOARD_SETTINGS_DEFAULTS.webhooks,
    ...(payload?.data?.webhooks ?? {}),
  }
}

function WebhooksSettingsFormSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40">
        <Skeleton className="h-5 w-36" />

        {Array.from({ length: 4 }, (_, index) => (
          <div key={`webhook-toggle-skeleton-${index}`} className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-zinc-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700/80">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  )
}

export function WebhooksSettingsForm({ initialValues }: WebhooksSettingsFormProps) {
  const queryClient = useQueryClient()
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
      toast.success("Webhook settings saved")
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save webhook settings")
    },
  })

  const form = useForm({
    defaultValues: DASHBOARD_SETTINGS_DEFAULTS.webhooks,
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
      <div className="space-y-2">
        <form.Field
          name="endpointUrl"
          children={(field) => {
            const isInvalid = (field.state.meta.isTouched || form.state.isSubmitted) && !field.state.meta.isValid
            const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "")

            return (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Webhook URL</Label>
                <Input
                  id={field.name}
                  type="url"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="https://api.example.com/webhooks/deapi"
                />
                {isInvalid ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
              </div>
            )
          }}
        />
      </div>

      <div className="space-y-2">
        <form.Field
          name="signingSecret"
          children={(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Signing secret</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="whsec_..."
                />
                <Button type="button" variant="outline" onClick={() => field.handleChange(randomSecret())}>
                  Regenerate
                </Button>
              </div>
            </div>
          )}
        />
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Event subscriptions</p>

        <form.Field
          name="sendOnCompleted"
          children={(field) => (
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor={field.name}>job.completed</Label>
              <Switch id={field.name} checked={field.state.value} onCheckedChange={field.handleChange} />
            </div>
          )}
        />

        <form.Field
          name="sendOnFailed"
          children={(field) => (
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor={field.name}>job.failed</Label>
              <Switch id={field.name} checked={field.state.value} onCheckedChange={field.handleChange} />
            </div>
          )}
        />

        <form.Field
          name="sendOnQueued"
          children={(field) => (
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor={field.name}>job.queued</Label>
              <Switch id={field.name} checked={field.state.value} onCheckedChange={field.handleChange} />
            </div>
          )}
        />

        <form.Field
          name="includeFullPayload"
          children={(field) => (
            <div className="flex items-center justify-between gap-4 border-t border-zinc-200/80 pt-3 dark:border-zinc-700/80">
              <Label htmlFor={field.name}>Include full payload</Label>
              <Switch id={field.name} checked={field.state.value} onCheckedChange={field.handleChange} />
            </div>
          )}
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-zinc-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700/80">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const currentUrl = form.state.values.endpointUrl.trim()
            if (!currentUrl) {
              toast.error("Set webhook endpoint before sending a test")
              return
            }

            toast.success("Test event queued", {
              description: "A simulated webhook delivery has been enqueued.",
            })
          }}
        >
          Send Test Event
        </Button>
        <Button type="submit" disabled={saveMutation.isPending || form.state.isSubmitting}>
          {saveMutation.isPending || form.state.isSubmitting ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  )
}
