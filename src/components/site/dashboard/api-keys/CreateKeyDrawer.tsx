"use client";

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

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { toast } from "sonner";
import ApiKeyCopyIconButton from "./ApiKeyCopyIconButton";

type Props = {
  open: boolean;
  onClose(): void;
  onCreated?(): void;
};

type PermissionPreset =
  | "all"
  | "read-only"
  | "models:infer"
  | "billing:read"
  | "custom";
type ExpirationPreset = "never" | "7d" | "30d" | "90d";

type CreatedKeyState = {
  secret: string;
  start: string;
};

function formatKeyPrefix(start?: string) {
  if (!start) return "-";
  if (start.length <= 8) return `${start}****`;
  return `${start}****${start.slice(-4)}`;
}

function resolveStartFromSecret(secret: string) {
  return secret.slice(0, 16);
}

function parseCustomCsv(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function getExpiresAt(preset: ExpirationPreset) {
  if (preset === "never") return undefined;
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

function getPermissions(preset: PermissionPreset, customPermissions: string) {
  if (preset === "custom") {
    return parseCustomCsv(customPermissions);
  }

  if (preset === "all") return ["all"];
  return [preset];
}

export default function CreateKeyDrawer({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [prefix, setPrefix] = useState("");
  const [permissionPreset, setPermissionPreset] =
    useState<PermissionPreset>("all");
  const [customPermissions, setCustomPermissions] = useState("");
  const [expirationPreset, setExpirationPreset] =
    useState<ExpirationPreset>("90d");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedKeyState | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setEnvironment("production");
    setPrefix("");
    setPermissionPreset("all");
    setCustomPermissions("");
    setExpirationPreset("never");
    setCreateError(null);
  }

  function handleClose() {
    setCreatedKey(null);
    resetForm();
    onClose();
  }

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    setCreating(true);
    setCreatedKey(null);
    setCreateError(null);

    try {
      const permissions = getPermissions(permissionPreset, customPermissions);

      if (permissionPreset === "custom" && permissions.length === 0) {
        setCreateError(
          "Add at least one custom permission or choose a preset.",
        );
        return;
      }

      const body = {
        name: name || undefined,
        prefix: prefix || undefined,
        permissions,
        expires: getExpiresAt(expirationPreset),
        meta: {
          environment,
        },
      };

      const res = await fetch("/api/dashboard/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      const keyStr = typeof json?.data?.key === "string" ? json.data.key : null;
      const keyStart =
        typeof json?.data?.start === "string"
          ? json.data.start
          : keyStr
            ? resolveStartFromSecret(keyStr)
            : null;
      if (keyStr) {
        setCreatedKey({
          secret: keyStr,
          start: keyStart ?? resolveStartFromSecret(keyStr),
        });
      } else {
        setCreatedKey(null);
        console.error("create key failed", json);
        setCreateError("Failed to create key. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setCreateError("Error creating key. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-xl" showCloseButton={!creating}>
        <DialogHeader>
          <DialogTitle>
            {createdKey ? "Your API Key" : "Create API Key"}
          </DialogTitle>
          <DialogDescription>
            {createdKey
              ? "This key is shown once. Use the icon to store it securely before closing this dialog."
              : "Create a scoped API key for a specific environment and service."}
          </DialogDescription>
        </DialogHeader>

        {createdKey ? (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="mb-2 text-sm font-medium">Secret key</p>
              <div className="flex items-center gap-2">
                <Input readOnly value={formatKeyPrefix(createdKey.start)} />
                <ApiKeyCopyIconButton
                  value={createdKey.secret}
                  label="Copy new API key"
                  variant="outline"
                  size="icon-sm"
                  onCopyError={() => {
                    toast.error("Failed to copy API key.");
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Only the prefix is shown here.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                onClick={() => {
                  onCreated?.();
                  handleClose();
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key-name">Name</Label>
              <Input
                id="api-key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production Server"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="api-key-environment">Environment</Label>
                <NativeSelect
                  id="api-key-environment"
                  className="w-full"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                >
                  <NativeSelectOption value="production">
                    Production
                  </NativeSelectOption>
                  <NativeSelectOption value="staging">
                    Staging
                  </NativeSelectOption>
                  <NativeSelectOption value="local">Local</NativeSelectOption>
                  <NativeSelectOption value="ci">CI/CD</NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key-expiration">Expiration</Label>
                <NativeSelect
                  id="api-key-expiration"
                  className="w-full"
                  value={expirationPreset}
                  onChange={(e) =>
                    setExpirationPreset(e.target.value as ExpirationPreset)
                  }
                >
                  <NativeSelectOption value="never">Never</NativeSelectOption>
                  <NativeSelectOption value="7d">7 days</NativeSelectOption>
                  <NativeSelectOption value="30d">30 days</NativeSelectOption>
                  <NativeSelectOption value="90d">90 days</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key-permissions">Permissions</Label>
              <NativeSelect
                id="api-key-permissions"
                className="w-full"
                value={permissionPreset}
                onChange={(e) =>
                  setPermissionPreset(e.target.value as PermissionPreset)
                }
              >
                <NativeSelectOption value="all">All</NativeSelectOption>
                <NativeSelectOption value="read-only">
                  Read-only
                </NativeSelectOption>
                <NativeSelectOption value="models:infer">
                  models:infer
                </NativeSelectOption>
                <NativeSelectOption value="billing:read">
                  billing:read
                </NativeSelectOption>
                <NativeSelectOption value="custom">
                  Custom list
                </NativeSelectOption>
              </NativeSelect>
            </div>

            {permissionPreset === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="api-key-custom-permissions">
                  Custom permissions
                </Label>
                <Input
                  id="api-key-custom-permissions"
                  value={customPermissions}
                  onChange={(e) => setCustomPermissions(e.target.value)}
                  placeholder="models:infer,billing:read"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="api-key-prefix">Key prefix (optional)</Label>
              <Input
                id="api-key-prefix"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="sk_live"
              />
            </div>

            {createError ? (
              <p className="text-sm text-red-600 dark:text-red-300">
                {createError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
