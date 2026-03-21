"use client";
/* eslint-disable react/no-children-prop */

import { useEffect } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { updateDashboardSettingsAction } from "@/app/actions/dashboard-settings-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DASHBOARD_SETTINGS_DEFAULTS,
  dashboardGeneralSettingsFormSchema,
  type DashboardGeneralSettingsFormValues,
} from "@/lib/dashboard-settings-schema";

type SessionUser = {
  email?: string | null;
  name?: string | null;
};

function toUsername(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function loadGeneralSettings(): Promise<DashboardGeneralSettingsFormValues> {
  const [sessionResponse, settingsResponse] = await Promise.all([
    fetch("/api/auth/get-session", {
      cache: "no-store",
      credentials: "include",
    }),
    fetch("/api/dashboard/settings", {
      cache: "no-store",
      credentials: "include",
    }),
  ]);

  if (!sessionResponse.ok || !settingsResponse.ok) {
    throw new Error("Unable to load general settings.");
  }

  const sessionPayload = (await sessionResponse.json().catch(() => null)) as {
    user?: SessionUser | null;
  } | null;
  const settingsPayload = (await settingsResponse.json().catch(() => null)) as {
    data?: { general?: Partial<DashboardGeneralSettingsFormValues> };
  } | null;

  const user = sessionPayload?.user;
  const generalSettings = settingsPayload?.data?.general ?? {};
  const base = { ...DASHBOARD_SETTINGS_DEFAULTS.general, ...generalSettings };
  const candidateFullName = user?.name?.trim() || "";
  const candidateEmail = user?.email?.trim() || "";
  const candidateUsername = candidateFullName
    ? toUsername(candidateFullName)
    : "";

  return {
    ...base,
    fullName: base.fullName || candidateFullName,
    email: base.email || candidateEmail,
    username: base.username || candidateUsername,
  };
}

function GeneralSettingsFormSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-zinc-200/80 pt-4 dark:border-zinc-700/80">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  );
}

export function GeneralSettingsForm() {
  const queryClient = useQueryClient();
  const generalSettingsQuery = useQuery<DashboardGeneralSettingsFormValues>({
    queryKey: ["dashboard-settings", "general"],
    queryFn: loadGeneralSettings,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: DashboardGeneralSettingsFormValues) => {
      const bundle = await updateDashboardSettingsAction({
        section: "general",
        values,
      });

      return bundle.general;
    },
    onSuccess: (savedValues) => {
      queryClient.setQueryData(["dashboard-settings", "general"], savedValues);
      toast.success("General settings saved");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to save settings",
      );
    },
  });

  const form = useForm({
    defaultValues: DASHBOARD_SETTINGS_DEFAULTS.general,
    validators: {
      onSubmit: dashboardGeneralSettingsFormSchema,
    },
    onSubmit: async ({ value }) => {
      await saveMutation.mutateAsync(value);
    },
  });

  useEffect(() => {
    if (generalSettingsQuery.data) {
      form.reset(generalSettingsQuery.data);
    }
  }, [form, generalSettingsQuery.data]);

  if (generalSettingsQuery.isLoading) {
    return <GeneralSettingsFormSkeleton />;
  }

  if (generalSettingsQuery.isError) {
    return (
      <div className="space-y-3 rounded-lg border border-red-200/80 bg-red-50/70 p-4 dark:border-red-900/40 dark:bg-red-900/20">
        <p className="text-sm text-red-700 dark:text-red-300">
          {generalSettingsQuery.error instanceof Error
            ? generalSettingsQuery.error.message
            : "Unable to load general settings."}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void generalSettingsQuery.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <form.Field
          name="username"
          children={(field) => {
            const isInvalid =
              (field.state.meta.isTouched || form.state.isSubmitted) &&
              !field.state.meta.isValid;
            const errorMessage = String(
              (field.state.meta.errors[0] as unknown) ?? "",
            );

            return (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Username</Label>
                <Input
                  autoComplete="username"
                  id={field.name}
                  placeholder="magebase"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                {isInvalid ? (
                  <p className="text-sm text-red-600">{errorMessage}</p>
                ) : null}
              </div>
            );
          }}
        />

        <form.Field
          name="fullName"
          children={(field) => {
            const isInvalid =
              (field.state.meta.isTouched || form.state.isSubmitted) &&
              !field.state.meta.isValid;
            const errorMessage = String(
              (field.state.meta.errors[0] as unknown) ?? "",
            );

            return (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Name and surname</Label>
                <Input
                  autoComplete="name"
                  id={field.name}
                  placeholder="Mage Base"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                {isInvalid ? (
                  <p className="text-sm text-red-600">{errorMessage}</p>
                ) : null}
              </div>
            );
          }}
        />

        <form.Field
          name="email"
          children={(field) => {
            const isInvalid =
              (field.state.meta.isTouched || form.state.isSubmitted) &&
              !field.state.meta.isValid;
            const errorMessage = String(
              (field.state.meta.errors[0] as unknown) ?? "",
            );

            return (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor={field.name}>Email</Label>
                <Input
                  autoComplete="email"
                  id={field.name}
                  placeholder="dryapi.dev@gmail.com"
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                {isInvalid ? (
                  <p className="text-sm text-red-600">{errorMessage}</p>
                ) : null}
              </div>
            );
          }}
        />

        <form.Field
          name="company"
          children={(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Company</Label>
              <Input
                autoComplete="organization"
                id={field.name}
                placeholder="dryAPI"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </div>
          )}
        />

        <form.Field
          name="timezone"
          children={(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Timezone</Label>
              <Select
                value={field.state.value}
                onValueChange={(value) =>
                  field.handleChange(
                    value as DashboardGeneralSettingsFormValues["timezone"],
                  )
                }
              >
                <SelectTrigger id={field.name} className="w-full">
                  <SelectValue placeholder="Timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">
                    America/New_York
                  </SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                  <SelectItem value="Asia/Singapore">Asia/Singapore</SelectItem>
                  <SelectItem value="Australia/Sydney">
                    Australia/Sydney
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        />
      </div>

      <div className="flex items-center justify-between border-t border-zinc-200/80 pt-4 dark:border-zinc-700/80">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Changes are persisted to your dashboard profile.
        </p>
        <Button
          type="submit"
          disabled={saveMutation.isPending || form.state.isSubmitting}
        >
          {saveMutation.isPending || form.state.isSubmitting
            ? "Saving..."
            : "Save"}
        </Button>
      </div>
    </form>
  );
}
