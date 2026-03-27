"use client"
/* eslint-disable react/no-children-prop */

import { useEffect } from "react"
import { useForm } from "@tanstack/react-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { RotateCcw, Bell, Save, AlertCircle } from "lucide-react"

import { updateDashboardSettingsAction } from "@/app/actions/dashboard-settings-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { EmailOtpSettingsCard } from "@/components/site/dashboard/settings/email-otp-settings-card"
import {
  DASHBOARD_SETTINGS_DEFAULTS,
  dashboardSecuritySettingsFormSchema,
  type DashboardSecuritySettingsFormValues,
} from "@/lib/dashboard-settings-schema"

type SecuritySettingsFormProps = {
  initialValues?: DashboardSecuritySettingsFormValues
}

async function loadSecuritySettings(): Promise<DashboardSecuritySettingsFormValues> {
  const response = await fetch("/api/dashboard/settings", {
    cache: "no-store",
    credentials: "include",
  })

  if (!response.ok) {
    throw new Error("Unable to load security settings.")
  }

  const payload = (await response.json().catch(() => null)) as {
    data?: { security?: Partial<DashboardSecuritySettingsFormValues> }
  } | null

  return {
    ...DASHBOARD_SETTINGS_DEFAULTS.security,
    ...(payload?.data?.security ?? {}),
  }
}

function SecuritySettingsFormSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="space-y-3 rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={`security-toggle-skeleton-${index}`} className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="space-y-2">
          <div className="flex h-9 items-center justify-between rounded-md border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>

      <div className="flex justify-end border-t border-zinc-200/80 pt-4 dark:border-zinc-700/80">
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  )
}

export function SecuritySettingsForm({ initialValues }: SecuritySettingsFormProps) {
  const queryClient = useQueryClient()
  const securitySettingsQuery = useQuery<DashboardSecuritySettingsFormValues>({
    queryKey: ["dashboard-settings", "security"],
    queryFn: loadSecuritySettings,
    enabled: !initialValues,
    initialData: initialValues,
    staleTime: initialValues ? Number.POSITIVE_INFINITY : 0,
  })

  const saveMutation = useMutation({
    mutationFn: async (values: DashboardSecuritySettingsFormValues) => {
      const bundle = await updateDashboardSettingsAction({
        section: "security",
        values,
      })

      return bundle.security
    },
    onSuccess: (savedValues) => {
      queryClient.setQueryData(["dashboard-settings", "security"], savedValues)
      toast.success("Security settings saved")
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save security settings")
    },
  })

  const form = useForm({
    defaultValues: DASHBOARD_SETTINGS_DEFAULTS.security,
    validators: {
      onSubmit: dashboardSecuritySettingsFormSchema,
    },
    onSubmit: async ({ value }) => {
      await saveMutation.mutateAsync(value)
    },
  })

  useEffect(() => {
    if (securitySettingsQuery.data) {
      form.reset(securitySettingsQuery.data)
    }
  }, [form, securitySettingsQuery.data])

  if (securitySettingsQuery.isLoading) {
    return <SecuritySettingsFormSkeleton />
  }

  if (securitySettingsQuery.isError) {
    return (
      <div className="space-y-3 rounded-lg border border-red-200/80 bg-red-50/70 p-4 dark:border-red-900/40 dark:bg-red-900/20">
        <p className="text-sm text-red-700 dark:text-red-300">
          {securitySettingsQuery.error instanceof Error
            ? securitySettingsQuery.error.message
            : "Unable to load security settings."}
        </p>
        <Button type="button" variant="outline" onClick={() => void securitySettingsQuery.refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <div className="space-y-4">
        <EmailOtpSettingsCard />
      </div>

      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Bell className="size-4" /> Workspace Guardrails
        </h3>
        <div className="divide-y divide-zinc-200/50 rounded-xl border border-zinc-200/80 bg-zinc-50/50 dark:divide-zinc-700/50 dark:border-zinc-700/80 dark:bg-zinc-800/40">
          <form.Field
            name="requireMfa"
            children={(field) => (
              <div className="flex items-center justify-between gap-4 p-4">
                <div className="space-y-0.5">
                  <Label htmlFor={field.name} className="text-base font-medium">Require 2FA</Label>
                  <p className="text-xs text-muted-foreground">Force all workspace members to enable two-factor authentication.</p>
                </div>
                <Switch id={field.name} checked={field.state.value} onCheckedChange={field.handleChange} />
              </div>
            )}
          />

          <form.Field
            name="rotateKeysMonthly"
            children={(field) => (
              <div className="flex items-center justify-between gap-4 p-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={field.name} className="text-base font-medium">Monthly Key Rotation</Label>
                    <RotateCcw className="size-3 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">Suggest rotating API keys every 30 days for better security posture.</p>
                </div>
                <Switch id={field.name} checked={field.state.value} onCheckedChange={field.handleChange} />
              </div>
            )}
          />

          <form.Field
            name="newDeviceAlerts"
            children={(field) => (
              <div className="flex items-center justify-between gap-4 p-4">
                <div className="space-y-0.5">
                  <Label htmlFor={field.name} className="text-base font-medium">New Device Alerts</Label>
                  <p className="text-xs text-muted-foreground">Receive an email notification when your account is logged into from a new device.</p>
                </div>
                <Switch id={field.name} checked={field.state.value} onCheckedChange={field.handleChange} />
              </div>
            )}
          />
        </div>
      </section>

      <div className="flex justify-end border-t border-zinc-200/80 pt-6 dark:border-zinc-700/80">
        <Button 
          type="submit" 
          disabled={saveMutation.isPending || form.state.isSubmitting}
          className="min-w-[120px] gap-2"
        >
          {saveMutation.isPending || form.state.isSubmitting ? (
            <RotateCcw className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {saveMutation.isPending || form.state.isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  )
}
